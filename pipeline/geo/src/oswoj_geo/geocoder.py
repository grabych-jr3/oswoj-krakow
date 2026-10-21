"""Geocoder over EMUiA address points (PLAN.md §6.A, A2).

Street lookup, in order: exact key → partial (source name is a subset of the EMUiA name with
the same last word: "Kutrzeby" → "Generała Tadeusza Kutrzeby") → fuzzy (rapidfuzz). The
street kind (osiedle/aleja/plac) and the postal code only break ties; a wrong postal code in
the source never rejects a match. Then the house number: exact → leading part ("80/82" → "80").
Without a usable number the result is street-level, and the outcome says why.
"""

import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal

from rapidfuzz import fuzz, process

from .emuia import AddressPoint, distance_m
from .streets import (
    StreetKey,
    base_number,
    number_variants,
    split_letter_prefix,
    split_number_from_street,
    street_key,
)

Precision = Literal["address", "street", "approx"]  # as GeocodeResult.precision in app/src/contracts/geo.ts
FUZZY_MIN_SCORE = 85


@dataclass(frozen=True)
class GeocodeHit:
    lon: float
    lat: float
    precision: Precision
    method: str  # exact | partial | fuzzy | nominatim+emuia | manual
    street: str | None  # EMUiA street name
    number: str | None  # EMUiA house number
    postal: str | None
    district: int | None
    emuia_id: int | None


@dataclass(frozen=True)
class Outcome:
    hit: GeocodeHit | None
    reason: str | None = None  # why the result is not address-level

    @property
    def is_address(self) -> bool:
        return self.hit is not None and self.hit.precision == "address"


