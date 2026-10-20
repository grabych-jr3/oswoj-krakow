from oswoj_geo.emuia import AddressPoint
from oswoj_geo.geocoder import Geocoder
from oswoj_geo.inputs import InputAddress
from oswoj_geo.osm import OsmInstitution, amenities_for, parse_element, same_institution
from oswoj_geo.places import GENERIC_NAME_WORDS, geocode_place


def agree(osm_name: str, source_name: str) -> bool:
    return same_institution(osm_name, source_name, GENERIC_NAME_WORDS)


def test_same_institution():
    assert agree("Bajkowo", 'PRZEDSZKOLE NIEPUBLICZNE "BAJKOWO"')
    assert agree("Samorządowe Przedszkole nr 9", "SAMORZĄDOWE PRZEDSZKOLE NR 9 W KRAKOWIE")
    assert agree("Kącik Świata", "PRZEDSZKOLE NIEPUBLICZNE Z ODDZIAŁAMI INTEGRACYJNYMI KĄCIK ŚWIATA")
    assert not agree("Samorządowe Przedszkole nr 19", "SAMORZĄDOWE PRZEDSZKOLE NR 9 W KRAKOWIE")
    assert not agree("Prywatna Szkoła Podstawowa nr 2", "PRZEDSZKOLE NIEPUBLICZNE NR 2 IM. NOBLISTÓW")
    # every distinctive OSM word must occur in the source name
    assert not agree("Świat Dziecka", 'NIEPUBLICZNE PRZEDSZKOLE "BAJKA"')
    assert not agree("I Prywatne Liceum Ogólnokształcące im. Józefa Piłsudskiego",
                     "PRYWATNA SZKOŁA PODSTAWOWA IM. MARSZAŁKA JÓZEFA PIŁSUDSKIEGO")
    assert not agree("Przedszkole", "NIEPUBLICZNE PRZEDSZKOLE")  # nothing distinctive at all


def test_amenities_and_parsing():
    assert amenities_for("przedszkola_niesamorzadowe") == {"kindergarten"}
    assert amenities_for("szkoly_podstawowe_samorzadowe") == {"school"}
    way = parse_element({"type": "way", "center": {"lon": 19.9, "lat": 50.0},
                         "tags": {"name": "Bajkowo", "amenity": "kindergarten", "addr:street": "Prosta"}})
    assert (way.lon, way.street, way.number) == (19.9, "Prosta", None)


GEO = Geocoder([AddressPoint(1, "Prosta", "35B", "30-814", 10, 19.9000, 50.0000),
                AddressPoint(2, "Prosta", "40", "30-814", 10, 19.9030, 50.0000)])
ITEM = InputAddress("przedszkola_niesamorzadowe", "rspo-1", 'PRZEDSZKOLE NIEPUBLICZNE "BAJKOWO"',
                    "Prosta", None, "30-814")


def test_snaps_to_the_nearest_address_on_the_source_street():
    bajkowo = OsmInstitution("Bajkowo", "kindergarten", None, None, 19.9001, 50.0001)
    outcome = geocode_place(ITEM, GEO, {}, None, [bajkowo])
    assert outcome.is_address and outcome.hit.emuia_id == 1 and outcome.hit.method == "osm+emuia"


def test_uses_the_osm_house_number_when_tagged():
    bajkowo = OsmInstitution("Bajkowo", "kindergarten", "Prosta", "40", 19.95, 50.05)
    assert geocode_place(ITEM, GEO, {}, None, [bajkowo]).hit.emuia_id == 2


def test_rejects_wrong_type_far_objects_and_other_institutions():
    candidates = [
        OsmInstitution("Bajkowo", "school", None, None, 19.9001, 50.0001),  # not a kindergarten
        OsmInstitution("Bajkowo", "kindergarten", None, None, 19.9100, 50.0100),  # > 60 m from Prosta
        OsmInstitution("Krasnal", "kindergarten", None, None, 19.9001, 50.0001),  # another institution
    ]
    outcome = geocode_place(ITEM, GEO, {}, None, candidates)
    assert outcome.hit.precision == "street" and outcome.reason == "no house number in source"
