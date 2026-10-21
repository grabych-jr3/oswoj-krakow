import h3

from oswoj_geo.access import CONTROL, render_report, score


def test_score_groups():
    assert score({"zlobek", "przedszkole", "szkola_podstawowa", "park", "biblioteka", "przystanek"}) == (
        100,
        [],
    )
    # klub_dzieciecy stands for the 0–3 care group, a pocket park for green space
    assert score({"klub_dzieciecy", "park_kieszonkowy", "przystanek"}) == (
        50,
        ["przedszkole", "szkola_podstawowa", "biblioteka"],
    )
    assert score(set()) == (
        0,
        ["zlobek", "przedszkole", "szkola_podstawowa", "park", "biblioteka", "przystanek"],
    )


def test_report_reads_the_control_addresses():
    name, (lng, lat) = next(iter(CONTROL.items()))
    cell = h3.latlng_to_cell(lat, lng, 9)
    places = [{"name": "Przedszkole", "category": "przedszkole"}, {"name": "Stop", "category": "przystanek"}]
    payload = {
        "res": 9,
        "method": "test",
        "cells": [cell],
        "modes": {
            "walk": [{"c": [0], "p": [[1, 2], [0, 9]]}],
            "transit": [{"c": [0], "p": [[1, 2], [0, 9]]}],
        },
    }
    report = render_report(payload, places)
    assert f"### {name}" in report
    assert "przedszkole: Przedszkole 9 min; przystanek: Stop 2 min" in report
    assert "| walk | 33 | 2 | 1 |" in report
    assert "outside the grid" in report  # the other control addresses are not in this one-cell grid
