"""``uv run geo-isochrones`` — ZTP walking isochrones to KMK stops as one city layer (A8b).

ZTP publishes, for each of ~820 stops, the area within 100–500 m on foot (network analysis).
They are merged per distance into bands — up to 100 m, 100–200 m, … 400–500 m from the nearest
stop — clipped to Kraków and sampled on H3 cells (res 10, ~65 m) for
``app/public/data/layers/stop-isochrones.json``: ``{res, levels, source, cells: [[h3, toM], …]}``.
Network isochrones are ragged polygons (5 MB even simplified); the cells weigh a few hundred KB.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union

from .access import city_shape
from .fetch import RAW_DIR
from .layers import LAYERS_DIR, source_ref

SOURCE = RAW_DIR / "izochrony_kmk.geojson"
OUT = LAYERS_DIR / "stop-isochrones.json"
METRIC = "EPSG:2180"  # Poland CS92, metres
CELL_RES = 10  # ~65 m edge, fine for 100 m bands
WALK_M_PER_MIN = 80  # as the 15-minute analysis


def bands(collection: dict[str, Any], city: Any) -> list[tuple[int, int, Any]]:
    """(from_m, to_m, polygon in metres) per distance band, inside the city."""
    to_metric = Transformer.from_crs("EPSG:4326", METRIC, always_xy=True).transform
    city_m = transform(to_metric, city)
    by_level: dict[int, list[Any]] = {}
    for f in collection["features"]:
        if f.get("geometry"):
            by_level.setdefault(int(f["properties"]["cost_level"]), []).append(
                transform(to_metric, shape(f["geometry"])).buffer(0)
            )
    out, inner, previous = [], None, 0
    for level in sorted(by_level):
        covered = unary_union(by_level[level] + ([inner] if inner is not None else [])).intersection(city_m)
        band = covered.difference(inner) if inner is not None else covered
        out.append((previous, level, band))
        inner, previous = covered, level
    return out


def polygons(geometry: Any) -> list[Any]:
    parts = [geometry] if geometry.geom_type == "Polygon" else list(getattr(geometry, "geoms", []))
    return [p for p in parts if p.geom_type == "Polygon" and not p.is_empty]


def build(source: Path = SOURCE) -> tuple[dict[str, Any], dict[str, float]]:
    import h3

    city = city_shape()
    raw = bands(json.loads(source.read_text(encoding="utf-8")), city)
    to_wgs = Transformer.from_crs(METRIC, "EPSG:4326", always_xy=True).transform
    city_area = transform(Transformer.from_crs("EPSG:4326", METRIC, always_xy=True).transform, city).area
    band_of: dict[str, int] = {}
    shares: dict[str, float] = {}
    cumulative = 0.0
    for _start, end, band in raw:
        cumulative += band.area
        shares[f"≤{end} m"] = cumulative / city_area
        for poly in polygons(transform(to_wgs, band)):
            outer = [(y, x) for x, y in poly.exterior.coords]
            holes = [[(y, x) for x, y in ring.coords] for ring in poly.interiors]
            for cell in h3.polygon_to_cells(h3.LatLngPoly(outer, *holes), CELL_RES):
                band_of.setdefault(cell, end)  # bands are disjoint; keep the nearer one on a shared edge
    layer = {
        "res": CELL_RES,
        "levels": [end for _, end, _ in raw],
        "walkMetresPerMinute": WALK_M_PER_MIN,
        "source": source_ref("izochrony_kmk"),
        "cells": sorted([cell, metres] for cell, metres in band_of.items()),
    }
    return layer, shares


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(description="ZTP walking isochrones to KMK stops as one layer").parse_args(argv)
    layer, shares = build()
    OUT.write_text(json.dumps(layer, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT} ({OUT.stat().st_size // 1024} KB, {len(layer['cells'])} cells)")
    for label, share in shares.items():
        print(f"  city area within {label} of a KMK stop on foot: {share:.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
