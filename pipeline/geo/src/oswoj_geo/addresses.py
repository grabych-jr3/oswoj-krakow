"""``uv run geo-addresses`` — EMUiA address points for the server geocoder (PLAN.md §6.A, A9).

70k address points (MSIP, 26 MB GeoJSON) become ``app/data/geo/addresses.json`` (~2 MB):
``{source, districts, postal, streets: [{name, key, kind, point, numbers}]}``, each number being
``[number, lng, lat, postal index, district]``.
- ``name``: postal form ("ul. Wielicka", "al. Jana Pawła II", "os. Zgody");
- ``key``: the folded EMUiA name, every word searchable ("generala tadeusza kutrzeby");
- ``point``: a street-level answer (the address point nearest to the street's centroid);
- coordinates at 5 decimals (~1 m); postal codes and districts as indexes.
"""

import argparse
import json
import sys
from collections import defaultdict
from typing import Any

from .emuia import AddressPoint, district_names, load_emuia
from .fetch import PIPELINE_DIR
from .layers import format_street
from .places import EMUIA_ZIP, emuia_date
from .streets import fold, street_key

OUT = PIPELINE_DIR.parents[1] / "app" / "data" / "geo" / "addresses.json"
MSIP_CATALOG = "https://msip.krakow.pl/228340,artykul,katalog-danych.html"


def _number_order(number: str) -> tuple[int, str]:
    digits = "".join(c for c in number if c.isdigit())
    return (int(digits[:6]) if digits else 0, number.lower())


def build(points: list[AddressPoint], districts: dict[int, str], as_of: str) -> dict[str, Any]:
    by_street: dict[str, list[AddressPoint]] = defaultdict(list)
    for p in points:
        by_street[p.street].append(p)
    postal = sorted({p.postal for p in points if p.postal})
    postal_index = {code: i for i, code in enumerate(postal)}
    streets = []
    for name in sorted(by_street, key=lambda n: (fold(n), n)):
        pts = sorted(by_street[name], key=lambda p: _number_order(p.number))
        cx = sum(p.lon for p in pts) / len(pts)
        cy = sum(p.lat for p in pts) / len(pts)
        mid = min(pts, key=lambda p: (p.lon - cx) ** 2 + (p.lat - cy) ** 2)
        streets.append(
            {
                "name": format_street(name),
                "key": fold(name),
                "kind": street_key(name).kind,
                "point": [round(mid.lon, 5), round(mid.lat, 5), mid.district],
                "numbers": [
                    [
                        p.number,
                        round(p.lon, 5),
                        round(p.lat, 5),
                        postal_index.get(p.postal or "", -1),
                        p.district,
                    ]
                    for p in pts
                ],
            }
        )
    return {
        "source": {"dataset": "msip-emuia", "url": MSIP_CATALOG, "updatedAt": as_of},
        "districts": {str(k): v for k, v in sorted(districts.items())},
        "postal": postal,
        "streets": streets,
    }


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(description="EMUiA addresses for the server geocoder").parse_args(argv)
    data = build(load_emuia(EMUIA_ZIP), district_names(EMUIA_ZIP), emuia_date())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n = sum(len(s["numbers"]) for s in data["streets"])
    print(f"{len(data['streets'])} streets, {n} addresses → {OUT} ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
