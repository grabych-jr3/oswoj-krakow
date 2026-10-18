import json
from pathlib import Path

FIXTURES_DIR = Path("output/fixtures")
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

PROCEDURES_FILE = Path("output/procedures.json")


def export_procedure_sa34():
    procedures = json.loads(PROCEDURES_FILE.read_text(encoding="utf-8"))
    sa34 = next((p for p in procedures if p["symbol"] == "SA-34"), None)
    if not sa34:
        print("Внимание: SA-34 не найдена, берем первую процедуру как образец")
        sa34 = procedures[0]

    out_file = FIXTURES_DIR / "procedure.SA-34.json"
    out_file.write_text(json.dumps(sa34, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Фикстура процедуры сохранена: {out_file}")


def export_sample_scenario():
    # Эталонный сценарий по схеме Scenario из contracts/kb.ts
    sample_scenario = {
        "id": "obywatel-ua",
        "locale": "pl",
        "title": "Pierwsze kroki dla obywateli Ukrainy w Krakowie",
        "forWhom": "Osoby przybywające z Ukrainy objęte ochroną czasową wraz z rodzinami.",
        "steps": [
            {
                "order": 1,
                "title": "Uzyskanie numeru PESEL ze statusem UKR",
                "why": "Niezbędny do legalnego pobytu, podjęcia pracy oraz korzystania ze świadczeń medycznych i socjalnych.",
                "when": "W ciągu 30 dni od momentu wjazdu do Polski",
                "procedureSymbols": ["SA-65"],
                "placeCategories": ["urzad"],
                "external": []
            },
            {
                "order": 2,
                "title": "Zapisanie dziecka do przedszkola lub szkoły",
                "why": "Dzieci w wieku 7-18 lat podlegają obowiązkowi szkolnemu w Polsce na takich samych warunkach jak obywatele RP.",
                "when": "Przed rozpoczęciem nauki lub w trakcie roku szkolnego",
                "procedureSymbols": ["SO-20"],
                "placeCategories": ["przedszkole", "szkola_podstawowa"],
                "external": []
            },
            {
                "order": 3,
                "title": "Rejestracja w Grodzkim Urzędzie Pracy",
                "why": "Dostęp do ofert pracy, bezpłatnych kursów języka polskiego i szkoleń zawodowych.",
                "when": None,
                "procedureSymbols": ["GUP-1", "GUP-2"],
                "placeCategories": ["urzad"],
                "external": [
                    {
                        "title": "Grodzki Urząd Pracy w Krakowie",
                        "url": "https://gupkrakow.praca.gov.pl"
                    }
                ]
            }
        ],
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SA-65",
            "https://gupkrakow.praca.gov.pl"
        ]
    }

    out_file = FIXTURES_DIR / "scenario.sample.json"
    out_file.write_text(json.dumps(sample_scenario, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Фикстура сценария сохранена: {out_file}")


if __name__ == "__main__":
    export_procedure_sa34()
    export_sample_scenario()