import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[4]

FIXTURES_DIR = ROOT_DIR / "app" / "src" / "contracts" / "fixtures"
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

PROCEDURES_FILE = ROOT_DIR / "app" / "data" / "kb" / "procedures.json"



def export_procedure_sa34():
    procedures = json.loads(PROCEDURES_FILE.read_text(encoding="utf-8"))
    sa34 = next((p for p in procedures if p["symbol"] == "SA-34"), None)
    if not sa34:
        print("Warning: SA-34 not found, falling back to first procedure")
        sa34 = procedures[0]

    out_file = FIXTURES_DIR / "procedure.SA-34.json"
    out_file.write_text(
        json.dumps(sa34, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Procedure fixture exported: {out_file}")


def export_sample_scenario():
    # Canonical scenario adhering to Scenario schema in contracts/kb.ts
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
                "when": None,
                "procedureSymbols": ["SA-65"],
                "placeCategories": ["urzad"],
                "external": [],
            },
            {
                "order": 2,
                "title": "Zameldowanie i zgłoszenie adresu zamieszkania",
                "why": "Oficjalna rejestracja miejsca zamieszkania w Krakowie ułatwiająca rekrutację do przedszkoli i szkół.",
                "when": "Najpóźniej w 4. dniu od przybycia (jeśli pobyt czasowy przekracza 30 dni)",
                "procedureSymbols": ["SA-12"],
                "placeCategories": ["urzad"],
                "external": [],
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
                        "url": "https://gupkrakow.praca.gov.pl",
                    }
                ],
            },
        ],
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SA-65",
            "https://www.bip.krakow.pl/uslugi/SA-12",
            "https://gupkrakow.praca.gov.pl",
        ],
    }

    out_file = FIXTURES_DIR / "scenario.sample.json"
    out_file.write_text(
        json.dumps(sample_scenario, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Scenario fixture exported: {out_file}")


if __name__ == "__main__":
    export_procedure_sa34()
    export_sample_scenario()
