from shapely.geometry import Point, box

from oswoj_geo.parks import (
    Area,
    ParkRecord,
    district_numbers,
    locate,
    match_area,
    match_point,
    match_renamed,
    name_score,
    osm_geometry,
    place_feature,
    render_report,
)

# a toy city: district 1 on the left, district 2 on the right (degrees, ~7 km wide each)
D1, D2 = box(19.90, 50.00, 20.00, 50.10), box(20.00, 50.00, 20.10, 50.10)
DISTRICTS = {1: ("Lewa", D1), 2: ("Prawa", D2)}


def park_box(x: float, size: float = 0.003) -> box:  # ~4.6 ha at this latitude for size 0.003
    return box(x, 50.05, x + size, 50.05 + size)


def test_district_numbers():
    assert district_numbers("VII Zwierzyniec") == [7]
    assert district_numbers("I, II, VII, VIII, XIII") == [1, 2, 7, 8, 13]
    assert district_numbers("XII Bieżanów - Prokocim") == [12]


def test_name_score():
    assert name_score("Park im. Henryka Jordana", "Park Jordana") >= 90
    assert name_score("Park im. Wojciecha Bednarskiego", "Park imienia Wojciecha Bednarskiego") == 100
    assert name_score("Park Dąbie", "Park Decjusza") < 90


def test_osm_geometry_way_and_relation_with_hole():
    ring = [{"lon": x, "lat": y} for x, y in [(0, 0), (4, 0), (4, 4), (0, 4), (0, 0)]]
    hole = [{"lon": x, "lat": y} for x, y in [(1, 1), (2, 1), (2, 2), (1, 2), (1, 1)]]
    assert osm_geometry({"type": "way", "geometry": ring}).area == 16
    relation = {
        "type": "relation",
        "members": [{"role": "outer", "geometry": ring}, {"role": "inner", "geometry": hole}],
    }
    assert osm_geometry(relation).area == 15
    assert osm_geometry({"type": "node", "lat": 1, "lon": 1}) is None
    assert osm_geometry({"type": "way", "geometry": ring[:-1]}) is None  # open way


def test_match_area_needs_name_district_and_plausible_size():
    right_size = Area("Park Jordana", park_box(19.95), "osm:way/1")
    found = match_area("Park im. Henryka Jordana", D1, 4.6, [right_size])
    assert found and found.method == "osm-area" and found.point.within(right_size.geometry)
    assert match_area("Park im. Henryka Jordana", D2, 4.6, [right_size]) is None  # other district
    assert match_area("Park im. Henryka Jordana", D1, 40.0, [right_size]) is None  # 10× smaller than stated
    assert match_area("Park Decjusza", D1, 4.6, [right_size]) is None  # other park


def test_match_area_prefers_the_closer_size():
    small = Area("Park Rudawa", park_box(19.91, 0.001), "osm:way/1")
    right = Area("Park Rudawa", park_box(19.95), "osm:way/2")
    assert match_area("Park Rudawa", D1, 4.6, [small, right]).ref == "osm:way/2"


def test_renamed_pocket_park_by_district_and_declared_area():
    polygon = Area("Zakręcony Ogród Krakowian", park_box(19.95, 0.0005), "arcgis:FID 10", 0.1639)
    found = match_renamed(D1, 0.1639, [polygon])
    assert found and found.method == "arcgis" and found.matched_name == "Zakręcony Ogród Krakowian"
    assert match_renamed(D1, 0.1640, [polygon]) is None
    assert match_renamed(D2, 0.1639, [polygon]) is None


class FakeNominatim:
    def __init__(self, results):
        self.results = results

    def search(self, query):
        return self.results


def test_match_point_needs_the_exact_name_inside_the_district():
    hit = {
        "name": "Park Dąbie",
        "lon": "19.95",
        "lat": "50.05",
        "osm_type": "node",
        "osm_id": 7,
        "category": "tourism",
        "type": "checkpoint",
    }
    found = match_point("Park Dąbie", D1, FakeNominatim([hit]))
    assert found and found.method == "osm-point" and (found.point.x, found.point.y) == (19.95, 50.05)
    assert match_point("Park Dąbie", D2, FakeNominatim([hit])) is None
    assert match_point("Park Dąbie Północ", D1, FakeNominatim([hit])) is None


def test_pocket_parks_use_city_polygons_first():
    record = ParkRecord(
        "park_kieszonkowy", "parki_kieszonkowe", "Motyli Ogród Krakowian", "I Lewa", 0.05, "Skwer"
    )
    city = Area("Motyli Ogród Krakowian", park_box(19.95, 0.0005), "arcgis:FID 1", 0.05)
    osm = Area("Motyli Ogród Krakowian", park_box(19.96, 0.0005), "osm:way/9")
    assert locate(record, D1, [osm], [city], None).ref == "arcgis:FID 1"


def test_place_feature_and_report():
    record = ParkRecord("park", "parki_miejskie", "Park Jordana", "I Lewa", 4.6, "Park")
    located = match_area("Park Jordana", D1, 4.6, [Area("Park Jordana", park_box(19.95), "osm:way/1")])
    p = place_feature(record, located, DISTRICTS)["properties"]
    assert p["id"] == "park:park-jordana" and p["category"] == "park"
    assert p["district"] == {"number": 1, "name": "Lewa"} and p["address"] == "Lewa, Kraków"
    assert p["attrs"] == {"area_ha": 4.6, "type": "Park", "location": "area"}
    assert p["source"]["dataset"] == "parki-miejskie-w-krakowie"
    missing = ParkRecord("park", "parki_miejskie", "Park Nowy", "II Prawa", 1.0, "Park")
    pocket = ParkRecord("park_kieszonkowy", "parki_kieszonkowe", "Ogród", "I Lewa", 0.1, None)
    report = render_report([(record, located), (missing, None), (pocket, located)])
    assert (
        "**park**: 1 / 2 located (50%)" in report and "| Park Nowy | II Prawa | 1.0 | **not found**" in report
    )
    assert "not met" in report
    assert Point(19.95, 50.05).within(D1)
