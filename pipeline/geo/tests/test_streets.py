from oswoj_geo.streets import (
    base_number,
    fold,
    normalize_number,
    number_variants,
    split_letter_prefix,
    split_number_from_street,
    street_key,
)


def test_fold():
    assert fold("Generała Łokietka") == "generala lokietka"
    assert fold("Bora-Komorowskiego") == "bora komorowskiego"


def test_street_key_keeps_kind_and_drops_titles_and_initials():
    assert street_key("ul. W. Reymonta") == street_key("Reymonta")
    assert street_key("gen. Józefa Bema").tokens == ("jozefa", "bema")
    assert street_key("Generała Józefa Bema").tokens == ("jozefa", "bema")
    assert street_key("os. Zgody").kind == "osiedle"
    assert street_key("Zgody").kind is None
    assert street_key("al. 3 Maja") == street_key("Aleja 3 Maja")
    assert street_key("Marii i Bolesława Wysłouchów").tokens == ("marii", "boleslawa", "wyslouchow")


def test_street_key_tolerates_kind_typos_and_repeats():
    assert street_key("Osiede Oświecenia") == street_key("Osiedle Oświecenia")
    assert street_key("pl. Plac Na Groblach") == street_key("Plac Na Groblach")


def test_numbers():
    assert normalize_number(28.0) == "28"
    assert normalize_number("28 A") == "28a"
    assert normalize_number(None) is None
    assert number_variants("6b/LU2") == ["6b/lu2", "6b"]
    assert number_variants("80") == ["80"]
    assert number_variants(None) == []
    assert base_number("1A") == "1"
    assert base_number("2u") == "2"
    assert base_number("12") is None


def test_number_inside_street_field():
    assert split_number_from_street("Kapelanka 6A/LU 15") == ("Kapelanka", "6A")
    assert split_number_from_street("Barska 69/U6") == ("Barska", "69")
    assert split_number_from_street("Wielicka") is None


def test_letter_prefixed_number():
    assert split_letter_prefix("E14") == ("e", "14")
    assert split_letter_prefix("14") is None
