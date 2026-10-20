"""``uv run geo-geocode`` — geocode every place dataset and write the quality report (PLAN.md §6.A, A2).

Order per record: manual fix → EMUiA (exact/partial/fuzzy) → Nominatim, used only to recover a
house number the source lost (then EMUiA again, so coordinates stay official) → street level.
Outputs: ``.cache/geocoded/<dataset>.json`` for A3 and ``reports/geocoding.md``.
"""

import argparse
import csv
import json
import re
import sys
import zipfile
from dataclasses import asdict, dataclass, replace
from pathlib import Path

from .emuia import load_emuia
from .fetch import CACHE_DIR, PIPELINE_DIR, RAW_DIR, load_table
from .geocoder import GeocodeHit, Geocoder, Outcome
from .inputs import PLACE_DATASETS, InputAddress, extract
from .nominatim import NominatimClient
from .osm import SNAP_MAX_M, OsmInstitution, amenities_for, fetch_institutions, same_institution
from .portal import make_client
from .streets import fold, street_key

EMUIA_ZIP = RAW_DIR / "Adresy_JSON.zip"
MANUAL_FIXES = PIPELINE_DIR / "manual_fixes.csv"
GEOCODED_DIR = CACHE_DIR / "geocoded"
REPORT = PIPELINE_DIR / "reports" / "geocoding.md"
NOMINATIM_CACHE = CACHE_DIR / "nominatim.json"
OSM_CACHE = CACHE_DIR / "osm_institutions.json"
TARGET_SHARE = 0.95  # A2: ≥95% of places with address precision


@dataclass(frozen=True)
class ManualFix:
    street: str | None
    number: str | None
    lon: float | None
    lat: float | None
    note: str


def load_manual_fixes(path: Path = MANUAL_FIXES) -> dict[tuple[str, str], ManualFix]:
    """``dataset,key,street,number,lon,lat,note``: a corrected address or exact coordinates, with a source."""
    if not path.exists():
        return {}
    fixes = {}
    with path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            def opt(name: str, r: dict[str, str] = row) -> str | None:
                return (r.get(name) or "").strip() or None
            lon, lat = opt("lon"), opt("lat")
            fixes[(row["dataset"], row["key"])] = ManualFix(
                opt("street"), opt("number"), float(lon) if lon else None, float(lat) if lat else None,
                opt("note") or "")
    return fixes


def same_street(a: str, b: str) -> bool:
    ka, kb = street_key(a), street_key(b)
    if not ka.tokens or not kb.tokens or ka.last != kb.last:
        return False
    return set(ka.tokens) <= set(kb.tokens) or set(kb.tokens) <= set(ka.tokens)


def nominatim_queries(item: InputAddress) -> list[str]:
    """The name without city suffix and patron, then its quoted short name; both with the street."""
    name = re.sub(r"\s+w\s+krakowie\b", "", item.name, flags=re.IGNORECASE)
    quoted = re.findall(r"[\"„”“']([^\"„”“']{3,})[\"„”“']", name)
    core = re.split(r"\s+im\.\s", re.sub(r"[\"„”“'].*?[\"„”“']", " ", name), flags=re.IGNORECASE)[0]
    core = " ".join(core.split())
    queries = [f"{core}, {item.street}, Kraków"]
    queries += [f"{q.strip()}, {item.street}, Kraków" for q in quoted]
    return list(dict.fromkeys(q for q in queries if q.split(",")[0].strip()))


# Words every kindergarten/school/club name shares; they cannot tell two institutions apart.
GENERIC_NAME_WORDS = frozenset({
    "przedszkole", "przedszkola", "szkola", "podstawowa", "liceum", "ogolnoksztalcace", "technikum",
    "branzowa", "stopnia", "zespol", "szkol", "niepubliczne", "niepubliczny", "niepubliczna",
    "publiczne", "publiczna", "samorzadowe", "samorzadowy", "prywatne", "prywatny", "specjalne",
    "specjalna", "integracyjne", "integracyjnymi", "oddzialami", "z", "i", "w", "nr", "im",
    "krakow", "krakowie", "zlobek", "klub", "dzieciecy", "rodzica", "rodzicow", "filia", "biblioteka",
    "fundacja", "stowarzyszenie", "centrum",
})


