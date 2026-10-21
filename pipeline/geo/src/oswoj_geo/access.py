"""``uv run geo-access`` — what is reachable in 15 minutes from every part of Kraków (PLAN.md §6.A, A8).

H3 cells (res 9, ~0.1 km²) cover the city. r5py routes from every cell centre to every place of the
map layers and to every other cell centre, on foot and by public transport + walking (OSM + GTFS
A/T/M, Tuesday 08:00, 30-minute departure window, median). Kept: everything within 15 minutes.

Outputs (read by app/src/server/geo/access.ts):
- ``app/data/geo/places.json``  — every place of the layers, the order the indexes refer to;
- ``app/data/geo/access.json``  — per cell and mode: reachable cells and places with minutes;
- ``app/public/data/layers/access-index.json`` — ``{res, cells: [[h3, scoreWalk, scoreTransit]]}``;
- ``reports/access.md`` — coverage, score distribution and the control addresses.
"""

import argparse
import datetime as dt
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

from shapely.geometry import shape
from shapely.ops import unary_union

from .districts import SERVER_FILE as DISTRICTS_FILE
from .fetch import PIPELINE_DIR, RAW_DIR
from .layers import LAYERS_DIR

H3_RES = 9
MINUTES = 15
DEPARTURE = dt.datetime(2026, 10, 27, 8, 0)  # a regular Tuesday inside all three GTFS calendars
WINDOW = dt.timedelta(minutes=30)
WALK_KMH = 4.8  # 80 m/min
BATCH = 400
OSM_PBF = RAW_DIR / "malopolskie-latest.osm.pbf"
GTFS = [RAW_DIR / f"GTFS_KRK_{f}.zip" for f in ("A", "T", "M")]
APP_DATA = PIPELINE_DIR.parents[1] / "app" / "data" / "geo"
REPORT = PIPELINE_DIR / "reports" / "access.md"

# «Indeks 15 minut» (PLAN.md §4.3): 100 × groups present / 6
SCORE_GROUPS: dict[str, tuple[str, ...]] = {
    "zlobek": ("zlobek", "klub_dzieciecy"),
    "przedszkole": ("przedszkole",),
    "szkola_podstawowa": ("szkola_podstawowa",),
    "park": ("park", "park_kieszonkowy"),
    "biblioteka": ("biblioteka",),
    "przystanek": ("przystanek",),
}

# Control addresses for the plausibility check (A8 criterion)
CONTROL = {
    "ul. Wielicka 28 (Podgórze)": (19.965631, 50.040222),
    "Rynek Główny (Stare Miasto)": (19.9373, 50.0617),
    "pl. Centralny (Nowa Huta)": (20.0377, 50.0716),
    "Kurdwanów (Podgórze Duchackie)": (19.955, 50.012),
    "Tyniec (Dębniki, edge of the city)": (19.8227, 50.0185),
}


def ensure_java() -> None:
    """r5py needs a JDK 21+; on Windows point JAVA_HOME at an installed JDK if it is not set."""
    if os.environ.get("JAVA_HOME"):
        return
    for base in (Path("C:/Program Files/Java"), Path("C:/Program Files/Eclipse Adoptium")):
        jdks = sorted(base.glob("jdk*"), reverse=True) if base.exists() else []
        if jdks:
            os.environ["JAVA_HOME"] = str(jdks[0])
            return


def city_shape(districts_file: Path = DISTRICTS_FILE) -> Any:
    collection = json.loads(districts_file.read_text(encoding="utf-8"))
    return unary_union([shape(f["geometry"]) for f in collection["features"]])


def city_cells(districts_file: Path = DISTRICTS_FILE) -> list[str]:
    import h3

    city = city_shape(districts_file)
    polygons = [city] if city.geom_type == "Polygon" else list(city.geoms)
    cells: set[str] = set()
    for poly in polygons:
        outer = [(y, x) for x, y in poly.exterior.coords]
        holes = [[(y, x) for x, y in ring.coords] for ring in poly.interiors]
        cells |= set(h3.polygon_to_cells(h3.LatLngPoly(outer, *holes), H3_RES))
    return sorted(cells)


def load_places(layers_dir: Path = LAYERS_DIR) -> list[dict[str, Any]]:
    """Every place of the category layers as a Place (coords back in), in a stable order."""
    index = json.loads((layers_dir / "index.json").read_text(encoding="utf-8"))
    places = []
    for entry in index["categories"]:
        layer = json.loads((layers_dir / f"{entry['category']}.geojson").read_text(encoding="utf-8"))
        for f in layer["features"]:
            places.append({**f["properties"], "coords": f["geometry"]["coordinates"]})
    return sorted(places, key=lambda p: p["id"])


