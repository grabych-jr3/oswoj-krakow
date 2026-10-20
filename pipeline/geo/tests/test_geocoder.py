import pytest

from oswoj_geo.emuia import AddressPoint, parse_emuia
from oswoj_geo.geocoder import Geocoder


def point(i: int, street: str, number: str, postal: str = "30-552", lon: float = 19.96, lat: float = 50.04):
    return AddressPoint(i, street, number, postal, 13, lon, lat)


POINTS = [
    point(1, "Wielicka", "28", lon=19.9656),
    point(2, "Wielicka", "28A", lon=19.9663),
    point(3, "Generała Tadeusza Kutrzeby", "6", "30-515"),
    point(4, "Osiedle Zgody", "2", "31-949"),
    point(5, "Zgody", "2", "31-000"),
    point(6, "Józefa Dietla", "80/82", "31-073"),
    point(7, "Osiedle Oświecenia", "1", "31-636"),
    point(8, "Osiedle Centrum E", "14", "31-934"),
    point(9, "Jana Kasprowicza", "29", "31-523"),
    point(10, "Antoniego Kasprowicza", "29", "34-000"),  # same surname, same number, other street
    point(11, "Wielicka", "30", lon=19.9670),
]
geo = Geocoder(POINTS)


def test_exact_and_letter_numbers():
    hit = geo.geocode("ul. Wielicka", "28A").hit
    assert hit and hit.emuia_id == 2 and hit.precision == "address" and hit.method == "exact"


def test_partial_street_name():
    hit = geo.geocode("Kutrzeby", 6).hit
    assert hit and hit.emuia_id == 3 and hit.method == "partial"


def test_fuzzy_street_name():
    hit = geo.geocode("Wielicks", "28").hit
    assert hit and hit.emuia_id == 1 and hit.method == "fuzzy"


def test_street_kind_decides():
    assert geo.geocode("os. Zgody", "2").hit.emuia_id == 4
    assert geo.geocode("Zgody", "2").hit.emuia_id == 5


def test_postal_breaks_ties_but_never_rejects():
    assert geo.geocode("Kasprowicza", "29", "31-523").hit.emuia_id == 9
    assert geo.geocode("Kasprowicza", "29", "34-000").hit.emuia_id == 10
    for postal in ("99-999", None):  # two streets fit equally: no guess
        outcome = geo.geocode("Kasprowicza", "29", postal)
        assert outcome.hit is None and outcome.reason.startswith("ambiguous street")
    assert geo.geocode("Kutrzeby", 6, "99-999").hit.emuia_id == 3  # a wrong postal code alone never rejects


def test_composite_letter_prefixed_and_approximate_numbers():
    assert geo.geocode("Dietla", "80").hit.emuia_id == 6
    assert geo.geocode("Osiedle Centrum", "E14").hit.emuia_id == 8
    hit = geo.geocode("Osiedle Oświecenia", "1A").hit
    assert hit.emuia_id == 7 and hit.method.endswith("~number")


def test_number_in_street_field():
    assert geo.geocode("Wielicka 28A/LU 3", None).hit.emuia_id == 2


def test_street_level_with_reason():
    outcome = geo.geocode("Wielicka", None)
    assert outcome.hit and outcome.hit.precision == "street" and outcome.hit.emuia_id is None
    assert outcome.reason == "no house number in source"
    outcome = geo.geocode("Wielicka", "101")
    assert outcome.hit.precision == "street" and outcome.reason == "number 101 not in EMUiA"


def test_not_found():
    assert geo.geocode("Nieistniejąca", "1").hit is None
    assert geo.geocode(None, "1").reason == "no street in source"


def test_parse_emuia_reprojects_and_checks_crs():
    collection = {
        "crs": {"properties": {"name": "EPSG:2178"}},
        "features": [{"geometry": {"coordinates": [7425000.0, 5545000.0]},
                      "properties": {"id": 1, "nazwa_ulicy": "Wielicka", "numer_adresowy": "28",
                                     "kod_pocztowy": "30-552", "numer_dzielnicy": "13"}}],
    }
    [p] = parse_emuia(collection)
    assert 19.8 < p.lon < 20.2 and 49.9 < p.lat < 50.2 and p.district == 13
    with pytest.raises(ValueError):
        parse_emuia({**collection, "crs": {"properties": {"name": "EPSG:4326"}}})
