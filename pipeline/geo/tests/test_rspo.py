import httpx

from oswoj_geo.emuia import AddressPoint
from oswoj_geo.geocoder import Geocoder
from oswoj_geo.inputs import InputAddress
from oswoj_geo.places import geocode_place
from oswoj_geo.rspo import RspoClient

SEATS = {
    "5034": {"hqAddressStreet": "ul. Wielicka", "hqAddressBuildingNr": "76b", "hqAddressZipCode": "30-552"},
    "9999": {"hqAddressStreet": "ul. Armii Krajowej", "hqAddressBuildingNr": "12",
             "hqAddressZipCode": "30-150"},
}


def handler(request: httpx.Request) -> httpx.Response:
    rspo = request.url.path.rsplit("/", 1)[-1]
    return httpx.Response(200, json=SEATS[rspo]) if rspo in SEATS else httpx.Response(404)


def client(tmp_path, sleeps=None, now=(0.0,)):
    return RspoClient(httpx.Client(transport=httpx.MockTransport(handler)), tmp_path / "rspo.json",
                      sleep=(sleeps if sleeps is not None else []).append, clock=lambda: now[0])


GEO = Geocoder([
    AddressPoint(1, "Wielicka", "76b", "30-552", 13, 19.9729, 50.0320),
    AddressPoint(2, "Armii Krajowej", "12", "30-150", 6, 19.8900, 50.0700),
    AddressPoint(3, "Wacława Lipińskiego", "5a", "30-349", 8, 19.9200, 50.0300),
])


def item(rspo: str, street: str) -> InputAddress:
    return InputAddress("przedszkola_samorzadowe", f"rspo-{rspo}", "Przedszkole", street, None, None)


def test_client_reads_seat_caches_throttles_and_remembers_404(tmp_path):
    sleeps: list[float] = []
    rspo = client(tmp_path, sleeps)
    assert rspo.address("5034") == {"street": "ul. Wielicka", "number": "76b", "postal": "30-552"}
    assert rspo.address("1") is None
    assert sleeps == [1.0]
    offline = RspoClient(httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500))),
                         tmp_path / "rspo.json")
    assert offline.address("5034")["number"] == "76b" and offline.address("1") is None


def test_number_from_rspo_on_the_same_street(tmp_path):
    outcome = geocode_place(item("5034", "Wielicka"), GEO, {}, None, None, client(tmp_path))
    assert outcome.is_address and outcome.hit.emuia_id == 1 and outcome.hit.method == "rspo+emuia"


def test_rspo_seat_on_another_street_is_not_used(tmp_path):
    outcome = geocode_place(item("9999", "Wacława Lipińskiego"), GEO, {}, None, None, client(tmp_path))
    assert outcome.hit.precision == "street" and outcome.hit.street == "Wacława Lipińskiego"


def test_rspo_only_for_education_records(tmp_path):
    club = InputAddress("kluby_rodzicow", "klub-x", "Klub", "Wielicka", None, None)
    assert geocode_place(club, GEO, {}, None, None, client(tmp_path)).hit.precision == "street"
