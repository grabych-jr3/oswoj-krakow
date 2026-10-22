from oswoj_geo.addresses import build
from oswoj_geo.emuia import AddressPoint


def test_addresses_are_grouped_by_street_with_indexes():
    points = [
        AddressPoint(1, "Wielicka", "28", "30-552", 13, 19.9656312, 50.0402219),
        AddressPoint(2, "Wielicka", "28a", "30-552", 13, 19.9663, 50.0388),
        AddressPoint(3, "Wielicka", "1", "30-552", 13, 19.9610, 50.0417),
        AddressPoint(4, "Osiedle Zgody", "2", "31-949", 18, 20.0320, 50.0770),
    ]
    data = build(points, {13: "Podgórze", 18: "Nowa Huta"}, "2026-10-19")
    assert data["source"] == {
        "dataset": "msip-emuia",
        "url": "https://msip.krakow.pl/228340,artykul,katalog-danych.html",
        "updatedAt": "2026-10-19",
    }
    assert data["districts"] == {"13": "Podgórze", "18": "Nowa Huta"}
    assert data["postal"] == ["30-552", "31-949"]
    zgody, wielicka = data["streets"]  # sorted by folded name: "osiedle zgody" < "wielicka"
    assert (zgody["name"], zgody["key"], zgody["kind"]) == ("os. Zgody", "osiedle zgody", "osiedle")
    assert (wielicka["name"], wielicka["key"], wielicka["kind"]) == ("ul. Wielicka", "wielicka", None)
    assert [n[0] for n in wielicka["numbers"]] == ["1", "28", "28a"]  # numeric order
    assert wielicka["numbers"][1] == [
        "28",
        19.96563,
        50.04022,
        0,
        13,
    ]  # 5 decimals, postal and district indexes
    assert wielicka["point"][2] == 13
