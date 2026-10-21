"""``uv run geo-parks`` — city parks and pocket parks as places (PLAN.md §6.A, A5).

The portal lists parks by name, district and area only. Each park is located, in order:
1. pocket parks: the city's own ArcGIS polygons (same name, same district);
2. an OSM area with a matching name that touches the park's district and has a plausible size
   (1/3–3× the area in the city data); the place point lies inside that area;
3. an OSM object with exactly the park's name inside its district (Nominatim, e.g. the
   ``tourism=checkpoint`` posts that mark most city parks).
Anything else stays out of the layer and is listed in ``reports/parks.md``.
"""

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pyproj import Geod
from rapidfuzz import fuzz
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import polygonize, unary_union

from .districts import SERVER_FILE as DISTRICTS_FILE
from .districts import roman_to_int
from .fetch import CACHE_DIR, PIPELINE_DIR, RAW_DIR, load_table
from .layers import source_ref, write_index, write_layer
from .nominatim import NominatimClient
from .osm import overpass
from .places import NOMINATIM_CACHE
from .portal import make_client
from .streets import fold

OSM_CACHE = CACHE_DIR / "osm_green_areas.json"
POCKET_POLYGONS = RAW_DIR / "parki_kieszonkowe_zasieg.geojson"
AREAS_OUT = CACHE_DIR / "parks_areas.geojson"  # matched polygons, for the 15-minute analysis (A8)
REPORT = PIPELINE_DIR / "reports" / "parks.md"
TARGET_SHARE = 0.9  # A5: ≥90% matched
AREA_RATIO = (1 / 3, 3.0)
NAME_MIN_SCORE = 90

OSM_QUERY = """[out:json][timeout:180];
area["name"="Kraków"]["boundary"="administrative"]["admin_level"="6"]->.k;
(nwr(area.k)["leisure"~"^(park|garden|nature_reserve|common|recreation_ground)$"]["name"];
 nwr(area.k)["landuse"~"^(meadow|grass|forest|recreation_ground)$"]["name"];
 nwr(area.k)["historic"="fort"]["name"];
 nwr(area.k)["place"="square"]["name"];);
out geom;"""

# words that every park name shares or writes in different forms
GENERIC = {"park", "im", "imienia", "miejski", "krakowski", "rzeczny"}
_GEOD = Geod(ellps="WGS84")


@dataclass(frozen=True)
class Area:
    name: str
    geometry: Any  # shapely (Multi)Polygon, WGS84
    ref: str  # "osm:way/123" or "arcgis:FID 7"
    declared_ha: float | None = None  # area stated by the publisher (ArcGIS POW_HA)


@dataclass(frozen=True)
class Located:
    point: Point
    method: str  # "arcgis" | "osm-area" | "osm-point"
    ref: str
    matched_name: str
    area_ratio: float | None
    geometry: Any | None


def area_ha(geometry: Any) -> float:
    return abs(_GEOD.geometry_area_perimeter(geometry)[0]) / 10_000


def osm_geometry(element: dict[str, Any]) -> Any | None:
    """Polygon of an OSM way or multipolygon relation from ``out geom``; None for nodes and open ways."""
    if element["type"] == "way":
        pts = [(p["lon"], p["lat"]) for p in element.get("geometry", [])]
        return Polygon(pts) if len(pts) >= 4 and pts[0] == pts[-1] else None
    if element["type"] == "relation":

        def rings(roles: tuple[str, ...]) -> Any:
            lines = [
                LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
                for m in element.get("members", [])
                if m.get("role") in roles and m.get("geometry")
            ]
            return unary_union(list(polygonize(lines)))

        outer = rings(("outer", ""))
        if outer.is_empty:
            return None
        inner = rings(("inner",))
        return outer.difference(inner) if not inner.is_empty else outer
    return None


def osm_areas(elements: list[dict[str, Any]]) -> list[Area]:
    areas = []
    for e in elements:
        geometry = osm_geometry(e)
        if geometry is None or geometry.is_empty:
            continue
        if not geometry.is_valid:
            geometry = geometry.buffer(0)
        areas.append(Area(e["tags"]["name"], geometry, f"osm:{e['type']}/{e['id']}"))
    return areas


def pocket_areas(path: Path = POCKET_POLYGONS) -> list[Area]:
    collection = json.loads(path.read_text(encoding="utf-8"))
    return [
        Area(
            f["properties"]["NAZWA"],
            shape(f["geometry"]),
            f"arcgis:FID {f['properties'].get('FID')}",
            f["properties"].get("POW_HA"),
        )
        for f in collection["features"]
        if f.get("geometry")
    ]


