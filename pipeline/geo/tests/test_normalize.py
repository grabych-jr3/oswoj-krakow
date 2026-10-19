from oswoj_geo.normalize import format_phone, normalize_record, normalize_value


def test_float_integers_become_ints():
    assert normalize_value(108.0) == 108
    assert isinstance(normalize_value(108.0), int)
    assert normalize_value(8.2419) == 8.2419
    assert normalize_value("1.000000000000000e+000") == 1


def test_strings_are_trimmed_and_blank_is_none():
    assert normalize_value(" Kraków") == "Kraków"
    assert normalize_value("30-534 ") == "30-534"
    assert normalize_value("Limanowskiego  4") == "Limanowskiego 4"
    assert normalize_value("   ") is None
    assert normalize_value("08") == "08"  # house numbers stay strings


def test_phones():
    assert format_phone(124117430) == "12 411 74 30"
    assert format_phone(1.2411743e8) == "12 411 74 30"
    assert format_phone(602454775) == "602 454 775"
    assert format_phone("12 422 49 35") == "12 422 49 35"
    assert format_phone("+48 124 117 430") == "12 411 74 30"
    assert format_phone("12 411 74 30 wew. 12") == "12 411 74 30 wew. 12"
    assert format_phone(None) is None
    assert format_phone("") is None


def test_record_keys_and_phone_fields():
    record = {
        "Liczba miejsc ": 52.0,
        "Miejscowość": " Kraków",
        "Telefon": 124117430,
        "infolinia": "501 678 116 ",
        "Numer lokalu": None,
        "Lp": 1,
    }
    assert normalize_record(record) == {
        "Liczba miejsc": 52,
        "Miejscowość": "Kraków",
        "Telefon": "12 411 74 30",
        "infolinia": "501 678 116",
        "Numer lokalu": None,
        "Lp": 1,
    }