def names_agree(osm_name: str, source_name: str) -> bool:
    """Same institution: the "nr 129" number matches, or (without a number) a distinctive word does."""
    src, osm = fold(source_name), fold(osm_name)
    src_numbers = set(re.findall(r"\bnr (\d+)", src))
    if src_numbers and not src_numbers & set(re.findall(r"\bnr (\d+)", osm)):
        return False
    words = {w for w in src.split() if w not in GENERIC_NAME_WORDS and not w.isdigit()}
    return bool(src_numbers) or bool(words & set(osm.split()))


def recover_number(item: InputAddress, geocoder: Geocoder, nominatim: NominatimClient) -> Outcome | None:
    """Address-level outcome if OSM knows the institution's house number on the same street."""
    for query in nominatim_queries(item):
        for result in nominatim.search(query):
            address = result.get("address", {})
            road = address.get("road") or address.get("pedestrian") or address.get("square") or ""
            number = address.get("house_number")
            if not number or not road or not item.street or not same_street(road, item.street):
                continue
            if not names_agree(result.get("name") or "", item.name):
                continue
            outcome = geocoder.geocode(item.street, number, item.postal)
            if outcome.is_address and outcome.hit:
                return Outcome(replace(outcome.hit, method="nominatim+emuia"))
    return None


def recover_from_osm(item: InputAddress, geocoder: Geocoder,
                     institutions: list[OsmInstitution]) -> Outcome | None:
    """Address-level outcome from an OSM object that is provably the same institution on the same street."""
    if not item.street:
        return None
    allowed = amenities_for(item.dataset)
    for inst in institutions:
        if inst.amenity not in allowed or not same_institution(inst.name, item.name, GENERIC_NAME_WORDS):
            continue
        if inst.street and inst.number and same_street(inst.street, item.street):
            outcome = geocoder.geocode(item.street, inst.number, item.postal)
            if outcome.is_address and outcome.hit:
                return Outcome(replace(outcome.hit, method="osm+emuia"))
        if hit := geocoder.snap(item.street, inst.lon, inst.lat, SNAP_MAX_M):
            return Outcome(hit)
    return None


def geocode_place(item: InputAddress, geocoder: Geocoder, fixes: dict[tuple[str, str], ManualFix],
                  nominatim: NominatimClient | None,
                  institutions: list[OsmInstitution] | None = None) -> Outcome:
    fix = fixes.get((item.dataset, item.key))
    if fix and fix.lon is not None and fix.lat is not None:
        return Outcome(GeocodeHit(fix.lon, fix.lat, "address", "manual", fix.street, fix.number, item.postal,
                                  None, None))
    street = fix.street if fix and fix.street else item.street
    number = fix.number if fix and fix.number else item.number
    outcome = geocoder.geocode(street, number, item.postal)
    if fix and outcome.hit:
        outcome = Outcome(replace(outcome.hit, method="manual+" + outcome.hit.method), outcome.reason)
    if not outcome.is_address and nominatim is not None:
        outcome = recover_number(item, geocoder, nominatim) or outcome
    if not outcome.is_address and institutions:
        outcome = recover_from_osm(item, geocoder, institutions) or outcome
    return outcome


def emuia_date(zip_path: Path = EMUIA_ZIP) -> str:
    with zipfile.ZipFile(zip_path) as archive:
        text = archive.read("__Aktualnosc__.txt").decode("utf-8", "replace")
    match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    return match.group(0) if match else "unknown"


def _counts(rows: list[tuple[InputAddress, Outcome]]) -> list[int]:
    """records, address, of which approximate number, street only, not found."""
    return [
        len(rows),
        sum(o.is_address for _, o in rows),
        sum(o.is_address and o.hit is not None and o.hit.method.endswith("~number") for _, o in rows),
        sum(o.hit is not None and o.hit.precision == "street" for _, o in rows),
        sum(o.hit is None for _, o in rows),
    ]


