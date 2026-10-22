import pytest

from oswoj_geo.emuia import AddressPoint
from oswoj_geo.geocoder import Geocoder
from oswoj_geo.offices import (
    address_parts,
    clean,
    locate,
    office_feature,
    phones,
    postal_code,
    procedures_by_office,
    render_report,
)


@pytest.mark.parametrize(
    ("address", "parts"),
    [
        ("ul. Zabłocie 22, 30-701 Kraków - pokój nr 12", [("ul. Zabłocie", "22")]),
        ("Grodzki Urząd Pracy w Krakowie, ul. Wąwozowa 34, 31-752 Kraków", [("ul. Wąwozowa", "34")]),
        (
            "Punkt Obsługi Mieszkańców – Bonarka City Center, 30-664 Kraków, "
            "ul. Henryka Kamieńskiego 11, lokal nr M1",
            [("ul. Henryka Kamieńskiego", "11")],
        ),
        ("ul. Na Kozłówce 27 (II piętro), 30-664 Kraków", [("ul. Na Kozłówce", "27")]),
        ("ul. Czerwieńskiego 16 31-319 Kraków", [("ul. Czerwieńskiego", "16")]),
        ("os. Centrum C 10 B, 31-931Kraków", [("os. Centrum C", "10B")]),
        ("ul. Limanowskiego 13/5-6, 30-529 Kraków", [("ul. Limanowskiego", "13/5-6")]),
        ("Sekretariat - ul. Za Torem 22, 30-542 Kraków", [("ul. Za Torem", "22")]),
        ("ul. Bracka 10, 31-005 Kraków, pierwsze piętro - pokój nr 19", [("ul. Bracka", "10")]),
        (
            "ul. Lubelska 29, ul. Wadowicka 8W, os. Zgody 2",
            [("ul. Lubelska", "29"), ("ul. Wadowicka", "8W"), ("os. Zgody", "2")],
        ),
    ],
)
def test_address_parts(address, parts):
    assert address_parts(address) == parts


def test_clean_and_postal():
    assert clean("ul. Dekerta 24, 30 - 703  Kraków") == "ul. Dekerta 24, 30-703 Kraków"
    assert postal_code("os. Centrum C 10 B, 31-931Kraków") == "31-931"
    assert postal_code("ul. Lubelska 29") is None


GEO = Geocoder(
    [
        AddressPoint(1, "Aleja Powstania Warszawskiego", "10", "31-541", 2, 19.96, 50.06),
        AddressPoint(2, "Wadowicka", "8a", "30-415", 9, 19.940, 50.030),
        AddressPoint(3, "Wadowicka", "8h", "30-415", 9, 19.941, 50.030),
        AddressPoint(4, "Wadowicka", "8j", "30-415", 9, 19.942, 50.030),
        AddressPoint(5, "Pokoju", "12", "31-548", 14, 20.00, 50.07),
    ]
)


def test_locate():
    # "Pl." in the source, "Aleja" in EMUiA: the street kind only breaks ties
    assert locate("Pl. Powstania Warszawskiego 10, 31-541 Kraków", GEO).hit.emuia_id == 1
    # 8W is not in EMUiA and there is no plain 8: the middle building of the 8a–8j complex
    outcome = locate("ul. Wadowicka 8W, 30-415 Kraków", GEO)
    assert outcome.hit.emuia_id == 3 and outcome.hit.method.endswith("~number")
    # a room number never becomes "Aleja Pokoju 12"
    assert locate("pokój nr 12, 31-548 Kraków", GEO).hit is None
    assert (
        locate("rondo I. Daszyńskiego 1, 00-843 Warszawa", GEO).reason
        == "outside Kraków (postal code 00-843)"
    )


def test_procedures_by_office_sorted_by_symbol_number():
    procedures = [
        {"symbol": "SA-65", "offices": [{"id": "urzad:a"}]},
        {"symbol": "SA-4", "offices": [{"id": "urzad:a"}]},
        {"symbol": "AM-1", "offices": [{"id": "urzad:a"}, {"id": "urzad:b"}]},
        {"symbol": "X-1", "offices": []},
    ]
    assert procedures_by_office(procedures) == {"urzad:a": ["AM-1", "SA-4", "SA-65"], "urzad:b": ["AM-1"]}


def test_office_feature_keeps_b_id_and_reads_the_card():
    office = {
        "id": "urzad:al_powstania_warszawskiego_10",
        "name": "Urząd  Miasta\n\tKrakowa",
        "address": "al. Powstania Warszawskiego 10, 31-541 Kraków",
        "hours": " pn.-pt. 7.40 – 15.30 ",
        "bookingUrl": "https://umawianiewizyt.um.krakow.pl/branch/1",
        "phone": "12 616 55 55",
    }
    outcome = locate(office["address"], GEO)
    f = office_feature(office, outcome, ["SA-34", "SA-65"], {2: "Grzegórzki"})
    p = f["properties"]
    assert p["id"] == "urzad:al_powstania_warszawskiego_10" and p["category"] == "urzad"
    assert p["name"] == "Urząd Miasta Krakowa" and p["district"] == {"number": 2, "name": "Grzegórzki"}
    assert p["attrs"] == {
        "hours": "pn.-pt. 7.40 – 15.30",
        "bookingUrl": "https://umawianiewizyt.um.krakow.pl/branch/1",
        "procedures": "SA-34,SA-65",
        "location": "address",
    }
    assert p["source"] == {
        "dataset": "bip",
        "url": "https://www.bip.krakow.pl/uslugi",
        "updatedAt": None,
    }
    assert f["geometry"]["coordinates"] == [19.96, 50.06]
    outside = {"id": "urzad:rondo", "address": "rondo I. Daszyńskiego 1, 00-843 Warszawa", "name": "Warta"}
    out = locate(outside["address"], GEO)
    assert office_feature(outside, out, [], {}) is None
    report = render_report([(office, outcome), (outside, out)])
    assert "on the map: 1 (address level 1, street level 0); not placed: 1" in report


def test_phones_are_found_formatted_and_deduplicated():
    assert phones("Informacje podstawowe: 12 616 55 55") == "12 616 55 55"
    assert phones("Krakowskie Centrum Kontaktu, tel. +48 12 616 55 55") == "12 616 55 55"
    assert phones("12-291 -29-59") == "12 291 29 59"
    assert phones("12 616 94 34, 12 616 97 96") == "12 616 94 34, 12 616 97 96"
    assert phones("12 20 10 857, 12 20 10 857") == "12 201 08 57"
    assert phones("12 352 44 44, +48 502 930 185") == "12 352 44 44, 502 930 185"
    assert phones(None) is None
    assert phones("zgodnie z informacją na stronie") == "zgodnie z informacją na stronie"
