"""``uv run geo-offices`` — the offices of the BIP cards on the map, with B's ids (PLAN.md §6.A, A7).

Input: ``app/data/kb/offices_raw.json`` (stream B: ``Office`` with ``coords: null``) and
``app/data/kb/procedures.json`` (which cards name each office). The free-text address is cut into
parts and each "street + number" part is tried against EMUiA; the first address-level hit wins.
Output: the ``urzad`` layer, one place per office id, and ``reports/offices.md``.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from .emuia import district_names, load_emuia
from .fetch import PIPELINE_DIR
from .geocoder import Geocoder, Outcome
from .layers import write_index, write_layer
from .normalize import format_phone
from .places import EMUIA_ZIP

KB_DIR = PIPELINE_DIR.parents[1] / "app" / "data" / "kb"
OFFICES_FILE = KB_DIR / "offices_raw.json"
PROCEDURES_FILE = KB_DIR / "procedures.json"
REPORT = PIPELINE_DIR / "reports" / "offices.md"
BIP_CARD = "https://www.bip.krakow.pl/uslugi/{symbol}"
KRAKOW_POSTAL = re.compile(r"^3[01]-\d{3}$")  # Kraków postal codes are 30-xxx and 31-xxx

# address parts that describe a room, floor or desk, never a street ("pokój nr 12" is not "Aleja Pokoju")
NOT_A_STREET = re.compile(
    r"^(pok[oó]j|lokal|stanowisko|pi[eę]tro|poziom|budynek|sekretariat|kasa|parter|"
    r"wej[sś]cie|sala|okienko|dziennik)\b",
    re.IGNORECASE,
)
_PART = re.compile(r"^(?P<street>.*?\D)\s+(?P<number>\d+\s?[A-Za-z]?(?:\s?[-/]\s?\d+\s?[A-Za-z]?)*)$")


def clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    text = re.sub(r"(\d{2})\s*-\s*(\d{3})", r"\1-\2", text)  # "30 - 703" → "30-703"
    return re.sub(r"(\d{2}-\d{3})(?=[^\s\d,])", r"\1 ", text)  # "31-931Kraków" → "31-931 Kraków"


_PHONE = re.compile(r"\+?\d[\d\s\-()]{7,}\d")


def phones(text: str | None) -> str | None:
    """Phone numbers in a BIP text, formatted and deduplicated: "Informacje podstawowe: 12 616 55 55" →
    "12 616 55 55"; "12-291 -29-59" → "12 291 29 59". Text without a 9-digit number is kept as written."""
    found: list[str] = []
    for match in _PHONE.finditer(text or ""):
        digits = re.sub(r"\D", "", match.group(0))
        if len(digits) == 11 and digits.startswith("48"):
            digits = digits[2:]
        if len(digits) == 9 and (formatted := format_phone(digits)) and formatted not in found:
            found.append(formatted)
    return ", ".join(found) if found else (clean(text or "") or None)


def postal_code(address: str) -> str | None:
    match = re.search(r"\b\d{2}-\d{3}\b", clean(address))
    return match.group(0) if match else None


def address_parts(address: str) -> list[tuple[str, str]]:
    """(street, number) candidates in reading order: "ul. Zabłocie 22, 30-701 Kraków - pokój nr 12" →
    [("ul. Zabłocie", "22")]."""
    text = re.sub(r"\([^)]*\)", " ", clean(address))
    text = re.sub(
        r"\s(\d{2}-\d{3})\b", r", \1", text
    )  # "ul. Czerwieńskiego 16 31-319 Kraków": cut at the postal code
    parts = []
    for part in re.split(r",|\s[-–]\s", text):
        part = part.strip()
        match = _PART.match(part)
        if not match or NOT_A_STREET.match(part) or re.fullmatch(r"\d{2}-\d{3}.*", part):
            continue
        parts.append((match.group("street").strip(), re.sub(r"\s", "", match.group("number"))))
    return parts


def locate(address: str, geocoder: Geocoder) -> Outcome:
    postal = postal_code(address)
    if postal and not KRAKOW_POSTAL.match(postal):
        return Outcome(None, f"outside Kraków (postal code {postal})")
    fallback: Outcome | None = None
    for street, number in address_parts(address):
        outcome = geocoder.geocode(street, number, postal)
        if outcome.is_address:
            return outcome
        if outcome.hit and fallback is None:
            fallback = outcome
    return fallback or Outcome(None, "no street address found in the text")


def procedures_by_office(procedures: list[dict[str, Any]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for p in procedures:
        for office in p.get("offices") or []:
            out.setdefault(office["id"], []).append(p["symbol"])
    return {k: sorted(set(v), key=_symbol_order) for k, v in out.items()}


def _symbol_order(symbol: str) -> tuple[str, int]:
    prefix, _, number = symbol.partition("-")
    return (prefix, int(number) if number.isdigit() else 0)


def office_feature(
    office: dict[str, Any], outcome: Outcome, symbols: list[str], districts: dict[int, str]
) -> dict[str, Any] | None:
    hit = outcome.hit
    if hit is None:
        return None
    attrs = {
        "hours": clean(office.get("hours") or "") or None,
        "bookingUrl": office.get("bookingUrl"),
        "procedures": ",".join(symbols) or None,
        "location": hit.precision,
    }
    properties = {
        "id": office["id"],  # the id B gives the office in procedures.json (Office.id contract)
        "category": "urzad",
        "name": clean(office["name"]),
        "address": clean(office["address"]),
        "district": {"number": hit.district, "name": districts[hit.district]}
        if hit.district in districts
        else None,
        "phone": phones(office.get("phone")),
        "url": None,
        "attrs": attrs,
        # the first card that names the office: where the address, hours and phone were read
        "source": {
            "dataset": "bip",
            "url": BIP_CARD.format(symbol=symbols[0]) if symbols else "https://www.bip.krakow.pl/",
            "updatedAt": None,
        },
    }
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [hit.lon, hit.lat]},
        "properties": properties,
    }


def render_report(rows: list[tuple[dict[str, Any], Outcome]]) -> str:
    located = [o for _, o in rows if o.hit]
    address = sum(o.is_address for _, o in rows)
    lines = [
        "# Offices (A7)",
        "",
        "Generated by `uv run geo-offices` from `app/data/kb/offices_raw.json` (stream B) and EMUiA.",
        "",
        f"- Offices: {len(rows)}; on the map: {len(located)} (address level {address}, street level "
        f"{len(located) - address}); not placed: {len(rows) - len(located)}",
        "",
        "| Office id | Address | Result | Matched EMUiA address | Note |",
        "|---|---|---|---|---|",
    ]
    for office, o in rows:
        result = o.hit.precision if o.hit else "**not placed**"
        matched = f"{o.hit.street} {o.hit.number or ''}".strip() if o.hit else ""
        lines.append(
            f"| {office['id']} | {clean(office['address'])} | {result} | {matched} | {o.reason or ''} |"
        )
    return "\n".join(lines) + "\n"


def run(
    offices_file: Path = OFFICES_FILE, procedures_file: Path = PROCEDURES_FILE
) -> tuple[list[dict[str, Any]], list[tuple[dict[str, Any], Outcome]]]:
    geocoder = Geocoder(load_emuia(EMUIA_ZIP))
    districts = district_names(EMUIA_ZIP)
    offices = json.loads(offices_file.read_text(encoding="utf-8"))
    symbols = procedures_by_office(json.loads(procedures_file.read_text(encoding="utf-8")))
    rows = [(office, locate(office["address"], geocoder)) for office in offices]
    features = [
        f for office, o in rows if (f := office_feature(office, o, symbols.get(office["id"], []), districts))
    ]
    return sorted(features, key=lambda f: f["properties"]["id"]), rows


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(description="Offices from the BIP cards as the urzad layer").parse_args(argv)
    features, rows = run()
    write_layer("urzad", features)
    write_index()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(rows), encoding="utf-8")
    address = sum(o.is_address for _, o in rows)
    print(f"offices {len(rows)}: on the map {len(features)} (address {address}); report: {REPORT}")
    for office, o in rows:
        if not o.is_address:
            print(f"  {office['id']}: {o.hit.precision if o.hit else 'not placed'} — {o.reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
