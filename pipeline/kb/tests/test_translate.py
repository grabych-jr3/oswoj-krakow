"""Translation safeguards: protected spans survive, changed facts are rejected."""

from kb.translate import (
    card_lines,
    facts,
    is_valid,
    needs_translation,
    protect,
    unprotect,
)


def test_protect_wraps_facts_and_official_names():
    line = "Opłata 17 zł na konto 49 1020 2892 2276 3005 0000 0000, wniosek o PESEL: [formularz](https://bip.krakow.pl/a?x=1&y=2)"
    wrapped = protect(line)
    assert "<x>17</x>" in wrapped
    assert "<x>49 1020 2892 2276 3005 0000 0000</x>" in wrapped
    assert "<x>PESEL</x>" in wrapped
    assert "<x>](https://bip.krakow.pl/a?x=1&amp;y=2)</x>" in wrapped
    assert unprotect(wrapped) == line


def test_a_translation_must_keep_every_number_and_link():
    source = "Opłata 17 zł, termin 30 dni: https://bip.krakow.pl/uslugi/SA-34"
    assert is_valid(source, "Мито 17 злотих, строк 30 днів: https://bip.krakow.pl/uslugi/SA-34")
    assert not is_valid(source, "Мито 70 злотих, строк 30 днів: https://bip.krakow.pl/uslugi/SA-34")
    assert not is_valid(source, "Мито 17 злотих, строк 30 днів")
    assert not is_valid(source, "")
    assert facts("12 616 55 55") == facts("тел. 12 616 55 55")


def test_allowed_differences_do_not_reject_a_correct_translation():
    assert is_valid("czynna całą dobę", "open 24 hours")
    assert is_valid("[wzór](https://x.pl/document\\_library/a)", "[form](https://x.pl/document_library/a)")
    assert not is_valid("opłata 17 zł", "fee 24 zł")  # the 17 is gone


def test_only_lines_with_words_are_sent():
    assert needs_translation("1. Wniosek o wydanie dowodu.")
    assert not needs_translation("| --- | --- |")
    assert not needs_translation("49 1020 2892 2276 3005 0000 0000")
    assert not needs_translation("   ")


def test_card_lines_cover_title_and_visible_sections_only():
    proc = {"title": "Tytuł karty", "sections": {"dokumenty": "1. Wniosek\n\n| --- |", "podstawaPrawna": "Ustawa"}}
    assert card_lines(proc) == ["Tytuł karty", "1. Wniosek"]
