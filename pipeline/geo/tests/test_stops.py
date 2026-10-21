import zipfile

from shapely.geometry import box

from oswoj_geo.stops import (
    Stop,
    add_gtfs,
    base_name,
    group_posts,
    keep_post,
    line_order,
    park_and_ride_features,
    stop_feature,
    stop_number,
    stop_type,
)

NOW = 1_800_000_000_000  # ms
DISTRICTS = {13: ("Podgórze", box(19.9, 50.0, 20.0, 50.1))}


def post(code, name, typ="A", group="KMK", lon=19.96, lat=50.04, valid_from=None, zone="I"):
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "kod_busman": code,
            "Nazwa_przystanku_nr": name,
            "Typ_przystanku": typ,
            "Grupa": group,
            "validFrom": valid_from,
            "Strefa_Biletowa": zone,
        },
    }


def test_codes_and_names():
    assert stop_number("642-02") == "642" and stop_number("416-04-01") == "416"
    assert base_name("Podgórze SKA 02") == "Podgórze SKA"
    assert base_name("Czyżyny Dworzec 01-08") == "Czyżyny Dworzec"
    assert base_name("Reymonta 22 02") == "Reymonta 22"


def test_only_served_physical_current_posts_are_kept():
    keep = lambda **kw: keep_post(post("642-01", "X 01", **kw)["properties"], NOW)  # noqa: E731
    assert keep() and keep(typ="T") and keep(typ="pA") and keep(group="KMK_inny")
    assert not keep(group="GMK") and not keep(group="KMK_zawieszony") and not keep(group="Inny")
    assert not keep(typ="wA") and not keep(typ="tymA") and not keep(typ="S")
    assert keep(valid_from=NOW - 1) and not keep(valid_from=NOW + 1)


def test_posts_grouped_into_stops():
    collection = {
        "features": [
            post("642-01", "Podgórze SKA 01", lon=19.960),
            post("642-02", "Podgórze SKA 02", lon=19.962),
            post("642-09", "Podgórze SKA 09", typ="wA"),
            post("100-03", "AKF / PK 03"),
        ]
    }
    stops = group_posts(collection, NOW)
    assert sorted(stops) == ["100", "642"] and len(stops["642"].posts) == 2
    assert round(stops["642"].point.x, 3) == 19.961


def write_gtfs(path, stop_code, routes):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("stops.txt", f"stop_id,stop_code,stop_name\ns1,{stop_code},Podgórze SKA\n")
        z.writestr(
            "routes.txt",
            "route_id,route_short_name,route_type\n"
            + "".join(f"r{i},{name},{rtype}\n" for i, (name, rtype) in enumerate(routes)),
        )
        z.writestr("trips.txt", "trip_id,route_id\n" + "".join(f"t{i},r{i}\n" for i in range(len(routes))))
        z.writestr("stop_times.txt", "trip_id,stop_id\n" + "".join(f"t{i},s1\n" for i in range(len(routes))))


def test_gtfs_lines_names_and_type(tmp_path):
    stops = group_posts({"features": [post("642-01", "Podgórze SKA 01", typ="A")]}, NOW)
    write_gtfs(tmp_path / "t.zip", "642-03", [("13", "900"), ("3", "900")])
    write_gtfs(tmp_path / "a.zip", "642-01", [("158", "3"), ("N", "3")])
    add_gtfs(stops, [tmp_path / "t.zip", tmp_path / "a.zip"])
    stop = stops["642"]
    assert sorted(stop.lines, key=line_order) == ["3", "13", "158", "N"]
    assert stop_type(stop) == "AT"
    attrs = stop_feature(stop, {"number": 13, "name": "Podgórze"})["properties"]["attrs"]
    assert attrs == {"code": "642", "type": "AT", "lines": "3, 13, 158, N", "posts": 1, "zone": "I"}


def test_type_falls_back_to_post_types_without_gtfs():
    stop = Stop("1", posts=[{"Typ_przystanku": "pT"}, {"Typ_przystanku": "TA"}])
    assert stop_type(stop) == "AT"
    assert stop_type(Stop("2", posts=[{"Typ_przystanku": "pA"}])) == "A"


def test_stop_feature_is_a_place_without_coords():
    stop = Stop(
        "642", posts=[{**post("642-01", "Podgórze SKA 01")["properties"], "lon": 19.96, "lat": 50.04}]
    )
    f = stop_feature(stop, {"number": 13, "name": "Podgórze"})
    p = f["properties"]
    assert p["id"] == "przystanek:642" and p["name"] == "Podgórze SKA" and p["address"] == "Podgórze, Kraków"
    assert p["attrs"]["lines"] is None  # no GTFS service: no invented lines
    assert p["source"]["dataset"] == "ztp-arcgis" and p["source"]["url"].startswith("https://www.arcgis.com/")
    assert f["geometry"]["coordinates"] == [19.96, 50.04]


def test_park_and_ride():
    collection = {
        "features": [
            {
                "geometry": {"coordinates": [19.95, 50.01]},
                "properties": {
                    "Nazwa": "P+R Kurdwanów",
                    "m_ogolem": 167,
                    "m_elektryczne": 4,
                    "m_niepełnosp": 7,
                    "stojaki": "tak",
                    "wypozyczalnie_peb": "nie",
                    "monitoring": None,
                    "infolinia": "501 678 116 ",
                    "doba_parkingowa": "od godz. 4:30 do 2:30",
                },
            },
            {"geometry": {"coordinates": [21.0, 52.2]}, "properties": {"Nazwa": "P+R Warszawa"}},  # outside
        ]
    }
    [f] = park_and_ride_features(collection, DISTRICTS)
    p = f["properties"]
    assert p["id"] == "park_and_ride:kurdwanow" and p["phone"] == "501 678 116"
    assert p["attrs"] == {
        "spaces": 167,
        "spacesEv": 4,
        "spacesDisabled": 7,
        "bikeRacks": True,
        "bikeRental": False,
        "monitoring": None,
        "hours": "od godz. 4:30 do 2:30",
    }


def test_stop_name_prefers_ztp_and_breaks_ties_alphabetically():
    from collections import Counter

    from oswoj_geo.stops import most_common_name, stop_name

    stop = Stop(
        "810",
        posts=[{"Nazwa_przystanku_nr": "Teatr Variété 01"}, {"Nazwa_przystanku_nr": "Teatr Variété 02"}],
        gtfs_names=Counter({"Teatr Variete": 2}),
    )
    assert stop_name(stop) == "Teatr Variété"
    assert (
        stop_name(Stop("9", posts=[{"Nazwa_przystanku_nr": None}], gtfs_names=Counter({"Rondo": 1})))
        == "Rondo"
    )
    assert most_common_name(Counter({"B": 1, "A": 1})) == "A"
    assert most_common_name(Counter()) is None
