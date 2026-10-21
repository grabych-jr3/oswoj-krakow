"""``uv run geo-stops`` — KMK stops and P+R car parks as places (PLAN.md §6.A, A6).

Stops: the ZTP layer has one feature per post ("Podgórze SKA 02", code "642-02"); posts are grouped
into one stop per stop number ("642"). Kept: groups KMK and KMK on private land, types A/T/TA and
terminal platforms pA/pT/pTA; left out: stops not served by KMK (GMK), private ones, suspended,
temporary, virtual, service and historic ones, posts valid only from a future date, and anything
outside Kraków. Lines and the official stop name come from the GTFS feeds (stop_code = post code).
"""

import argparse
import csv
import io
import json
import re
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from shapely.geometry import Point, shape
from shapely.ops import unary_union

from .districts import SERVER_FILE as DISTRICTS_FILE
from .fetch import RAW_DIR
from .layers import source_ref, write_index, write_layer
from .normalize import format_phone
from .streets import fold

STOPS_FILE = RAW_DIR / "przystanki_kmk.geojson"
PARK_AND_RIDE_FILE = RAW_DIR / "park_and_ride.geojson"
GTFS_FEEDS = ("GTFS_KRK_A.zip", "GTFS_KRK_T.zip", "GTFS_KRK_M.zip")

SERVED_GROUPS = {"KMK", "KMK_inny"}  # "KMK na terenie prywatnym" is still served by KMK
PHYSICAL_TYPES = {"A", "T", "TA", "pA", "pT", "pTA"}  # regular stops and terminal platforms
TRAM_ROUTE_TYPES = {"0", "900"}  # GTFS tram (900: extended route type used by the tram feed)


@dataclass
class Stop:
    code: str  # stop number, "642"
    posts: list[dict[str, Any]] = field(default_factory=list)
    lines: set[str] = field(default_factory=set)
    has_tram: bool = False
    has_bus: bool = False
    gtfs_names: Counter[str] = field(default_factory=Counter)

    @property
    def point(self) -> Point:
        xs = [p["lon"] for p in self.posts]
        ys = [p["lat"] for p in self.posts]
        return Point(sum(xs) / len(xs), sum(ys) / len(ys))


def stop_number(post_code: str) -> str:
    """ "642-02" → "642"; "416-04-01" → "416"."""
    return post_code.split("-")[0].strip()


def base_name(post_name: str) -> str:
    """ "Podgórze SKA 02" → "Podgórze SKA"; "Czyżyny Dworzec 01-08" → "Czyżyny Dworzec"."""
    return re.sub(r"\s+\d{2}(-\d{2})?$", "", post_name.strip())


def keep_post(props: dict[str, Any], now_ms: int) -> bool:
    valid_from = props.get("validFrom")
    return (
        props.get("Grupa") in SERVED_GROUPS
        and props.get("Typ_przystanku") in PHYSICAL_TYPES
        and bool(props.get("kod_busman"))
        and (valid_from is None or valid_from <= now_ms)
    )


def group_posts(collection: dict[str, Any], now_ms: int) -> dict[str, Stop]:
    stops: dict[str, Stop] = {}
    for f in collection["features"]:
        props = f["properties"]
        if not f.get("geometry") or not keep_post(props, now_ms):
            continue
        code = stop_number(props["kod_busman"])
        lon, lat = f["geometry"]["coordinates"][:2]
        stops.setdefault(code, Stop(code)).posts.append({**props, "lon": lon, "lat": lat})
    return stops


