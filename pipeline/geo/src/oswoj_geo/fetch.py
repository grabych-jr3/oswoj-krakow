"""``uv run geo-fetch`` — download every stream A source into ``.cache/raw`` (PLAN.md §6.A, A1).

Cached files are reused unless ``--refresh``. ``.cache/manifest.json`` records what was
fetched, when, from where, and how many records — the input for docs/tech/dane.md.
"""

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from .arcgis import fetch_layer
from .normalize import normalize_record
from .portal import PortalClient, make_client, table_url
from .sources import BY_NAME, SOURCES, ArcGisLayer, FileDownload, PortalTable, Source

PIPELINE_DIR = Path(__file__).resolve().parents[2]
CACHE_DIR = PIPELINE_DIR / ".cache"
RAW_DIR = CACHE_DIR / "raw"
MANIFEST = CACHE_DIR / "manifest.json"


def raw_path(source: Source, raw_dir: Path = RAW_DIR) -> Path:
    if isinstance(source, FileDownload):
        return raw_dir / source.filename
    suffix = ".geojson" if isinstance(source, ArcGisLayer) else ".json"
    return raw_dir / f"{source.name}{suffix}"


def source_url(source: Source) -> str:
    return table_url(source.api, source.table) if isinstance(source, PortalTable) else source.url


def load_table(name: str, raw_dir: Path = RAW_DIR) -> list[dict[str, Any]]:
    """Normalized records of a cached portal table (run ``geo-fetch`` first)."""
    source = BY_NAME[name]
    if not isinstance(source, PortalTable):
        raise TypeError(f"{name} is not a portal table")
    records = json.loads(raw_path(source, raw_dir).read_text(encoding="utf-8"))
    return [normalize_record(r) for r in records]


def _write_json(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def _download(client: httpx.Client, url: str, path: Path) -> int:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with client.stream("GET", url) as response:
        response.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in response.iter_bytes(1 << 20):
                f.write(chunk)
    tmp.replace(path)
    return path.stat().st_size


def fetch_source(client: httpx.Client, source: Source, path: Path) -> dict[str, Any]:
    """Download one source to ``path``; returns its manifest entry (without timestamps)."""
    if isinstance(source, PortalTable):
        records = PortalClient(client).fetch_table(source.api, source.table)
        _write_json(path, records)
        return {"records": len(records)}
    if isinstance(source, ArcGisLayer):
        collection = fetch_layer(client, source.url)
        _write_json(path, collection)
        return {"records": len(collection["features"])}
    return {"bytes": _download(client, source.url, path)}


def run(names: list[str] | None, refresh: bool, skip_large: bool, raw_dir: Path = RAW_DIR,
        manifest_path: Path = MANIFEST, client: httpx.Client | None = None) -> int:
    selected = [BY_NAME[n] for n in names] if names else list(SOURCES)
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = (
        json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    )
    failures = 0
    with client or make_client() as http:
        for source in selected:
            path = raw_path(source, raw_dir)
            if isinstance(source, FileDownload) and source.large and skip_large:
                print(f"skip   {source.name} (large)")
                continue
            if path.exists() and not refresh:
                print(f"cached {source.name}")
                continue
            try:
                entry = fetch_source(http, source, path)
            except Exception as error:  # report and keep going; the exit code shows the failure
                failures += 1
                print(f"FAIL   {source.name}: {error}", file=sys.stderr)
                continue
            manifest[source.name] = {
                "url": source_url(source),
                "file": path.name,
                "fetchedAt": datetime.now(UTC).isoformat(timespec="seconds"),
                **entry,
            }
            print(f"ok     {source.name} {entry}")
            _write_json(manifest_path, manifest)
    return 1 if failures else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Download stream A raw data into .cache/raw")
    parser.add_argument("names", nargs="*", metavar="NAME",
                        help=f"sources to fetch (default: all). Known: {', '.join(BY_NAME)}")
    parser.add_argument("--refresh", action="store_true", help="re-download cached sources")
    parser.add_argument("--skip-large", action="store_true", help="skip the OSM PBF (~hundreds of MB)")
    args = parser.parse_args(argv)
    unknown = [n for n in args.names if n not in BY_NAME]
    if unknown:
        parser.error(f"unknown source(s): {', '.join(unknown)}")
    return run(args.names or None, args.refresh, args.skip_large)


if __name__ == "__main__":
    sys.exit(main())