def render_report(results: dict[str, list[tuple[InputAddress, Outcome]]], emuia: str, nominatim: bool) -> str:
    command = "uv run geo-geocode" + ("" if nominatim else " --no-nominatim")
    lines = [
        "# Geocoding quality report (A2)",
        "",
        f"Generated by `{command}` from the portal tables (A1) and EMUiA address points "
        f"(MSIP, files of {emuia}). Coordinates always come from EMUiA, except manual fixes; "
        "Nominatim (OSM) is used only to recover a house number missing in the source.",
        "",
        "| Dataset | Records | Address | of which approx. number | Street only | Not found | Address % |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    totals = [0, 0, 0, 0, 0]
    no_number = no_number_address = 0
    methods: dict[str, int] = {}
    for dataset, rows in results.items():
        counts = _counts(rows)
        totals = [t + c for t, c in zip(totals, counts, strict=True)]
        lines.append(f"| {dataset} | {' | '.join(map(str, counts))} | {counts[1] / counts[0]:.1%} |")
        for item, o in rows:
            if o.hit:
                methods[o.hit.method] = methods.get(o.hit.method, 0) + 1
            if not item.number:
                no_number += 1
                no_number_address += o.is_address
    share = totals[1] / totals[0] if totals[0] else 0.0
    verdict = "met" if share >= TARGET_SHARE else "not met"
    lines += [
        f"| **Total** | {' | '.join(f'**{t}**' for t in totals)} | **{share:.1%}** |",
        "",
        f"Target ≥{TARGET_SHARE:.0%} address precision: **{verdict}**.",
        f"Records whose source has no house number: {no_number} "
        f"(recovered to address level: {no_number_address}).",
        "",
        "## Methods",
        "",
        "| Method | Records |",
        "|---|---:|",
        *[f"| {k} | {v} |" for k, v in sorted(methods.items(), key=lambda kv: -kv[1])],
        "",
        "`exact`: same street key and number · `partial`: source street is part of the EMUiA name "
        "(\"Kutrzeby\" → \"Generała Tadeusza Kutrzeby\") · `fuzzy`: rapidfuzz ≥ 85 · `~number`: the exact "
        "number is not in EMUiA, the plain number is used (\"1A\" → \"1\") · `nominatim+emuia`: house number "
        "from OSM, coordinates from EMUiA · `osm+emuia`: the same institution in OSM (matching type, number "
        "or name, street), placed on the nearest EMUiA address point of the source street (≤ 60 m) · "
        "`manual`: `manual_fixes.csv`.",
        "",
        "## Records below address precision",
        "",
        "| Dataset | Name | Street | No. | Result | Reason |",
        "|---|---|---|---|---|---|",
    ]
    for dataset, rows in results.items():
        for item, o in rows:
            if not o.is_address:
                result = o.hit.precision if o.hit else "none"
                name = item.name.replace("|", "/")
                lines.append(f"| {dataset} | {name} | {item.street or ''} | {item.number or ''} | {result} "
                             f"| {o.reason or ''} |")
    return "\n".join(lines) + "\n"


def run(use_nominatim: bool = True) -> dict[str, list[tuple[InputAddress, Outcome]]]:
    geocoder = Geocoder(load_emuia(EMUIA_ZIP))
    fixes = load_manual_fixes()
    results: dict[str, list[tuple[InputAddress, Outcome]]] = {}
    with make_client() as http:
        nominatim = NominatimClient(http, NOMINATIM_CACHE) if use_nominatim else None
        institutions = fetch_institutions(http, OSM_CACHE) if use_nominatim else None
        for dataset in PLACE_DATASETS:
            results[dataset] = [(item, geocode_place(item, geocoder, fixes, nominatim, institutions))
                                for item in extract(dataset, load_table(dataset))]
    GEOCODED_DIR.mkdir(parents=True, exist_ok=True)
    for dataset, rows in results.items():
        payload = [{**asdict(item), "hit": asdict(o.hit) if o.hit else None, "reason": o.reason}
                   for item, o in rows]
        (GEOCODED_DIR / f"{dataset}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1),
                                                      encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(results, emuia_date(), use_nominatim), encoding="utf-8")
    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Geocode place datasets against EMUiA and write the report")
    parser.add_argument("--no-nominatim", action="store_true", help="skip the OSM house-number recovery")
    args = parser.parse_args(argv)
    results = run(use_nominatim=not args.no_nominatim)
    rows = [o for r in results.values() for _, o in r]
    share = sum(o.is_address for o in rows) / len(rows)
    print(f"address precision: {sum(o.is_address for o in rows)}/{len(rows)} ({share:.1%}); report: {REPORT}")
    return 0 if share >= TARGET_SHARE else 1


if __name__ == "__main__":
    sys.exit(main())
