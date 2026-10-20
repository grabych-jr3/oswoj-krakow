"""EMUiA address points from MSIP (``Adresy_JSON.zip``, EPSG:2178 → EPSG:4326)."""

import json
import math
import zipfile
from dataclasses import dataclass
from pathlib import Path

from pyproj import Transformer

from .streets import normalize_number

SOURCE_CRS = "EPSG:2178"  # PL-2000 zone 7 (PLAN.md §3.2 p.4)


@dataclass(frozen=True)
class AddressPoint:
    id: int
    street: str
    number: str  # as written in EMUiA, e.g. "28a"
    postal: str | None
    district: int | None
    lon: float
    lat: float

    @property
    def number_key(self) -> str:
        return normalize_number(self.number) or ""


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Approximate distance in metres between two (lon, lat) points; fine at city scale."""
    dx = (a[0] - b[0]) * 111320 * math.cos(math.radians((a[1] + b[1]) / 2))
    dy = (a[1] - b[1]) * 110574
    return math.hypot(dx, dy)


def _int_or_none(value: object) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_emuia(collection: dict) -> list[AddressPoint]:
    crs = collection.get("crs", {}).get("properties", {}).get("name", SOURCE_CRS)
    if crs != SOURCE_CRS:
        raise ValueError(f"EMUiA CRS changed: expected {SOURCE_CRS}, got {crs}")
    features = [f for f in collection["features"] if f.get("geometry") and f["properties"].get("nazwa_ulicy")]
    xs = [f["geometry"]["coordinates"][0] for f in features]
    ys = [f["geometry"]["coordinates"][1] for f in features]
    lons, lats = Transformer.from_crs(SOURCE_CRS, "EPSG:4326", always_xy=True).transform(xs, ys)
    return [
        AddressPoint(
            id=int(f["properties"]["id"]),
            street=f["properties"]["nazwa_ulicy"],
            number=str(f["properties"]["numer_adresowy"]),
            postal=f["properties"].get("kod_pocztowy"),
            district=_int_or_none(f["properties"].get("numer_dzielnicy")),
            lon=round(lon, 6),
            lat=round(lat, 6),
        )
        for f, lon, lat in zip(features, lons, lats, strict=True)
    ]


def load_emuia(zip_path: Path) -> list[AddressPoint]:
    with zipfile.ZipFile(zip_path) as archive:
        name = next(n for n in archive.namelist() if n.endswith(".geojson"))
        return parse_emuia(json.loads(archive.read(name)))