def score(categories: set[str]) -> tuple[int, list[str]]:
    missing = [g for g, cats in SCORE_GROUPS.items() if not categories & set(cats)]
    return round(100 * (len(SCORE_GROUPS) - len(missing)) / len(SCORE_GROUPS)), missing


def compute(cells: list[str], places: list[dict[str, Any]]) -> dict[str, dict[int, dict[str, list]]]:
    """mode → origin cell index → {"c": [cell idx…], "p": [[place idx, minutes]…]}."""
    ensure_java()
    import geopandas as gpd
    import h3
    import r5py
    from shapely.geometry import Point

    network = r5py.TransportNetwork(str(OSM_PBF), [str(g) for g in GTFS])
    cell_points = [Point(lng, lat) for lat, lng in (h3.cell_to_latlng(c) for c in cells)]
    destinations = gpd.GeoDataFrame(
        {"id": [f"c{i}" for i in range(len(cells))] + [f"p{i}" for i in range(len(places))]},
        geometry=cell_points + [Point(*p["coords"]) for p in places],
        crs="EPSG:4326",
    )
    modes = {
        "walk": [r5py.TransportMode.WALK],
        "transit": [r5py.TransportMode.TRANSIT, r5py.TransportMode.WALK],
    }
    out: dict[str, dict[int, dict[str, list]]] = {}
    for mode, transport in modes.items():
        reach: dict[int, dict[str, list]] = defaultdict(lambda: {"c": [], "p": []})
        started = time.time()
        for start in range(0, len(cells), BATCH):
            ids = range(start, min(start + BATCH, len(cells)))
            origins = gpd.GeoDataFrame(
                {"id": [f"o{i}" for i in ids]}, geometry=[cell_points[i] for i in ids], crs="EPSG:4326"
            )
            matrix = r5py.TravelTimeMatrix(
                network,
                origins=origins,
                destinations=destinations,
                transport_modes=transport,
                departure=DEPARTURE,
                departure_time_window=WINDOW,
                max_time=dt.timedelta(minutes=MINUTES),
                speed_walking=WALK_KMH,
            )
            matrix = matrix[matrix["travel_time"].notna() & (matrix["travel_time"] <= MINUTES)]
            for from_id, to_id, minutes in matrix[["from_id", "to_id", "travel_time"]].itertuples(
                index=False
            ):
                origin = int(from_id[1:])
                if to_id[0] == "c":
                    reach[origin]["c"].append(int(to_id[1:]))
                else:
                    reach[origin]["p"].append([int(to_id[1:]), int(minutes)])
            done = min(start + BATCH, len(cells))
            print(f"  {mode}: {done}/{len(cells)} cells, {time.time() - started:.0f} s", flush=True)
        for r in reach.values():
            r["c"].sort()
            r["p"].sort(key=lambda pm: (pm[1], pm[0]))
        out[mode] = dict(reach)
    return out


