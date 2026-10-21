"""Named institutions from OpenStreetMap (Overpass), used only to recover a lost house number.

An OSM object counts as the same institution only if its type fits the dataset, its "nr" (if any)
matches, every distinctive word of its name occurs in the source name, and it lies on the source
street. The address is then the nearest EMUiA point on that street (≤ ``SNAP_MAX_M``).
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path

import httpx

from .portal import USER_AGENT
from .streets import fold

OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
OVERPASS_QUERY = """[out:json][timeout:120];
area["name"="Kraków"]["boundary"="administrative"]["admin_level"="6"]->.k;
nwr(area.k)["amenity"~"^(kindergarten|school|childcare|library|community_centre|arts_centre)$"]["name"];
out center tags;"""
SNAP_MAX_M = 60

# OSM amenity values that may represent a record of each dataset family.
AMENITIES_BY_PREFIX = {
    "przedszkola": {"kindergarten"},
    "szkoly": {"school"},
    "zlobki": {"childcare", "kindergarten"},
    "kluby_dzieciece": {"childcare", "kindergarten"},
    "kluby_rodzicow": {"community_centre", "arts_centre", "library", "childcare", "kindergarten"},
    "biblioteki": {"library"},
}


@dataclass(frozen=True)
class OsmInstitution:
    name: str
    amenity: str
    street: str | None
    number: str | None
    lon: float
    lat: float


def overpass(client: httpx.Client, query: str, cache_path: Path) -> list[dict]:
    """Elements of an Overpass query, cached on disk (delete the file to refresh)."""
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))
    response = None
    for url in OVERPASS_URLS:  # public servers are often busy (429/5xx): try the next one
        response = client.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=240)
        if response.status_code < 429:
            break
    assert response is not None
    response.raise_for_status()
    elements = response.json()["elements"]
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(elements, ensure_ascii=False), encoding="utf-8")
    return elements


def fetch_institutions(client: httpx.Client, cache_path: Path) -> list[OsmInstitution]:
    elements = overpass(client, OVERPASS_QUERY, cache_path)
    return [parse_element(e) for e in elements if (e.get("lon") or e.get("center"))]


def parse_element(element: dict) -> OsmInstitution:
    tags = element["tags"]
    center = element.get("center") or element
    return OsmInstitution(tags["name"], tags.get("amenity", ""), tags.get("addr:street"),
                          tags.get("addr:housenumber"), center["lon"], center["lat"])


def amenities_for(dataset: str) -> set[str]:
    return next((v for k, v in AMENITIES_BY_PREFIX.items() if dataset.startswith(k)), set())


# Kinds of institution; one named in OSM must also be named in the source
# ("I Prywatne Liceum im. Piłsudskiego" is not "Prywatna Szkoła Podstawowa im. Piłsudskiego").
INSTITUTION_KINDS = ("przedszkol", "podstawow", "liceum", "technikum", "branzow", "zlob")


def same_institution(osm_name: str, source_name: str, generic: frozenset[str]) -> bool:
    src, osm = fold(source_name), fold(osm_name)
    if any(kind in osm and kind not in src for kind in INSTITUTION_KINDS):
        return False
    src_numbers = set(re.findall(r"\bnr (\d+)", src))
    osm_numbers = set(re.findall(r"\bnr (\d+)", osm))
    if (src_numbers or osm_numbers) and src_numbers != osm_numbers:
        return False
    osm_words = {w for w in osm.split() if w not in generic and not w.isdigit() and len(w) > 2}
    src_words = set(src.split())
    if not osm_words:
        return bool(src_numbers)  # "Przedszkole nr 80" — only the number identifies it
    return osm_words <= src_words
