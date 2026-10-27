# Oswój Kraków — Knowledge Base Pipeline (Stream B)

This directory contains the data crawler, XML parser, tagger, and scenario builder for the Knowledge Base of Oswój Kraków (BIP procedures, municipal offices, and life scenarios).

## Setup

Make sure you have [uv](https://docs.astral.sh/uv/) installed.

```bash
cd pipeline/kb
uv sync
```

## Running the Pipeline

1. **Download BIP XML procedures (Crawler)**:
   Fetches procedure metadata from the Kraków Open Data portal API and downloads corresponding BIP XML cards into `.cache/xml/` (rate limited to 1 req/s):
   ```bash
   uv run python src/kb/crawler.py
   ```

2. **Parse XML cards & extract offices (Parser)**:
   Parses all cached XML files, normalizes office addresses and generates canonical office slugs (`urzad:<street_number>`), saving outputs directly into `app/data/kb/procedures.json` and `app/data/kb/offices_raw.json`:
   ```bash
   uv run python src/kb/parser.py
   ```

3. **Tag procedures & assign relevance (Tagger)**:
   Applies deterministic rule-based tagging (`przeprowadzka`, `obywatel_ua`, `cudzoziemiec`, etc.) and relevance scoring to `app/data/kb/procedures.json`:
   ```bash
   uv run python src/kb/tagger.py
   ```

4. **Translate cards to Ukrainian and English (Translate)**:
   Translates the title and visible sections of every card once and writes `Procedure.translations` into `app/data/kb/procedures.json`. DeepL takes the important cards (relevance >= 0.7) while the free monthly quota lasts; gpt-oss on Infercom takes the rest. Amounts, account numbers, links and official Polish names are protected, and a line whose numbers or links changed is rejected. Re-run it monthly after the parser and tagger: only new or changed lines are sent. Needs `DEEPL_API_KEY` and `INFERCOM_API_KEY` in `pipeline/kb/.env`:
   ```bash
   uv run python src/kb/translate.py            # --dry-run counts characters, --only SA-34 for one card
   ```

4. **Build Life Scenarios (Scenarios)**:
   Generates verified multilingual step-by-step checklists in PL, UK, and EN (`app/data/kb/scenarios.{pl,uk,en}.json`):
   ```bash
   uv run python src/build_scenarios.py
   ```

5. **Generate Contract Fixtures**:
   Exports sample procedure (`procedure.SA-34.json`) and scenario fixture for contract testing:
   ```bash
   uv run python src/kb/make_fixtures.py
   ```

## Running Tests & Linters

```bash
uv run pytest
uv run ruff check
```