def add_gtfs(stops: dict[str, Stop], feeds: list[Path]) -> None:
    """Lines serving each stop and its timetable name, from stop_times → trips → routes."""
    for feed in feeds:
        with zipfile.ZipFile(feed) as z:

            def rows(name: str, archive: zipfile.ZipFile = z) -> Any:
                return csv.DictReader(io.TextIOWrapper(archive.open(name), "utf-8-sig"))

            routes = {r["route_id"]: (r["route_short_name"], r["route_type"]) for r in rows("routes.txt")}
            trip_route = {t["trip_id"]: t["route_id"] for t in rows("trips.txt")}
            stop_code = {s["stop_id"]: (s["stop_code"], s["stop_name"]) for s in rows("stops.txt")}
            served: set[tuple[str, str]] = set()
            for st in rows("stop_times.txt"):
                route = trip_route.get(st["trip_id"])
                if route and st["stop_id"] in stop_code:
                    served.add((st["stop_id"], route))
            for stop_id, route_id in served:
                code, name = stop_code[stop_id]
                stop = stops.get(stop_number(code)) if code else None
                if stop is None or route_id not in routes:
                    continue
                line, route_type = routes[route_id]
                stop.lines.add(line)
                stop.gtfs_names[name] += 1
                if route_type in TRAM_ROUTE_TYPES:
                    stop.has_tram = True
                else:
                    stop.has_bus = True


def line_order(line: str) -> tuple[int, int, str]:
    """Trams and buses by number; letter lines ("N", "P") after the numbers."""
    digits = re.match(r"\d+", line)
    return (0, int(digits.group(0)), line) if digits else (1, 0, line)


def stop_type(stop: Stop) -> str:
    """ "A", "T" or "AT" (contract attrs.type): from the GTFS routes, else from the ZTP post types."""
    tram, bus = stop.has_tram, stop.has_bus
    if not (tram or bus):
        types = {p["Typ_przystanku"].lstrip("p") for p in stop.posts}
        tram = any("T" in t for t in types)
        bus = any("A" in t for t in types)
    return "AT" if tram and bus else ("T" if tram else "A")


def load_districts(path: Path = DISTRICTS_FILE) -> dict[int, tuple[str, Any]]:
    collection = json.loads(path.read_text(encoding="utf-8"))
    return {
        f["properties"]["number"]: (f["properties"]["name"], shape(f["geometry"]))
        for f in collection["features"]
    }


def district_of(point: Point, districts: dict[int, tuple[str, Any]]) -> dict[str, Any] | None:
    for number, (name, polygon) in districts.items():
        if polygon.contains(point):
            return {"number": number, "name": name}
    return None


def stop_feature(stop: Stop, district: dict[str, Any]) -> dict[str, Any]:
    names = stop.gtfs_names or Counter(base_name(p["Nazwa_przystanku_nr"] or "") for p in stop.posts)
    zones = sorted({p["Strefa_Biletowa"] for p in stop.posts if p.get("Strefa_Biletowa")})
    attrs = {
        "code": stop.code,
        "type": stop_type(stop),
        "lines": ", ".join(sorted(stop.lines, key=line_order)) or None,
        "posts": len(stop.posts),
        "zone": "/".join(zones) or None,
    }
    point = stop.point
    return feature(
        "przystanek", stop.code, names.most_common(1)[0][0], point, district, None, attrs, "przystanki_kmk"
    )


def feature(
    category: str,
    key: str,
    name: str,
    point: Point,
    district: dict[str, Any],
    phone: str | None,
    attrs: dict[str, Any],
    dataset: str,
) -> dict[str, Any]:
    properties = {
        "id": f"{category}:{key}",
        "category": category,
        "name": name,
        "address": f"{district['name']}, Kraków",
        "district": district,
        "phone": phone,
        "url": None,
        "attrs": attrs,
        "source": source_ref(dataset),
    }
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(point.x, 6), round(point.y, 6)]},
        "properties": properties,
    }


def _yes_no(value: Any) -> bool | None:
    return None if value is None else str(value).strip().lower() == "tak"


