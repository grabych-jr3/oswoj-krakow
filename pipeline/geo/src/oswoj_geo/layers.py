"""``uv run geo-layers`` — places → ``app/public/data/layers/<category>.geojson`` + ``index.json`` (A3).

Format (PLAN.md §5.3): ``FeatureCollection<Point>`` whose ``properties`` are a ``Place`` without
``coords``. Input: the geocoded records of A2 (``.cache/geocoded``) and the portal tables of A1.
"""

import argparse
import json
import re
import sys
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .emuia import district_names
from .fetch import PIPELINE_DIR, load_table
from .inputs import PLACE_DATASETS
from .places import EMUIA_ZIP, GEOCODED_DIR
from .sources import BY_NAME, PORTAL_PAGE, ArcGisLayer, PortalTable

LAYERS_DIR = PIPELINE_DIR.parents[1] / "app" / "public" / "data" / "layers"

# category → datasets that feed it (one layer file per category)
CATEGORY_DATASETS: dict[str, tuple[str, ...]] = {
    "zlobek": ("zlobki_samorzadowe", "zlobki_prywatne", "zlobki_zlecenie_gmk"),
    "klub_dzieciecy": ("kluby_dzieciece",),
    "przedszkole": ("przedszkola_samorzadowe", "przedszkola_niesamorzadowe"),
    "szkola_podstawowa": ("szkoly_podstawowe_samorzadowe", "szkoly_podstawowe_niesamorzadowe"),
    "szkola_ponadpodstawowa": ("szkoly_ponadpodstawowe_samorzadowe", "szkoly_ponadpodstawowe_niesamorzadowe"),
    "klub_rodzica": ("kluby_rodzicow",),
    "biblioteka": ("biblioteki",),
}

# every category with a layer file: geocoded places above, plus layers built by other commands
CATEGORY_SOURCES: dict[str, tuple[str, ...]] = {
    **CATEGORY_DATASETS,
    "park": ("parki_miejskie",),  # geo-parks (A5)
    "park_kieszonkowy": ("parki_kieszonkowe",),
    "przystanek": ("przystanki_kmk",),  # geo-stops (A6)
    "park_and_ride": ("park_and_ride",),
    "urzad": (),  # geo-offices (A7): sources are the BIP cards, see BIP_SOURCE
}
BIP_SOURCE = {"dataset": "bip", "url": "https://www.bip.krakow.pl/", "updatedAt": None}

# ---------------------------------------------------------------- names and addresses

_LOWER_WORDS = {
    "w", "we", "i", "z", "ze", "dla", "na", "do", "o", "od", "po", "pod", "przy", "oraz", "a", "u",
    "nr", "im.", "św.", "ks.", "gen.", "prof.", "bł.", "płk.", "dr", "al.", "ul.", "os.", "pl.",
}
_ROMAN = re.compile(r"^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$")


def _cap(word: str) -> str:
    return "-".join(part[:1].upper() + part[1:] for part in word.split("-"))


def display_name(name: str) -> str:
    """ALL-CAPS register names → readable case; names already in mixed case are kept.

    ``SAMORZĄDOWE PRZEDSZKOLE NR 92 "DWOREK NA KRZEMIONKACH" W KRAKOWIE`` →
    ``Samorządowe Przedszkole nr 92 „Dworek na Krzemionkach” w Krakowie``.
    """
    text = " ".join(name.split())
    letters = [c for c in text if c.isalpha()]
    if letters and not all(c.isupper() for c in letters):
        out = text
    else:
        words = []
        tokens = text.lower().split(" ")
        for i, raw in enumerate(tokens):
            quote = raw[:1] in "\"„“"
            core = raw.lstrip("\"„“")
            bare = core.rstrip("\"”,;:")
            tail = core[len(bare):]
            ends_phrase = i == len(tokens) - 1 or tail.startswith(("\"", "”"))
            initial = re.fullmatch(r"[^\W\d_]\.", bare)  # "I. Łęcka-Karnas"
            # Roman numerals ("XV", "Cosinus I"), but "i" mid-phrase is the conjunction ("Jaś i Małgosia")
            roman = _ROMAN.match(bare) and (bare != "i" or i == 0 or ends_phrase)
            # acronyms have no vowels: "BC", "TSSP"
            acronym = len(bare) >= 2 and bare.isalpha() and not re.search(r"[aeiouyąęó]", bare)
            if (initial or roman) or (acronym and bare not in _LOWER_WORDS):
                word = bare.upper()
            elif bare in _LOWER_WORDS and i > 0 and not quote:
                word = bare
            else:
                word = _cap(bare)
            words.append(("\"" if quote else "") + word + tail)
        out = " ".join(words)
    # straight quote pairs → Polish quotes
    return re.sub(r"\"([^\"]+)\"", "„\\1”", out)