def match_renamed(region: Any, area: float | None, areas: list[Area]) -> Located | None:
    """A city polygon in the same district with the same declared area (to 0.0001 ha): the park renamed.

    "Motylem Jestem Zakręcony Ogród Krakowian" is "Zakręcony Ogród Krakowian" in the polygons, both 0.1639 ha.
    """
    if not area:
        return None
    same = [
        a
        for a in areas
        if a.declared_ha is not None
        and abs(a.declared_ha - area) < 0.00005
        and a.geometry.representative_point().within(region)
    ]
    if len(same) != 1:
        return None
    a = same[0]
    return Located(a.geometry.representative_point(), "arcgis", a.ref, a.name, None, a.geometry)


def district_numbers(text: str) -> list[int]:
    """ "VII Zwierzyniec" → [7]; "I, II, VII, VIII, XIII" → [1, 2, 7, 8, 13]."""
    return [roman_to_int(t) for t in re.findall(r"\b[IVXL]+\b", text)]


def name_key(name: str) -> str:
    return " ".join(w for w in fold(name).split() if w not in GENERIC)


def same_name(a: str, b: str) -> bool:
    return fold(a) == fold(b)


def name_score(a: str, b: str) -> float:
    ka, kb = name_key(a), name_key(b)
    return fuzz.token_set_ratio(ka, kb) if ka and kb else 0.0


def match_area(
    name: str, region: Any, area: float | None, areas: list[Area], exact: bool = False
) -> Located | None:
    best: tuple[float, float, Area, float | None] | None = None
    for a in areas:
        score = 100.0 if same_name(a.name, name) else (0.0 if exact else name_score(a.name, name))
        if score < NAME_MIN_SCORE or not a.geometry.intersects(region):
            continue
        ratio = area_ha(a.geometry) / area if area else None
        if ratio is not None and not AREA_RATIO[0] <= ratio <= AREA_RATIO[1]:
            continue
        closeness = -abs(math.log(ratio)) if ratio else 0.0
        if best is None or (score, closeness) > (best[0], best[1]):
            best = (score, closeness, a, ratio)
    if best is None:
        return None
    _, _, a, ratio = best
    # inside the park, and inside its district when the park spans several
    part = a.geometry.intersection(region)
    point = (part if not part.is_empty else a.geometry).representative_point()
    return Located(
        point, "arcgis" if a.ref.startswith("arcgis") else "osm-area", a.ref, a.name, ratio, a.geometry
    )


def match_point(name: str, region: Any, nominatim: NominatimClient) -> Located | None:
    for result in nominatim.search(f"{name}, Kraków"):
        if not same_name(result.get("name") or "", name):
            continue
        point = Point(float(result["lon"]), float(result["lat"]))
        if region.contains(point):
            tag = f"{result.get('category')}={result.get('type')}"
            ref = f"osm:{result.get('osm_type')}/{result.get('osm_id')} ({tag})"
            return Located(point, "osm-point", ref, result["name"], None, None)
    return None


@dataclass(frozen=True)
class ParkRecord:
    category: str  # "park" | "park_kieszonkowy"
    dataset: str
    name: str
    district_text: str
    area_ha: float | None
    type: str | None


def park_records() -> list[ParkRecord]:
    records = [
        ParkRecord(
            "park", "parki_miejskie", r["Nazwa"], r["Dzielnica"], r.get("Powierzchnia_ha"), r.get("Typ")
        )
        for r in load_table("parki_miejskie")
    ]
    records += [
        ParkRecord(
            "park_kieszonkowy", "parki_kieszonkowe", r["NAZWA"], r["DZIELNICA"], r.get("POW_HA"), r.get("TYP")
        )
        for r in load_table("parki_kieszonkowe")
    ]
    return records


def slug(text: str) -> str:
    return "-".join(fold(text).split())


def place_feature(rec: ParkRecord, loc: Located, districts: dict[int, tuple[str, Any]]) -> dict[str, Any]:
    number = next((n for n, (_, poly) in districts.items() if poly.contains(loc.point)), None)
    if number is None:  # on a border line: the first district named by the source
        number = district_numbers(rec.district_text)[0]
    district_name = districts[number][0]
    attrs: dict[str, Any] = {
        "area_ha": rec.area_ha,
        "type": rec.type,
        "location": "point" if loc.method == "osm-point" else "area",
    }
    properties = {
        "id": f"{rec.category}:{slug(rec.name)}",
        "category": rec.category,
        "name": rec.name,
        "address": f"{district_name}, Kraków",
        "district": {"number": number, "name": district_name},
        "phone": None,
        "url": None,
        "attrs": attrs,
        "source": source_ref(rec.dataset),
    }
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(loc.point.x, 6), round(loc.point.y, 6)]},
        "properties": properties,
    }


