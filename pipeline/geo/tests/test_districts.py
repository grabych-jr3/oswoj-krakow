import json

from oswoj_geo.districts import country_name, render_report, roman_to_int, write


def test_roman_to_int():
    assert [roman_to_int(r) for r in ("I", "IV", "IX", "XIII", "XIV", "XVIII")] == [1, 4, 9, 13, 14, 18]


def test_country_name():
    assert country_name("UKRAINA") == "Ukraina"
    assert country_name("BOŚNIA I HERCEGOWINA") == "Bośnia i Hercegowina"
    assert country_name("STANY ZJEDNOCZONE AMERYKI") == "Stany Zjednoczone Ameryki"
    assert country_name("TAJWAN (TAIWAN)") == "Tajwan (Taiwan)"


FEATURE = {
    "type": "Feature",
    "geometry": {
        "type": "Polygon",
        "coordinates": [[[19.9, 50.0], [20.0, 50.0], [20.0, 50.1], [19.9, 50.0]]],
    },
    "properties": {
        "number": 13,
        "name": "Podgórze",
        "residents": 45518,
        "foreigners": 2485,
        "topCitizenships": [{"name": "Ukraina", "count": 993}],
        "placeCounts": {"przedszkole": 40},
    },
}


def test_write_puts_the_same_file_in_both_places(tmp_path):
    write(
        {"type": "FeatureCollection", "features": [FEATURE]},
        tmp_path / "layers",
        tmp_path / "data" / "d.json",
    )
    public = (tmp_path / "layers" / "districts.geojson").read_text(encoding="utf-8")
    assert public == (tmp_path / "data" / "d.json").read_text(encoding="utf-8")
    assert json.loads(public)["features"] == [FEATURE]


def test_report_shows_totals_and_flags_a_mismatch():
    report = render_report(
        {"features": [FEATURE]}, [("mieszkancy_staly", 10, 10), ("cudzoziemcy_staly", 5, 6)]
    )
    assert "| 13 | Podgórze | 45518 | 2485 | Ukraina 993 | 40 |" in report
    assert "| mieszkancy_staly | 10 | 10 | yes |" in report
    assert "| cudzoziemcy_staly | 5 | 6 | **NO** |" in report