_STREET_PREFIXES = (("Aleja ", "al. "), ("Aleje ", "al. "), ("Osiedle ", "os. "), ("Plac ", "pl. "))
_NO_PREFIX = ("Rynek", "Mały Rynek", "Rondo", "Bulwar", "Planty", "Skwer")


def format_street(street: str) -> str:
    """EMUiA name → postal form: "Aleja Jana Pawła II" → "al. Jana Pawła II", "Wielicka" → "ul. Wielicka"."""
    for long_form, short in _STREET_PREFIXES:
        if street.startswith(long_form):
            return short + street[len(long_form):]
    if street.startswith(_NO_PREFIX) or street.split(" ")[0] in {"ul.", "al.", "os.", "pl."}:
        return street
    return "ul. " + street


def format_address(street: str | None, number: str | None, postal: str | None) -> str:
    parts = [format_street(street) if street else ""]
    if number:
        parts[0] += f" {number}"
    tail = f"{postal} Kraków" if postal else "Kraków"
    return ", ".join(p for p in (parts[0].strip(), tail) if p)


# ---------------------------------------------------------------- attributes per dataset family

def _yes(value: Any, expected: str) -> bool | None:
    return None if value is None else str(value).strip().lower() == expected


def _education(r: dict[str, Any], students_key: str) -> dict[str, Any]:
    attrs = {
        "rspo": r.get("Numer RSPO"),
        students_key: r.get("Liczba dzieci ogółem", r.get("Liczba uczniów ogółem")),
        "groups": r.get("Liczba oddziałów ogółem"),
        "public": _yes(r.get("Publiczność szkoły_placówki"), "publiczna"),
        "operator": r.get("Organ prowadzący"),
    }
    if r.get("Typ szkoły_placówki"):
        attrs["type"] = r["Typ szkoły_placówki"]
    return attrs


_OPERATOR_BY_DATASET = {"zlobki_samorzadowe": "Gmina Miejska Kraków"}
_TYPE_BY_DATASET = {
    "zlobki_samorzadowe": "samorządowy",
    "zlobki_prywatne": "prywatny",
    "zlobki_zlecenie_gmk": "na zlecenie Gminy Miejskiej Kraków",
}


def _childcare(dataset: str, r: dict[str, Any]) -> dict[str, Any]:
    attrs = {"places": r.get("Liczba miejsc"), "operator": _OPERATOR_BY_DATASET.get(dataset)}
    if dataset in _TYPE_BY_DATASET:
        attrs["type"] = _TYPE_BY_DATASET[dataset]
    return attrs


AttrsFn = Callable[[str, dict[str, Any]], dict[str, Any]]
ATTRS: dict[str, AttrsFn] = {
    "przedszkole": lambda d, r: _education(r, "children"),
    "szkola_podstawowa": lambda d, r: _education(r, "students"),
    "szkola_ponadpodstawowa": lambda d, r: _education(r, "students"),
    "zlobek": _childcare,
    "klub_dzieciecy": _childcare,
    "klub_rodzica": lambda d, r: {"operator": r.get("Podmiot prowadzący")},
    "biblioteka": lambda d, r: {},
}


def place_name(category: str, dataset: str, r: dict[str, Any]) -> str:
    if category == "biblioteka":
        return f"Biblioteka Kraków – {r['Nazwa lub numer filii']}"
    raw = r.get("Nazwa szkoły_placówki") or r.get("Nazwa") or r.get("Miejsce") or ""
    return display_name(raw)


def source_ref(dataset: str) -> dict[str, Any]:
    source = BY_NAME[dataset]
    if isinstance(source, ArcGisLayer):  # ZTP layers: SourceRef.dataset "ztp-arcgis" (contracts/common.ts)
        assert source.page, f"{dataset}: no item page in sources.py"
        return {"dataset": "ztp-arcgis", "url": source.page, "updatedAt": source.as_of}
    assert isinstance(source, PortalTable) and source.page, f"{dataset}: no portal page in sources.py"
    return {"dataset": source.page, "url": PORTAL_PAGE.format(page=source.page), "updatedAt": source.as_of}


