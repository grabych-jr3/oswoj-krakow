import json

import pytest

from oswoj_geo.layers import (
    CATEGORY_DATASETS,
    build_feature,
    display_name,
    format_address,
    format_street,
    index_entry,
    write_layers,
)
from oswoj_geo.sources import BY_NAME, PortalTable


@pytest.mark.parametrize(("raw", "expected"), [
    ('SAMORZĄDOWE PRZEDSZKOLE NR 92 "DWOREK NA KRZEMIONKACH" W KRAKOWIE',
     "Samorządowe Przedszkole nr 92 „Dworek na Krzemionkach” w Krakowie"),
    ("I LICEUM OGÓLNOKSZTAŁCĄCE IM. BARTŁOMIEJA NOWODWORSKIEGO W KRAKOWIE",
     "I Liceum Ogólnokształcące im. Bartłomieja Nowodworskiego w Krakowie"),
    ("XLIII LICEUM OGÓLNOKSZTAŁCĄCE", "XLIII Liceum Ogólnokształcące"),
    ('PUBLICZNE PRZEDSZKOLE RUCZAJ "JAŚ I MAŁGOSIA"', "Publiczne Przedszkole Ruczaj „Jaś i Małgosia”"),
    ('SZKOŁA POLICEALNA "COSINUS I" W KRAKOWIE', "Szkoła Policealna „Cosinus I” w Krakowie"),
    ("NIEPUBLICZNY PUNKT PRZEDSZKOLNY SOTIS KRAKÓW I", "Niepubliczny Punkt Przedszkolny Sotis Kraków I"),
    ("BC NIEPUBLICZNA SZKOŁA PODSTAWOWA", "BC Niepubliczna Szkoła Podstawowa"),
    ("SZKOŁA PODSTAWOWA NR 2 IM. ŚW. WOJCIECHA", "Szkoła Podstawowa nr 2 im. św. Wojciecha"),
    ('PRYWATNE PRZEDSZKOLE "PIOTRUSIA PANA" I. ŁĘCKA-KARNAS',
     "Prywatne Przedszkole „Piotrusia Pana” I. Łęcka-Karnas"),
    ("Żłobek Samorządowy Nr 15", "Żłobek Samorządowy Nr 15"),  # mixed case is kept
    ('Klub Malucha "Tup-Tup"', "Klub Malucha „Tup-Tup”"),
])
def test_display_name(raw, expected):
    assert display_name(raw) == expected


def test_format_street_and_address():
    assert format_street("Wielicka") == "ul. Wielicka"
    assert format_street("Aleja Jana Pawła II") == "al. Jana Pawła II"
    assert format_street("Osiedle Centrum E") == "os. Centrum E"
    assert format_street("Plac Na Groblach") == "pl. Na Groblach"
    assert format_street("Rynek Główny") == "Rynek Główny"
    assert format_street("ks. Ferdynanda Machaya") == "ul. ks. Ferdynanda Machaya"
    assert format_address("Wielicka", "28A", "30-552") == "ul. Wielicka 28A, 30-552 Kraków"
    assert format_address("Gumniska", None, None) == "ul. Gumniska, Kraków"


DISTRICTS = {13: "Podgórze"}
RECORD = {"Numer RSPO": 20883,
          "Nazwa szkoły_placówki": 'SAMORZĄDOWE PRZEDSZKOLE NR 92 "DWOREK NA KRZEMIONKACH"',
          "Liczba dzieci ogółem": 121, "Liczba oddziałów ogółem": 6,
          "Publiczność szkoły_placówki": "publiczna",
          "Organ prowadzący": "Gmina Miejska Kraków", "Typ szkoły_placówki": "Przedszkole",
          "Telefon": "12 296 23 90"}


def row(hit, number=None):
    return {"key": "rspo-20883", "name": RECORD["Nazwa szkoły_placówki"], "street": "Parkowa",
            "number": number, "postal": "30-538", "hit": hit, "reason": None}


def hit(precision="address", number="14"):
    return {"lon": 19.953184, "lat": 50.040868, "precision": precision, "method": "exact",
            "street": "Parkowa", "number": number if precision == "address" else None, "postal": "30-538",
            "district": 13,
            "emuia_id": 1}


def test_build_feature_is_a_place_without_coords():
    feature = build_feature("przedszkole", "przedszkola_samorzadowe", row(hit()), RECORD, DISTRICTS)
    p = feature["properties"]
    assert feature["geometry"] == {"type": "Point", "coordinates": [19.953184, 50.040868]}
    assert p["id"] == "przedszkole:rspo-20883" and p["category"] == "przedszkole"
    assert p["address"] == "ul. Parkowa 14, 30-538 Kraków"
    assert p["district"] == {"number": 13, "name": "Podgórze"}
    assert p["phone"] == "12 296 23 90" and p["url"] is None
    assert p["attrs"] == {"rspo": 20883, "children": 121, "groups": 6, "public": True,
                          "operator": "Gmina Miejska Kraków", "type": "Przedszkole", "location": "address"}
    assert p["source"] == {"dataset": "przedszkola-w-krakowie-liczba-dzieci",
                           "url": "https://otwartedane.um.krakow.pl/zbiory-danych/przedszkola-w-krakowie-liczba-dzieci",
                           "updatedAt": "2025-09-30"}
    assert "coords" not in p


def test_street_level_place_keeps_the_source_address_and_says_so():
    feature = build_feature("przedszkole", "przedszkola_samorzadowe", row(hit("street"), number=None), RECORD,
                            DISTRICTS)
    assert feature["properties"]["address"] == "ul. Parkowa, 30-538 Kraków"
    assert feature["properties"]["attrs"]["location"] == "street"


def test_not_geocoded_record_is_skipped():
    assert build_feature("przedszkole", "przedszkola_samorzadowe", row(None), RECORD, DISTRICTS) is None


def test_every_layer_dataset_has_a_portal_page():
    for datasets in CATEGORY_DATASETS.values():
        for dataset in datasets:
            source = BY_NAME[dataset]
            assert isinstance(source, PortalTable) and source.page


def test_index_and_files(tmp_path):
    feature = build_feature("przedszkole", "przedszkola_samorzadowe", row(hit()), RECORD, DISTRICTS)
    entry = index_entry("zlobek", [feature, feature])
    assert entry["count"] == 2 and len(entry["source"]) == 3 and entry["updatedAt"] == "2026-10-19"
    write_layers({"przedszkole": [feature]}, tmp_path)
    layer = json.loads((tmp_path / "przedszkole.geojson").read_text(encoding="utf-8"))
    assert layer["type"] == "FeatureCollection" and layer["features"] == [feature]
    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert index["categories"][0]["category"] == "przedszkole" and index["categories"][0]["count"] == 1
