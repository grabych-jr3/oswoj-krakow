import httpx

from oswoj_geo.emuia import AddressPoint
from oswoj_geo.geocoder import Geocoder, Outcome
from oswoj_geo.inputs import InputAddress, extract
from oswoj_geo.nominatim import NominatimClient
from oswoj_geo.places import (
    geocode_place,
    load_manual_fixes,
    names_agree,
    nominatim_queries,
    render_report,
    same_street,
)

GEO = Geocoder([
    AddressPoint(1, "Wielicka", "28A", "30-552", 13, 19.9663, 50.0388),
    AddressPoint(2, "Wielicka", "30", "30-552", 13, 19.9670, 50.0385),
])
PRESCHOOL = InputAddress("przedszkola_samorzadowe", "rspo-5034",
                         'SAMORZĄDOWE PRZEDSZKOLE NR 129 "SKRZATY" W KRAKOWIE', "Wielicka", None, "30-552")


class FakeNominatim:
    def __init__(self, results):
        self.results = results
        self.queries = []

    def search(self, query):
        self.queries.append(query)
        return self.results


def osm(name, road, number):
    return {"name": name, "address": {"road": road, "house_number": number}}


def test_queries_strip_city_and_patron():
    assert nominatim_queries(PRESCHOOL) == ["SAMORZĄDOWE PRZEDSZKOLE NR 129, Wielicka, Kraków",
                                            "SKRZATY, Wielicka, Kraków"]


def test_names_agree_requires_the_same_institution():
    assert names_agree("Samorządowe Przedszkole nr 129 Skrzaty", PRESCHOOL.name)
    assert not names_agree("Samorządowe Przedszkole nr 12", PRESCHOOL.name)
    assert not names_agree("Przedszkole Niepubliczne Bajka", 'NIEPUBLICZNE PRZEDSZKOLE "KRASNAL"')
    assert names_agree("Krasnal", 'NIEPUBLICZNE PRZEDSZKOLE "KRASNAL"')


def test_same_street():
    assert same_street("Generała Tadeusza Kutrzeby", "Kutrzeby")
    assert not same_street("Wielicka", "Limanowskiego")


def test_house_number_recovered_from_osm_with_emuia_coordinates():
    nominatim = FakeNominatim([osm("Przedszkole nr 129 Skrzaty", "Wielicka", "28A")])
    outcome = geocode_place(PRESCHOOL, GEO, {}, nominatim)
    assert outcome.is_address and outcome.hit.method == "nominatim+emuia" and outcome.hit.emuia_id == 1


def test_osm_result_for_another_institution_or_street_is_ignored():
    other_institution = osm("Przedszkole nr 7", "Wielicka", "30")
    other_street = osm("Przedszkole nr 129", "Limanowskiego", "4")
    for result in (other_institution, other_street):
        outcome = geocode_place(PRESCHOOL, GEO, {}, FakeNominatim([result]))
        assert outcome.hit.precision == "street" and outcome.reason == "no house number in source"


def test_nominatim_not_asked_when_emuia_suffices():
    nominatim = FakeNominatim([])
    item = InputAddress("biblioteki", "k", "Filia", "Wielicka", "30", None)
    assert geocode_place(item, GEO, {}, nominatim).is_address and nominatim.queries == []


def test_manual_fixes(tmp_path):
    path = tmp_path / "fixes.csv"
    path.write_text("dataset,key,street,number,lon,lat,note\n"
                    "przedszkola_samorzadowe,rspo-5034,,28A,,,number from RSPO website\n"
                    "biblioteki,x,,,19.9,50.0,coords from the library website\n", encoding="utf-8")
    fixes = load_manual_fixes(path)
    outcome = geocode_place(PRESCHOOL, GEO, fixes, None)
    assert outcome.hit.emuia_id == 1 and outcome.hit.method == "manual+exact"
    outcome = geocode_place(InputAddress("biblioteki", "x", "F", "Wielicka", None, None), GEO, fixes, None)
    assert outcome.hit.method == "manual" and (outcome.hit.lon, outcome.hit.lat) == (19.9, 50.0)


def test_nominatim_client_caches_and_throttles(tmp_path):
    calls, sleeps, now = [], [], [100.0]

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.params["q"])
        assert request.url.params["bounded"] == "1"
        return httpx.Response(200, json=[{"name": "x"}])

    client = NominatimClient(httpx.Client(transport=httpx.MockTransport(handler)), tmp_path / "n.json",
                             min_interval_s=1.0, sleep=sleeps.append, clock=lambda: now[0])
    assert client.search("a") == [{"name": "x"}]
    assert client.search("a") == [{"name": "x"}]
    client.search("b")
    assert calls == ["a", "b"] and sleeps == [1.0]
    reloaded = NominatimClient(httpx.Client(transport=httpx.MockTransport(handler)), tmp_path / "n.json")
    assert reloaded.search("a") == [{"name": "x"}] and calls == ["a", "b"]


def test_extractors_read_each_layout():
    record = {"Numer RSPO": 5884, "Nazwa szkoły_placówki": "SP 133", "Ulica": "Mieczysława Wrony",
              "Nr domu": 115, "Kod pocztowy": "30-399"}
    [school] = extract("szkoly_podstawowe_samorzadowe", [record])
    assert (school.key, school.street, school.number) == ("rspo-5884", "Mieczysława Wrony", "115")
    [library] = extract("biblioteki", [{"Nazwa lub numer filii": "Filia nr 1", "Nazwa ulicy": "Dietla",
                                        "Numer budynku": "80", "Kod pocztowy": "31-073"}])
    assert (library.key, library.street, library.number) == ("filia-nr-1", "Dietla", "80")


def test_report_counts_and_target():
    rows = [(PRESCHOOL, geocode_place(PRESCHOOL, GEO, {}, None)),
            (InputAddress("d", "k", "F", "Wielicka", "30", None), GEO.geocode("Wielicka", "30"))]
    report = render_report({"d": rows}, "2025-12-05", nominatim=False)
    assert "| **Total** | **2** | **1** | **0** | **1** | **0** | **50.0%** |" in report
    assert "not met" in report and "no house number in source" in report
    assert isinstance(rows[0][1], Outcome)
