"""Street name and house number normalization for matching against EMUiA (PLAN.md §3.2 p.3).

EMUiA writes full names without "ul." ("Generała Tadeusza Kutrzeby", "Aleja Jana Pawła II",
"Osiedle Zgody"), sometimes with abbreviated titles ("gen. Józefa Bema", "Ks. Stefana
Pawlickiego"). Sources write "ul. Kutrzeby", "W. Reymonta", "os. Zgody". A street key keeps
the street kind (osiedle/aleja/plac matter: "Osiedle Zgody" ≠ "Zgody") and the name tokens
without titles and initials.
"""

import re
import unicodedata
from dataclasses import dataclass

from rapidfuzz import fuzz

# Leading words that name the street kind; "ul." carries no information.
KIND_WORDS: dict[str, str | None] = {
    "ul": None, "ulica": None,
    "al": "aleja", "aleja": "aleja", "aleje": "aleja",
    "os": "osiedle", "osiedle": "osiedle",
    "pl": "plac", "plac": "plac",
}

# Titles that EMUiA and sources write inconsistently (abbreviated or not); dropped on both sides.
TITLE_WORDS = frozenset({
    "ks", "ksiedza", "gen", "generala", "prof", "profesora", "profesor", "kard", "kardynala",
    "bp", "bpa", "biskupa", "dr", "doktora", "sw", "swietego", "swietej", "swietych", "plk", "pulkownika",
    "mjr", "majora", "kpt", "kapitana", "marsz", "marszalka", "hetm", "hetmana",
    "insp", "inspektora", "inz", "inzyniera", "im", "imienia",
})


def fold(text: str) -> str:
    """Lowercase ASCII: ``"Generała Łokietka"`` → ``"generala lokietka"``; punctuation → space."""
    text = text.lower().replace("ł", "l")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


@dataclass(frozen=True)
class StreetKey:
    kind: str | None
    tokens: tuple[str, ...]

    @property
    def full(self) -> str:
        return " ".join(self.tokens)

    @property
    def last(self) -> str:
        return self.tokens[-1] if self.tokens else ""


def _kind_word(word: str) -> tuple[bool, str | None]:
    """Whether ``word`` names a street kind, tolerating typos of the long forms ("Osiede")."""
    if word in KIND_WORDS:
        return True, KIND_WORDS[word]
    if len(word) >= 5:
        for long_form in ("osiedle", "aleja"):
            if fuzz.ratio(word, long_form) >= 85:
                return True, long_form
    return False, None


def street_key(name: str) -> StreetKey:
    words = fold(name).split()
    kind = None
    # Repeated kind words happen in sources: "pl. Plac Na Groblach".
    while words:
        is_kind, word_kind = _kind_word(words[0])
        if not is_kind:
            break
        kind = kind or word_kind
        words = words[1:]
    # Initials ("W. Reymonta") and titles go; single digits stay ("Aleja 3 Maja").
    words = [w for w in words if w not in TITLE_WORDS and not (len(w) == 1 and w.isalpha())]
    return StreetKey(kind, tuple(words))


def normalize_number(value: object) -> str | None:
    """House number as a lowercase string without spaces: ``28.0`` → ``"28"``, ``"28 A"`` → ``"28a"``."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = re.sub(r"\s+", "", str(value)).lower()
    return text or None


def number_variants(value: object) -> list[str]:
    """Numbers to try, most specific first: ``"6b/lu2"`` → ``["6b/lu2", "6b"]``.

    Only forms of the same building number; the plain-digits fallback ("1a" → "1") is separate
    (:func:`base_number`) because it may point at the neighbouring building.
    """
    number = normalize_number(value)
    if number is None:
        return []
    variants = [number]
    head = re.match(r"^\d+[a-z]?", number)
    if head and head.group(0) != number:
        variants.append(head.group(0))
    return variants


def base_number(value: object) -> str | None:
    """Leading digits only: ``"1a"`` → ``"1"``, ``"2u"`` → ``"2"``; None if that changes nothing."""
    number = normalize_number(value)
    head = re.match(r"^\d+", number or "")
    return head.group(0) if head and head.group(0) != number else None


# "Kapelanka 6A/LU 15", "Barska 69/U6": the building number written into the street field.
_NUMBER_IN_STREET = re.compile(r"^(?P<street>.*?\D)\s+(?P<number>\d+[A-Za-z]?)(?:\s*/.*)?$")


def split_number_from_street(street: str) -> tuple[str, str] | None:
    match = _NUMBER_IN_STREET.match(street.strip())
    return (match.group("street"), match.group("number")) if match else None


# "Osiedle Centrum" + "E14" means street "Osiedle Centrum E", number "14" (Nowa Huta).
_LETTER_PREFIXED = re.compile(r"^(?P<letter>[a-z])(?P<number>\d+[a-z]?)$")


def split_letter_prefix(value: object) -> tuple[str, str] | None:
    match = _LETTER_PREFIXED.match(normalize_number(value) or "")
    return (match.group("letter"), match.group("number")) if match else None
