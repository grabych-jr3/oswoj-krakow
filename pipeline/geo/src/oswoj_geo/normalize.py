"""Cleanup of portal records (PLAN.md §3.2 p.2).

The portal API returns integers as floats (``1.08e+002``), phone numbers as numbers
(``1.2411743e+008``), and keys/values with stray spaces (``"Miejscowość": " Kraków"``,
``"Liczba miejsc "``). Raw responses stay untouched in the cache; this runs on load.
"""

import re
from typing import Any

# Polish landline area codes (2 digits); every other 9-digit number is treated as mobile.
LANDLINE_AREA_CODES = frozenset(
    str(code)
    for code in (
        12, 13, 14, 15, 16, 17, 18, 22, 23, 24, 25, 29, 32, 33, 34, 41, 42, 43, 44, 46, 48, 52, 54, 55,
        56, 58, 59, 61, 62, 63, 65, 67, 68, 71, 74, 75, 76, 77, 81, 82, 83, 84, 85, 86, 87, 89, 91, 94, 95,
    )
)
_EXPONENT_NUMBER = re.compile(r"^[+-]?\d+(\.\d+)?[eE][+-]?\d+$")
_WHITESPACE = re.compile(r"\s+")


def is_phone_key(key: str) -> bool:
    k = key.lower()
    return "telefon" in k or "infolinia" in k


def normalize_number(value: float | int) -> float | int:
    """Floats with no fractional part become ints (``108.0`` → ``108``)."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def format_phone(value: Any) -> str | None:
    """``124117430`` / ``1.2411743e+008`` → ``"12 411 74 30"``; ``602454775`` → ``"602 454 775"``.

    Strings that are not a plain 9-digit number are only whitespace-cleaned (they may hold
    several numbers or extensions, which we must not mangle).
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        digits = str(int(value))
    else:
        text = _WHITESPACE.sub(" ", str(value)).strip()
        if not text:
            return None
        digits = re.sub(r"[\s-]", "", text)
        if not re.fullmatch(r"(\+?48)?\d{9}", digits):
            return text
    digits = digits.removeprefix("+").removeprefix("48") if len(digits) > 9 else digits
    if len(digits) != 9:
        return digits
    if digits[:2] in LANDLINE_AREA_CODES:
        return f"{digits[:2]} {digits[2:5]} {digits[5:7]} {digits[7:]}"
    return f"{digits[:3]} {digits[3:6]} {digits[6:]}"


def normalize_value(value: Any) -> Any:
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, int | float):
        return normalize_number(value)
    if isinstance(value, str):
        text = _WHITESPACE.sub(" ", value).strip()
        if not text:
            return None
        if _EXPONENT_NUMBER.match(text):
            return normalize_number(float(text))
        return text
    return value


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    """Strip keys, clean values, format phone fields."""
    out: dict[str, Any] = {}
    for key, value in record.items():
        k = _WHITESPACE.sub(" ", key).strip()
        out[k] = format_phone(value) if is_phone_key(k) else normalize_value(value)
    return out
