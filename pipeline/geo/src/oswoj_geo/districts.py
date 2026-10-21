"""``uv run geo-districts`` — the 18 districts with population and place counts (PLAN.md §6.A, A4).

Boundaries: MSIP ``Dzielnice_JSON.zip`` (EPSG:2178), simplified as a coverage so neighbours keep
one shared border. Stats per district (31.12.2025): residents = registered permanent + temporary,
foreigners likewise, top citizenships, and places per category from the A3 layers.
Outputs ``app/public/data/layers/districts.geojson`` (map) and ``app/data/geo/districts.json``
(server: ``getDistrict``), both a FeatureCollection whose properties are ``DistrictStats``.
"""

import argparse
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely import coverage_simplify
from shapely.geometry import mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform

from .fetch import PIPELINE_DIR, RAW_DIR, load_table
from .layers import LAYERS_DIR

DISTRICTS_ZIP = RAW_DIR / "Dzielnice_JSON.zip"
SERVER_FILE = PIPELINE_DIR.parents[1] / "app" / "data" / "geo" / "districts.json"
REPORT = PIPELINE_DIR / "reports" / "districts.md"
SIMPLIFY_M = 5
TOP_CITIZENSHIPS = 5
NOT_A_CITIZENSHIP = {"INNE KRAJE", "NIEUSTALONE", "BEZPAŃSTWOWCY"}  # aggregate rows, not countries

# district tables (by district) and the detailed tables of the same population, for the cross-check
RESIDENTS = ("mieszkancy_staly", "mieszkancy_czasowy")
FOREIGNERS = ("cudzoziemcy_staly", "cudzoziemcy_czasowy")
DETAILED = {
    "mieszkancy_staly": "mieszkancy_staly_szczegoly",
    "mieszkancy_czasowy": "mieszkancy_czasowy_szczegoly",
    "cudzoziemcy_staly": "cudzoziemcy_staly_szczegoly",
    "cudzoziemcy_czasowy": "cudzoziemcy_czasowy_szczegoly",
}

_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50}


def roman_to_int(text: str) -> int:
    values = [_ROMAN[c] for c in text.strip().upper()]
    return sum(-v if i + 1 < len(values) and v < values[i + 1] else v for i, v in enumerate(values))


def country_name(raw: str) -> str:
    """ "BOŚNIA I HERCEGOWINA" → "Bośnia i Hercegowina", "TAJWAN (TAIWAN)" → "Tajwan (Taiwan)"."""

    def word(match: re.Match[str]) -> str:
        w = match.group(0).lower()
        return w if w in {"i", "w", "z"} and match.start() > 0 else w[:1].upper() + w[1:]

    return re.sub(r"[^\W\d_]+", word, raw.strip())


def load_boundaries(
    zip_path: Path = DISTRICTS_ZIP, tolerance_m: float = SIMPLIFY_M
) -> dict[int, tuple[str, Any]]:
    """District number → (name, polygon in EPSG:4326), simplified with shared borders kept identical."""
    with zipfile.ZipFile(zip_path) as archive:
        collection = json.loads(archive.read("Dzielnice.geojson"))
    crs = collection.get("crs", {}).get("properties", {}).get("name")
    if crs != "EPSG:2178":
        raise ValueError(f"districts CRS changed: {crs}")
    features = collection["features"]
    simplified = coverage_simplify([shape(f["geometry"]) for f in features], tolerance_m)
    to_wgs84 = Transformer.from_crs("EPSG:2178", "EPSG:4326", always_xy=True).transform
    out: dict[int, tuple[str, Any]] = {}
    for feature, geom in zip(features, simplified, strict=True):
        number = roman_to_int(feature["properties"]["nr_dzielni"])
        out[number] = (feature["properties"]["nazwa"].strip(), orient(transform(to_wgs84, geom), 1.0))
    if sorted(out) != list(range(1, 19)):
        raise ValueError(f"expected districts 1..18, got {sorted(out)}")
    return out


def sum_by_district(tables: tuple[str, ...]) -> dict[int, int]:
    totals: dict[int, int] = defaultdict(int)
    for table in tables:
        for r in load_table(table):
            totals[int(r["Nr_Dzielnicy"])] += int(r["Liczba_osób"])
    return dict(totals)


def citizenships_by_district() -> dict[int, Counter[str]]:
    counts: dict[int, Counter[str]] = defaultdict(Counter)
    for table in FOREIGNERS:
        for r in load_table(table):
            if r["Obywatelstwo"] not in NOT_A_CITIZENSHIP:
                counts[int(r["Nr_Dzielnicy"])][r["Obywatelstwo"]] += int(r["Liczba_osób"])
    return counts