def load_districts(path: Path = DISTRICTS_FILE) -> dict[int, tuple[str, Any]]:
    collection = json.loads(path.read_text(encoding="utf-8"))
    return {
        f["properties"]["number"]: (f["properties"]["name"], shape(f["geometry"]))
        for f in collection["features"]
    }


def locate(
    rec: ParkRecord, region: Any, osm: list[Area], pockets: list[Area], nominatim: NominatimClient | None
) -> Located | None:
    if rec.category == "park_kieszonkowy":
        found = match_area(rec.name, region, None, pockets, exact=True) or match_renamed(
            region, rec.area_ha, pockets
        )
        if found:
            return found
    found = match_area(rec.name, region, rec.area_ha, osm)
    if found is None and nominatim is not None:
        found = match_point(rec.name, region, nominatim)
    return found


def render_report(rows: list[tuple[ParkRecord, Located | None]]) -> str:
    lines = [
        "# Parks (A5)",
        "",
        "Generated by `uv run geo-parks`. Parks from the portal located by name in the city's pocket-park "
        "polygons (ArcGIS), then OSM areas (same district, area 1/3–3× the city figure), then an OSM "
        "object with exactly the same name in the district.",
        "",
    ]
    for category in ("park", "park_kieszonkowy"):
        sub = [(r, loc) for r, loc in rows if r.category == category]
        found = sum(loc is not None for _, loc in sub)
        lines.append(f"- **{category}**: {found} / {len(sub)} located ({found / len(sub):.0%})")
    total = sum(loc is not None for _, loc in rows)
    share = total / len(rows)
    lines += [
        f"- **Total**: {total} / {len(rows)} ({share:.1%}); target ≥{TARGET_SHARE:.0%}: "
        f"**{'met' if share >= TARGET_SHARE else 'not met'}**",
        "",
        "| Category | Park | District | Area ha | Method | Matched object | Area × |",
        "|---|---|---|---:|---|---|---:|",
    ]
    for r, loc in rows:
        method = loc.method if loc else "**not found**"
        matched = f"{loc.matched_name} ({loc.ref})" if loc else ""
        ratio = f"{loc.area_ratio:.2f}" if loc and loc.area_ratio else ""
        lines.append(
            f"| {r.category} | {r.name} | {r.district_text} | {r.area_ha or ''} | {method} | {matched} "
            f"| {ratio} |"
        )
    return "\n".join(lines) + "\n"


def run(online: bool = True) -> list[tuple[ParkRecord, Located | None]]:
    districts = load_districts()
    pockets = pocket_areas()
    with make_client() as http:
        osm = osm_areas(overpass(http, OSM_QUERY, OSM_CACHE))
        nominatim = NominatimClient(http, NOMINATIM_CACHE) if online else None
        rows = []
        for rec in park_records():
            region = unary_union([districts[n][1] for n in district_numbers(rec.district_text)])
            rows.append((rec, locate(rec, region, osm, pockets, nominatim)))
    for category in ("park", "park_kieszonkowy"):
        features = [place_feature(r, loc, districts) for r, loc in rows if r.category == category and loc]
        write_layer(category, sorted(features, key=lambda f: f["properties"]["id"]))
    write_index()
    areas = [
        {
            "type": "Feature",
            "geometry": mapping(loc.geometry),
            "properties": {"id": f"{r.category}:{slug(r.name)}", "name": r.name},
        }
        for r, loc in rows
        if loc and loc.geometry is not None
    ]
    AREAS_OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": areas}, ensure_ascii=False), encoding="utf-8"
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(rows), encoding="utf-8")
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Locate city and pocket parks (after geo-districts)")
    parser.add_argument("--offline", action="store_true", help="skip the Nominatim name lookup")
    args = parser.parse_args(argv)
    rows = run(online=not args.offline)
    found = sum(loc is not None for _, loc in rows)
    print(f"parks located: {found}/{len(rows)} ({found / len(rows):.1%}); report: {REPORT}")
    return 0 if found / len(rows) >= TARGET_SHARE else 1


if __name__ == "__main__":
    sys.exit(main())
