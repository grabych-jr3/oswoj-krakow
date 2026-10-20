"""Addresses of places from the cached portal tables (A1), one extractor per dataset layout."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from .streets import fold


@dataclass(frozen=True)
class InputAddress:
    dataset: str
    key: str  # stable within a dataset: "rspo-3786" or a slug of name + address
    name: str
    street: str | None
    number: str | None
    postal: str | None


def _str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text or None


def _slug(*parts: Any) -> str:
    return "-".join(fold(" ".join(p for p in map(_str, parts) if p)).split())


def _education(dataset: str, r: dict[str, Any]) -> InputAddress:
    return InputAddress(dataset, f"rspo-{_str(r['Numer RSPO'])}", r["Nazwa szkoły_placówki"],
                        _str(r.get("Ulica")), _str(r.get("Nr domu")), _str(r.get("Kod pocztowy")))


# Keys include the premise: one building can hold two registered units ("Strycharska 10" LU1 and LU2).
def _childcare(dataset: str, r: dict[str, Any]) -> InputAddress:
    street, number = _str(r.get("Ulica")), _str(r.get("Numer budynku"))
    return InputAddress(dataset, _slug(r["Nazwa"], street, number, r.get("Numer lokalu")), r["Nazwa"],
                        street, number, _str(r.get("Kod pocztowy")))


def _parent_club(dataset: str, r: dict[str, Any]) -> InputAddress:
    street, number = _str(r.get("Ulica")), _str(r.get("Numer budynku"))
    return InputAddress(dataset, _slug(r["Miejsce"], street, number, r.get("Numer lokalu")), r["Miejsce"],
                        street, number, _str(r.get("Kod pocztowy")))


def _library(dataset: str, r: dict[str, Any]) -> InputAddress:
    street, number = _str(r.get("Nazwa ulicy")), _str(r.get("Numer budynku"))
    name = r["Nazwa lub numer filii"]
    return InputAddress(dataset, _slug(name), name, street, number, _str(r.get("Kod pocztowy")))


Extractor = Callable[[str, dict[str, Any]], InputAddress]

PLACE_DATASETS: dict[str, Extractor] = {
    "przedszkola_samorzadowe": _education,
    "przedszkola_niesamorzadowe": _education,
    "szkoly_podstawowe_samorzadowe": _education,
    "szkoly_podstawowe_niesamorzadowe": _education,
    "szkoly_ponadpodstawowe_samorzadowe": _education,
    "szkoly_ponadpodstawowe_niesamorzadowe": _education,
    "zlobki_samorzadowe": _childcare,
    "zlobki_prywatne": _childcare,
    "zlobki_zlecenie_gmk": _childcare,
    "kluby_dzieciece": _childcare,
    "kluby_rodzicow": _parent_club,
    "biblioteki": _library,
}


def extract(dataset: str, records: list[dict[str, Any]]) -> tuple[list[InputAddress], int]:
    """Addresses with unique keys, and how many source rows were exact repeats of an earlier one."""
    seen: dict[str, InputAddress] = {}
    for r in records:
        item = PLACE_DATASETS[dataset](dataset, r)
        if item.key in seen:
            if seen[item.key] != item:
                raise ValueError(f"{dataset}: two different records share the key {item.key}")
            continue
        seen[item.key] = item
    return list(seen.values()), len(records) - len(seen)
