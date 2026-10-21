import httpx
import pytest

from oswoj_geo.arcgis import fetch_layer
from oswoj_geo.portal import PortalClient, PortalError, public_next_url

API = "opendata-test"
TABLE = "tabela"
BASE = f"https://api.um.krakow.pl/{API}/v1/{TABLE}"


def test_next_link_is_rewritten_to_public_host():
    internal = "https://srv-app-querona:8092/api/tabela?$after=W3siRW50aXR5In1d"
    assert public_next_url(internal, API, TABLE) == f"{BASE}?$after=W3siRW50aXR5In1d"


def test_next_link_without_cursor_fails():
    with pytest.raises(PortalError):
        public_next_url("https://srv-app-querona:8081/api/tabela", API, TABLE)


def portal_handler(request: httpx.Request) -> httpx.Response:
    assert request.url.host == "api.um.krakow.pl"
    after = request.url.params.get("$after")
    if after is None:
        body = {"value": [{"Lp": i} for i in range(1, 101)],
                "nextLink": "https://srv-app-querona:8081/api/tabela?$after=p2"}
    elif after == "p2":
        body = {"value": [{"Lp": 101}, {"Lp": 102}]}
    else:
        return httpx.Response(400)
    return httpx.Response(200, json=body)


def test_fetch_table_follows_pages():
    with httpx.Client(transport=httpx.MockTransport(portal_handler)) as client:
        records = PortalClient(client).fetch_table(API, TABLE)
    assert [r["Lp"] for r in records] == list(range(1, 103))


def test_fetch_table_raises_on_http_error():
    transport = httpx.MockTransport(lambda r: httpx.Response(404, json={"code": "404"}))
    with httpx.Client(transport=transport) as client, pytest.raises(PortalError):
        PortalClient(client).fetch_table(API, TABLE)


def test_arcgis_paginates_by_offset():
    def handler(request: httpx.Request) -> httpx.Response:
        if not request.url.path.endswith("/query"):
            return httpx.Response(200, json={"objectIdField": "FID"})
        assert request.url.params["orderByFields"] == "FID"
        offset = int(request.url.params["resultOffset"])
        size = int(request.url.params["resultRecordCount"])
        ids = [i for i in range(offset, min(offset + size, 5))]
        features = [{"type": "Feature", "id": i, "geometry": None, "properties": {}} for i in ids]
        return httpx.Response(200, json={"type": "FeatureCollection", "features": features,
                                         "properties": {"exceededTransferLimit": offset + size < 5}})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        collection = fetch_layer(client, "https://example.test/FeatureServer/0", page_size=2)
    assert [f["id"] for f in collection["features"]] == [0, 1, 2, 3, 4]