def write_outputs(
    cells: list[str],
    places: list[dict[str, Any]],
    reach: dict[str, dict[int, dict[str, list]]],
    method: str,
    app_data: Path = APP_DATA,
    layers_dir: Path = LAYERS_DIR,
) -> dict[str, Any]:
    app_data.mkdir(parents=True, exist_ok=True)
    layers_dir.mkdir(parents=True, exist_ok=True)
    (app_data / "places.json").write_text(
        "[\n"
        + ",\n".join(json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in places)
        + "\n]\n",
        encoding="utf-8",
    )
    payload = {
        "res": H3_RES,
        "minutes": MINUTES,
        "method": method,
        "cells": cells,
        "modes": {
            mode: [reach[mode].get(i, {"c": [], "p": []}) for i in range(len(cells))] for mode in reach
        },
    }
    (app_data / "access.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    index_cells = []
    for i, cell in enumerate(cells):
        row: list[Any] = [cell]
        for mode in ("walk", "transit"):
            cats = {places[p]["category"] for p, _ in reach[mode].get(i, {"p": []})["p"]}
            row.append(score(cats)[0])
        index_cells.append(row)
    (layers_dir / "access-index.json").write_text(
        json.dumps(
            {"res": H3_RES, "minutes": MINUTES, "method": method, "cells": index_cells}, separators=(",", ":")
        ),
        encoding="utf-8",
    )
    return payload


def render_report(payload: dict[str, Any], places: list[dict[str, Any]]) -> str:
    import h3

    cells = payload["cells"]
    index = {c: i for i, c in enumerate(cells)}
    lines = [
        "# 15 minutes (A8)",
        "",
        f"Generated by `uv run geo-access`. {payload['method']}.",
        "",
        f"- Grid: {len(cells)} H3 cells (res {payload['res']}), {len(places)} places",
        "",
    ]
    lines += [
        "| Mode | Cells reaching ≥1 place | Median places | Median cells in zone | Score 100 | Score ≤ 50 |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for mode, reach in payload["modes"].items():
        n_places = sorted(len(r["p"]) for r in reach)
        n_cells = sorted(len(r["c"]) for r in reach)
        scores = [score({places[p]["category"] for p, _ in r["p"]})[0] for r in reach]
        lines.append(
            f"| {mode} | {sum(1 for n in n_places if n)} | {n_places[len(n_places) // 2]} | "
            f"{n_cells[len(n_cells) // 2]} | {scores.count(100)} | {sum(1 for s in scores if s <= 50)} |"
        )
    lines += [
        "",
        "## Control addresses",
        "",
        "Nearest place of each base group (minutes); missing groups lower «Indeks 15 minut».",
        "",
    ]
    for name, (lng, lat) in CONTROL.items():
        i = index.get(h3.latlng_to_cell(lat, lng, payload["res"]))
        lines.append(f"### {name}")
        if i is None:
            lines += ["", "outside the grid", ""]
            continue
        lines += [
            "",
            "| Mode | Score | Places | Zone cells | Nearest per group | Missing |",
            "|---|---:|---:|---:|---|---|",
        ]
        for mode, reach in payload["modes"].items():
            r = reach[i]
            found = {places[p]["category"]: (places[p]["name"], m) for p, m in reversed(r["p"])}
            value, missing = score(set(found))
            best = {
                g: min((found[c] for c in cats if c in found), key=lambda nm: nm[1])
                for g, cats in SCORE_GROUPS.items()
                if any(c in found for c in cats)
            }
            nearest = "; ".join(f"{g}: {n} {m} min" for g, (n, m) in best.items())
            lines.append(
                f"| {mode} | {value} | {len(r['p'])} | {len(r['c'])} | {nearest} | {', '.join(missing)} |"
            )
        lines.append("")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="15-minute reachability on an H3 grid (after all layers)")
    parser.add_argument(
        "--report-only", action="store_true", help="rebuild reports/access.md from the outputs"
    )
    parser.add_argument(
        "--engine",
        choices=("r5py", "osmnx"),
        default="r5py",
        help="osmnx: walking-only fallback without Java (A8b); transit repeats the walking reach",
    )
    parser.add_argument(
        "--out", type=Path, help="write the data here instead of app/ (e.g. to compare engines)"
    )
    args = parser.parse_args(argv)
    if args.report_only:
        payload = json.loads((APP_DATA / "access.json").read_text(encoding="utf-8"))
        places = json.loads((APP_DATA / "places.json").read_text(encoding="utf-8"))
        REPORT.write_text(render_report(payload, places), encoding="utf-8")
        return 0
    cells = city_cells()
    places = load_places()
    print(f"{len(cells)} cells, {len(places)} places", flush=True)
    if args.engine == "osmnx":
        from .access_osmnx import compute_walk

        method = (
            f"osmnx (fallback): walk {WALK_KMH:g} km/h on the OSM footway network, Dijkstra; "
            f"transit not computed, walking zone shown; H3 res {H3_RES}"
        )
        reach = compute_walk(cells, places, city_shape(), WALK_KMH, MINUTES)
    else:
        feed = DEPARTURE.strftime("%Y-%m-%d")
        method = (
            f"r5py: walk {WALK_KMH:g} km/h and walk + KMK, Tuesday {feed} 08:00, 30-min window (median); "
            f"OSM Małopolska + GTFS A/T/M; H3 res {H3_RES}"
        )
        reach = compute(cells, places)
    app_data, layers_dir = (args.out, args.out) if args.out else (APP_DATA, LAYERS_DIR)
    payload = write_outputs(cells, places, reach, method, app_data, layers_dir)
    if not args.out:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(render_report(payload, places), encoding="utf-8")
    print("written", app_data / "access.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