# ---------------------------------------------------------------- building features

def build_feature(category: str, dataset: str, row: dict[str, Any], record: dict[str, Any],
                  districts: dict[int, str]) -> dict[str, Any] | None:
    hit = row["hit"]
    if hit is None:
        return None
    if hit["precision"] == "address":
        address = format_address(hit["street"] or row["street"], hit["number"] or row["number"],
                                 hit["postal"] or row["postal"])
    else:  # street level: keep what the source says, the point is only on the street
        address = format_address(hit["street"] or row["street"], row["number"], row["postal"])
    district = hit.get("district")
    attrs = {k: v for k, v in ATTRS[category](dataset, record).items()}
    attrs["location"] = hit["precision"]  # "address" | "street": UI can mark approximate places
    properties = {
        "id": f"{category}:{row['key']}",
        "category": category,
        "name": place_name(category, dataset, record),
        "address": address,
        "district": {"number": district, "name": districts[district]} if district in districts else None,
        "phone": record.get("Telefon"),
        "url": None,
        "attrs": attrs,
        "source": source_ref(dataset),
    }
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [hit["lon"], hit["lat"]]},
            "properties": properties}


def build_layers(geocoded_dir: Path = GEOCODED_DIR) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    """Features per category, and a list of skipped records (not geocoded at all)."""
    districts = district_names(EMUIA_ZIP)
    layers: dict[str, list[dict[str, Any]]] = {}
    skipped: list[str] = []
    for category, datasets in CATEGORY_DATASETS.items():
        features: dict[str, dict[str, Any]] = {}
        for dataset in datasets:
            records = {PLACE_DATASETS[dataset](dataset, r).key: r for r in load_table(dataset)}
            rows = json.loads((geocoded_dir / f"{dataset}.json").read_text(encoding="utf-8"))
            for row in rows:
                feature = build_feature(category, dataset, row, records[row["key"]], districts)
                if feature is None:
                    skipped.append(f"{dataset}: {row['name']} ({row['reason']})")
                    continue
                fid = feature["properties"]["id"]
                if fid in features:
                    raise ValueError(f"duplicate place id {fid} ({dataset})")
                features[fid] = feature
        layers[category] = sorted(features.values(), key=lambda f: f["properties"]["id"])
    return layers, skipped


def index_entry(category: str, features: list[dict[str, Any]]) -> dict[str, Any]:
    refs = [source_ref(d) for d in CATEGORY_SOURCES[category]] or [BIP_SOURCE]
    sources = {s["url"]: s for s in refs}
    dates = [s["updatedAt"] for s in sources.values() if s["updatedAt"]]
    return {"category": category, "count": len(features), "updatedAt": max(dates) if dates else None,
            "source": list(sources.values())}


def write_layer(category: str, features: list[dict[str, Any]], out_dir: Path = LAYERS_DIR) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    # one feature per line: small diffs when a single place changes
    body = ",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in features)
    (out_dir / f"{category}.geojson").write_text(
        '{"type":"FeatureCollection","features":[\n' + body + "\n]}\n", encoding="utf-8")


def write_index(out_dir: Path = LAYERS_DIR) -> None:
    """index.json over every category layer on disk: each command (places, parks, stops) adds its own."""
    categories = []
    for category in CATEGORY_SOURCES:
        file = out_dir / f"{category}.geojson"
        if file.exists():
            features = json.loads(file.read_text(encoding="utf-8"))["features"]
            categories.append(index_entry(category, features))
    index = {"generatedAt": datetime.now(UTC).isoformat(timespec="seconds"), "categories": categories}
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n",
                                        encoding="utf-8")


def write_layers(layers: dict[str, list[dict[str, Any]]], out_dir: Path = LAYERS_DIR) -> None:
    for category, features in layers.items():
        write_layer(category, features, out_dir)
    write_index(out_dir)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build map layers (run geo-geocode first)")
    parser.parse_args(argv)
    layers, skipped = build_layers()
    write_layers(layers)
    for category, features in layers.items():
        print(f"{category:24} {len(features):4} places")
    for line in skipped:
        print(f"skipped  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