class Geocoder:
    def __init__(self, points: list[AddressPoint]) -> None:
        self._points: dict[str, list[AddressPoint]] = defaultdict(list)
        self._by_number: dict[tuple[str, str], AddressPoint] = {}
        for p in points:
            self._points[p.street].append(p)
            self._by_number.setdefault((p.street, p.number_key), p)
        self._keys: dict[str, StreetKey] = {name: street_key(name) for name in self._points}
        self._by_full: dict[str, list[str]] = defaultdict(list)
        self._by_last: dict[str, list[str]] = defaultdict(list)
        for name, key in self._keys.items():
            self._by_full[key.full].append(name)
            self._by_last[key.last].append(name)
        self._fulls = list(self._by_full)

    def street_candidates(self, street: str) -> tuple[list[str], str]:
        """EMUiA street names that the source street may mean, and how they were found."""
        key = street_key(street)
        if not key.tokens:
            return [], "none"
        names, method = self._by_full.get(key.full, []), "exact"
        if not names:
            tokens = set(key.tokens)
            names = [n for n in self._by_last.get(key.last, []) if tokens <= set(self._keys[n].tokens)]
            method = "partial"
        if not names:
            found = process.extract(key.full, self._fulls, scorer=fuzz.token_sort_ratio,
                                    score_cutoff=FUZZY_MIN_SCORE, limit=5)
            best = found[0][1] if found else None
            names = [n for full, score, _ in found if score == best for n in self._by_full[full]]
            method = "fuzzy"
        same_kind = [n for n in names if self._keys[n].kind == key.kind]
        return (same_kind or names), method

    def _prefer_postal(self, names: list[str], postal: str | None) -> list[str]:
        if not postal or len(names) < 2:
            return names
        with_postal = [n for n in names if any(p.postal == postal for p in self._points[n])]
        return with_postal or names

    def snap(self, street: str, lon: float, lat: float, max_m: float) -> GeocodeHit | None:
        """The EMUiA address point on ``street`` nearest to (lon, lat), if within ``max_m`` metres."""
        names, _ = self.street_candidates(street)
        best: tuple[float, AddressPoint] | None = None
        for p in (p for n in names for p in self._points[n]):
            d = distance_m((lon, lat), (p.lon, p.lat))
            if d <= max_m and (best is None or d < best[0]):
                best = (d, p)
        if best is None:
            return None
        p = best[1]
        return GeocodeHit(p.lon, p.lat, "address", "osm+emuia", p.street, p.number, p.postal, p.district,
                          p.id)

    def _pick(self, matches: list[AddressPoint], postal: str | None) -> AddressPoint | str | None:
        """One point, or a reason string when several streets fit equally, or None."""
        if len({p.street for p in matches}) > 1 and postal:
            matches = [p for p in matches if p.postal == postal] or matches
        if len({p.street for p in matches}) > 1:
            return "ambiguous street: " + " / ".join(sorted({p.street for p in matches}))
        return matches[0] if matches else None

    def _match_number(self, street: str, names: list[str], number: object,
                      postal: str | None) -> tuple[AddressPoint | str | None, bool]:
        """(point | ambiguity reason | None, whether the number was approximated)."""
        variants = number_variants(number)
        for variant in variants:
            found = self._pick([p for n in names if (p := self._by_number.get((n, variant)))], postal)
            if found:
                return found, False
        # "80" in the source, "80/82" in EMUiA: the same building under a double number.
        for variant in variants:
            composite = [p for n in names for p in self._points[n] if p.number_key.startswith(variant + "/")]
            if found := self._pick(composite, postal):
                return found, False
        # "Osiedle Centrum" + "E14" → "Osiedle Centrum E" 14.
        if prefixed := split_letter_prefix(number):
            letter, rest = prefixed
            lettered, _ = self.street_candidates(f"{street} {letter}")
            found = self._pick([p for n in lettered if (p := self._by_number.get((n, rest)))], postal)
            if found:
                return found, False
        # "1a" missing but "1" present: the neighbouring building on the same plot; flagged as approximate.
        if base := base_number(number):
            found = self._pick([p for n in names if (p := self._by_number.get((n, base)))], postal)
            if found:
                return found, True
            # "8W" missing and no plain "8", but 8a, 8g, 8h… exist: one complex; take its middle building.
            lettered = re.compile(rf"{base}[a-z]")
            family = [p for n in names for p in self._points[n] if lettered.fullmatch(p.number_key)]
            if len({p.street for p in family}) == 1:
                cx = sum(p.lon for p in family) / len(family)
                cy = sum(p.lat for p in family) / len(family)
                return min(family, key=lambda q: (q.lon - cx) ** 2 + (q.lat - cy) ** 2), True
        return None, False

    def geocode(self, street: str | None, number: object = None, postal: str | None = None) -> Outcome:
        if not street:
            return Outcome(None, "no street in source")
        names, method = self.street_candidates(street)
        # "Barska 69/U6": try the number written into the street field before trusting a fuzzy match.
        if (not names or method == "fuzzy") and (split := split_number_from_street(street)):
            split_names, split_method = self.street_candidates(split[0])
            if split_names and (not names or split_method != "fuzzy"):
                street, number, names, method = split[0], number or split[1], split_names, split_method
        if not names:
            return Outcome(None, f"street not in EMUiA: {street}")

        found, approximated = self._match_number(street, names, number, postal)
        if isinstance(found, str):
            return Outcome(None, found)
        if found:
            p = found
            return Outcome(GeocodeHit(p.lon, p.lat, "address", method + ("~number" if approximated else ""),
                                      p.street, p.number, p.postal, p.district, p.id))

        names = self._prefer_postal(names, postal)
        if len(names) > 1:
            return Outcome(None, "ambiguous street: " + " / ".join(sorted(names)))
        points = self._points[names[0]]
        local = [p for p in points if postal and p.postal == postal] or points
        # Street-level position: the address point closest to the centroid, so it lies on the street.
        cx = sum(p.lon for p in local) / len(local)
        cy = sum(p.lat for p in local) / len(local)
        p = min(local, key=lambda q: (q.lon - cx) ** 2 + (q.lat - cy) ** 2)
        reason = f"number {number} not in EMUiA" if number_variants(number) else "no house number in source"
        return Outcome(GeocodeHit(p.lon, p.lat, "street", method, p.street, None, postal or p.postal,
                                  p.district, None), reason)
