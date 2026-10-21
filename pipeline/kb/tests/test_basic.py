"""Unit and regression tests for KB pipeline: slugify, XML parsing, and section mapping."""

import re
from pathlib import Path

from kb.parser import (
    SECTION_MAPPING,
    clean_text_field,
    parse_xml_file,
    slugify,
    strip_markup,
)

CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache" / "xml"


def test_slugify_contract_examples():
    """Verify examples explicitly specified in contracts/kb.ts."""
    assert slugify("ul. Wielicka 28A, 30-553 Kraków") == "ul_wielicka_28a"
    assert slugify("ul. W. Reymonta 20") == "ul_reymonta_20"
    assert slugify("os. Złotego Wieku 2") == "os_zlotego_wieku_2"


def test_slugify_edge_cases_and_cleanups():
    """Verify edge cases: leading postal codes, office names, initials, and non-addresses."""
    # Postal code / building prefix
    assert (
        slugify("31-541 Kraków, al. Powstania Warszawskiego 10, Centrum Administracyjne")
        == "al_powstania_warszawskiego_10"
    )
    assert (
        slugify("Grodzki Urząd Pracy w Krakowie, ul. Wąwozowa 34, 31-752 Kraków")
        == "ul_wawozowa_34"
    )
    assert (
        slugify("Dziennik podawczy (parter), Rynek Podgórski 1,, 30-533 Kraków")
        == "rynek_podgorski_1"
    )
    assert (
        slugify("Punkt Obsługi Mieszkańców – Galeria Bronowice, 31-346 Kraków, ul. Stawowa 61, lokal nr 157")
        == "ul_stawowa_61"
    )
    assert (
        slugify("os. Centrum C 10 B, 31-931 Kraków")
        == "os_centrum_c_10b"
    )
    assert (
        slugify("ul. Wielicka 28 A, 30-552 Kraków")
        == "ul_wielicka_28a"
    )

    # Non-address intake strings must be rejected (empty slug)
    assert (
        slugify("W każdym punkcie podawczym Urzędu Miasta Krakowa (bez udziału pracownika merytorycznego)")
        == ""
    )


def test_slugify_conforms_to_contract_regex():
    """Any non-empty slug prefixed with 'urzad:' must pass the contract regex."""
    contract_regex = re.compile(r"^urzad:[a-z0-9]+(_[a-z0-9]+)*$")
    test_cases = [
        "ul. Wielicka 28A, 30-553 Kraków",
        "ul. W. Reymonta 20",
        "os. Złotego Wieku 2",
        "31-541 Kraków, al. Powstania Warszawskiego 10",
        "Grodzki Urząd Pracy w Krakowie, ul. Wąwozowa 34",
        "Dziennik podawczy, Rynek Podgórski 1",
        "Rynek Kleparski 4",
        "pl. Wszystkich Świętych 3-4",
    ]
    for addr in test_cases:
        s = slugify(addr)
        assert s != ""
        office_id = f"urzad:{s}"
        assert contract_regex.match(office_id) is not None, f"Failed regex: {office_id}"


def test_section_mapping_contract_fields():
    """Verify section mapping maps only to known Procedure.sections fields."""
    expected_fields = {
        "opis",
        "kogoDotyczy",
        "kryteria",
        "dokumenty",
        "oplaty",
        "sposob",
        "informacje",
        "termin",
        "komorka",
        "podstawaPrawna",
    }
    mapped_fields = set(SECTION_MAPPING.values())
    assert mapped_fields.issubset(expected_fields)


def test_parse_xml_sa34():
    """Verify parsing SA-34 XML card: symbol, 3 offices, hours, and booking URL."""
    sa34_path = CACHE_DIR / "SA-34.xml"
    if not sa34_path.exists():
        return

    procedure = parse_xml_file(sa34_path)
    assert procedure is not None
    assert procedure["symbol"] == "SA-34"
    assert "PESEL" in procedure["title"]

    offices = procedure["offices"]
    assert len(offices) == 3

    office_ids = {o["id"] for o in offices}
    assert office_ids == {
        "urzad:al_powstania_warszawskiego_10",
        "urzad:ul_wielicka_28a",
        "urzad:os_zgody_2",
    }

    for o in offices:
        assert o["hours"] is not None and "18.00" in o["hours"]
        assert o["bookingUrl"] is not None and o["bookingUrl"].startswith("https://umawianiewizyt.um.krakow.pl")
        assert o["phone"] is not None
        assert o["coords"] is None


def test_strip_markup_cleans_escaped_html_in_office_cells():
    """BIP cells contain escaped HTML: literal tags and empty lines must not reach the UI."""
    assert strip_markup("ul. Mogilska 41, parter, , 31-545 Kraków") == "ul. Mogilska 41, parter, 31-545 Kraków"
    assert strip_markup("ul. Wielicka 28a, 30-552 Kraków, , , ") == "ul. Wielicka 28a, 30-552 Kraków"
    assert strip_markup("Wydział Mieszkalnictwa,<br/>Referat Regulacji Tytułów Prawnych (ML-01)") == (
        "Wydział Mieszkalnictwa, Referat Regulacji Tytułów Prawnych (ML-01)"
    )
    assert strip_markup("07:30 – 15:30<br/>od poniedziałku do piątku<br/>") == "07:30 – 15:30, od poniedziałku do piątku"
    assert strip_markup("12 616 9661, 12 616 9594<br/>") == "12 616 9661, 12 616 9594"
    assert clean_text_field(" <br/> ") is None
