import json

import httpx

from oswoj_geo.fetch import load_table, run
from oswoj_geo.sources import SOURCES, PortalTable


def test_source_names_are_unique():
    names = [s.name for s in SOURCES]
    assert len(names) == len(set(names))


def test_run_caches_and_normalizes(tmp_path):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return httpx.Response(200, json={"value": [{"Telefon": 124117430, "Miejscowość": " Kraków"}]})

    raw, manifest = tmp_path / "raw", tmp_path / "manifest.json"
    client = httpx.Client(transport=httpx.MockTransport(handler))
    assert run(["biblioteki"], refresh=False, skip_large=True, raw_dir=raw, manifest_path=manifest,
               client=client) == 0
    assert len(calls) == 1
    entry = json.loads(manifest.read_text(encoding="utf-8"))["biblioteki"]
    assert entry["records"] == 1
    assert entry["url"].endswith("/opendata-kultura-lista-bibliotek/v1/biblioteka-krakow-filie")
    assert load_table("biblioteki", raw) == [{"Telefon": "12 411 74 30", "Miejscowość": "Kraków"}]

    # second run uses the cache
    client = httpx.Client(transport=httpx.MockTransport(handler))
    assert run(["biblioteki"], refresh=False, skip_large=True, raw_dir=raw, manifest_path=manifest,
               client=client) == 0
    assert len(calls) == 1


def test_run_reports_failures(tmp_path):
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    status = run(["biblioteki"], refresh=True, skip_large=True, raw_dir=tmp_path,
                 manifest_path=tmp_path / "m.json", client=client)
    assert status == 1
    assert not (tmp_path / "m.json").exists()


def test_all_portal_tables_point_to_the_public_api():
    for source in SOURCES:
        if isinstance(source, PortalTable):
            assert source.api.startswith("opendata-")