def place_counts(layers_dir: Path = LAYERS_DIR) -> dict[int, dict[str, int]]:
    """Places per district and category, from the category layers listed in index.json."""
    index = json.loads((layers_dir / "index.json").read_text(encoding="utf-8"))
    counts: dict[int, dict[str, int]] = defaultdict(dict)
    for entry in index["categories"]:
        layer = json.loads((layers_dir / f"{entry['category']}.geojson").read_text(encoding="utf-8"))
        for f in layer["features"]:
            district = f["properties"].get("district")
            if district:
                per = counts[district["number"]]
                per[entry["category"]] = per.get(entry["category"], 0) + 1
    return counts


def cross_check() -> list[tuple[str, int, int]]:
    """(table, sum by district, sum of the detailed table of the same population)."""
    rows = []
    for table, detailed in DETAILED.items():
        by_district = sum(int(r["Liczba_osób"]) for r in load_table(table))
        detail = sum(int(r["Liczba_osób"] or 0) for r in load_table(detailed))
        rows.append((table, by_district, detail))
    return rows


def build(layers_dir: Path = LAYERS_DIR) -> dict[str, Any]:
    boundaries = load_boundaries()
    residents = sum_by_district(RESIDENTS)
    foreigners = sum_by_district(FOREIGNERS)
    citizenships = citizenships_by_district()
    places = place_counts(layers_dir)
    features = []
    for number, (name, geom) in sorted(boundaries.items()):
        top = sorted(citizenships.get(number, Counter()).items(), key=lambda kv: (-kv[1], kv[0]))[
            :TOP_CITIZENSHIPS
        ]
        properties = {
            "number": number,
            "name": name,
            "residents": residents.get(number),
            "foreigners": foreigners.get(number),
            "topCitizenships": [{"name": country_name(n), "count": c} for n, c in top],
            "placeCounts": dict(sorted(places.get(number, {}).items())),
        }
        geometry = json.loads(json.dumps(mapping(geom)))  # tuples → lists
        geometry["coordinates"] = [
            [[round(x, 6), round(y, 6)] for x, y in ring] for ring in geometry["coordinates"]
        ]
        features.append({"type": "Feature", "geometry": geometry, "properties": properties})
    return {"type": "FeatureCollection", "features": features}


def render_report(collection: dict[str, Any], checks: list[tuple[str, int, int]]) -> str:
    lines = [
        "# Districts (A4)",
        "",
        "Generated by `uv run geo-districts`. Boundaries: MSIP Dzielnice (EPSG:2178 → 4326, "
        f"coverage-simplified {SIMPLIFY_M} m). Population: registered residents and foreigners, "
        "31.12.2025 (permanent + temporary).",
        "",
        "| No. | District | Residents | Foreigners | Top citizenships | Places |",
        "|---:|---|---:|---:|---|---:|",
    ]
    for f in collection["features"]:
        p = f["properties"]
        top = ", ".join(f"{c['name']} {c['count']}" for c in p["topCitizenships"][:3])
        lines.append(
            f"| {p['number']} | {p['name']} | {p['residents']} | {p['foreigners']} | {top} "
            f"| {sum(p['placeCounts'].values())} |"
        )
    total_res = sum(f["properties"]["residents"] or 0 for f in collection["features"])
    total_for = sum(f["properties"]["foreigners"] or 0 for f in collection["features"])
    lines += [
        f"| | **Kraków** | **{total_res}** | **{total_for}** | | |",
        "",
        "## Cross-check with the source",
        "",
        "Each district table is summed and compared with the detailed table of the same population "
        "(by birth year or by registration year) published on the portal.",
        "",
        "| Table | Sum by district | Detailed table | Match |",
        "|---|---:|---:|---|",
        *[f"| {t} | {a} | {b} | {'yes' if a == b else '**NO**'} |" for t, a, b in checks],
    ]
    return "\n".join(lines) + "\n"


def write(collection: dict[str, Any], public_dir: Path = LAYERS_DIR, server_file: Path = SERVER_FILE) -> None:
    body = ",\n".join(
        json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in collection["features"]
    )
    text = '{"type":"FeatureCollection","features":[\n' + body + "\n]}\n"
    public_dir.mkdir(parents=True, exist_ok=True)
    (public_dir / "districts.geojson").write_text(text, encoding="utf-8")
    server_file.parent.mkdir(parents=True, exist_ok=True)
    server_file.write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(
        description="Build district boundaries with stats (run geo-layers first)"
    ).parse_args(argv)
    collection = build()
    checks = cross_check()
    write(collection)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(collection, checks), encoding="utf-8")
    for table, a, b in checks:
        print(f"{table:22} by district {a:7}  detailed {b:7}  {'ok' if a == b else 'MISMATCH'}")
    print(f"{len(collection['features'])} districts → {LAYERS_DIR / 'districts.geojson'}, {SERVER_FILE}")
    return 0 if all(a == b for _, a, b in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