def park_and_ride_features(
    collection: dict[str, Any], districts: dict[int, tuple[str, Any]]
) -> list[dict[str, Any]]:
    out = []
    for f in collection["features"]:
        p = f["properties"]
        point = Point(*f["geometry"]["coordinates"][:2])
        district = district_of(point, districts)
        if district is None:
            continue
        attrs = {
            "spaces": p.get("m_ogolem"),
            "spacesEv": p.get("m_elektryczne"),
            "spacesDisabled": p.get("m_niepełnosp"),
            "bikeRacks": _yes_no(p.get("stojaki")),
            "bikeRental": _yes_no(p.get("wypozyczalnie_peb")),
            "monitoring": _yes_no(p.get("monitoring")),
            "hours": (p.get("doba_parkingowa") or "").strip() or None,
        }
        key = "-".join(fold(re.sub(r"^P\+R\s+", "", p["Nazwa"])).split())
        out.append(
            feature(
                "park_and_ride",
                key,
                p["Nazwa"].strip(),
                point,
                district,
                format_phone(p.get("infolinia")),
                attrs,
                "park_and_ride",
            )
        )
    return out


@dataclass
class StopStats:
    posts_total: int = 0
    posts_kept: int = 0
    stops: int = 0
    outside: int = 0
    without_lines: list[str] = field(default_factory=list)
    dropped: Counter[str] = field(default_factory=Counter)


def build(now: datetime | None = None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], StopStats]:
    now_ms = int((now or datetime.now(UTC)).timestamp() * 1000)
    districts = load_districts()
    collection = json.loads(STOPS_FILE.read_text(encoding="utf-8"))
    stats = StopStats(posts_total=len(collection["features"]))
    for f in collection["features"]:
        p = f["properties"]
        if not keep_post(p, now_ms):
            reason = (
                f"group {p.get('Grupa')}"
                if p.get("Grupa") not in SERVED_GROUPS
                else f"type {p.get('Typ_przystanku')}"
                if p.get("Typ_przystanku") not in PHYSICAL_TYPES
                else "no code"
                if not p.get("kod_busman")
                else "valid from a future date"
            )
            stats.dropped[reason] += 1
    stops = group_posts(collection, now_ms)
    stats.posts_kept = sum(len(s.posts) for s in stops.values())
    add_gtfs(stops, [RAW_DIR / f for f in GTFS_FEEDS])
    city = unary_union([poly for _, poly in districts.values()])
    features = []
    for stop in stops.values():
        # a stop serves Kraków if any of its posts is in the city ("Wielicka Granica Miasta": 1 of 3)
        inside = [Point(p["lon"], p["lat"]) for p in stop.posts if city.contains(Point(p["lon"], p["lat"]))]
        if not inside:
            stats.outside += 1
            continue
        district = district_of(stop.point, districts) or district_of(inside[0], districts)
        if district is None:  # centroid on a district border line
            stats.outside += 1
            continue
        if not stop.lines:
            stats.without_lines.append(f"{stop.code} {base_name(stop.posts[0]['Nazwa_przystanku_nr'] or '')}")
        features.append(stop_feature(stop, district))
    stats.stops = len(features)
    park_and_ride = park_and_ride_features(
        json.loads(PARK_AND_RIDE_FILE.read_text(encoding="utf-8")), districts
    )
    return (
        sorted(features, key=lambda f: f["properties"]["id"]),
        sorted(park_and_ride, key=lambda f: f["properties"]["id"]),
        stats,
    )


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(description="KMK stops and P+R as map layers (after geo-districts)").parse_args(
        argv
    )
    stops, park_and_ride, stats = build()
    write_layer("przystanek", stops)
    write_layer("park_and_ride", park_and_ride)
    write_index()
    print(
        f"posts {stats.posts_total}, kept {stats.posts_kept} → {stats.stops} stops in Kraków "
        f"({stats.outside} outside), {len(park_and_ride)} P+R"
    )
    print("dropped posts:", dict(stats.dropped))
    print(f"stops without lines in GTFS: {len(stats.without_lines)}", stats.without_lines[:10])
    return 0


if __name__ == "__main__":
    sys.exit(main())
