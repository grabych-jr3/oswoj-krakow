# pipeline/geo — Geo & Data (stream A)

uv project, Python 3.12. See PLAN.md §3 (sources, quirks) and §6.A (tasks).

```bash
uv sync
uv run geo-fetch                 # download every source into .cache/raw (cached files are reused)
uv run geo-fetch --skip-large    # everything except the OSM PBF (~200 MB)
uv run geo-fetch biblioteki dzielnice --refresh   # selected sources, re-downloaded
uv run geo-geocode               # geocode all place datasets (A2), write reports/geocoding.md
uv run geo-geocode --offline     # EMUiA only, no network
uv run geo-layers                # A3: app/public/data/layers/<category>.geojson + index.json
uv run ruff check && uv run pytest
```

## Raw data (A1)

- `.cache/` is gitignored. `.cache/manifest.json` lists URL, fetch time and record count / size per source.
- Raw portal responses are stored as fetched; `oswoj_geo.fetch.load_table(name)` returns normalized records
  (integer floats → ints, trimmed keys and strings, phones as `12 411 74 30` / `602 454 775`).
- Portal `nextLink` points at an internal host; the client keeps only its `$after` cursor.
- Source registry: `src/oswoj_geo/sources.py` (with the portal page and "Stan danych na" date per table).

## Geocoding (A2)

- Coordinates come from EMUiA address points (MSIP, EPSG:2178 → 4326). Street lookup: exact key →
  partial ("Kutrzeby" → "Generała Tadeusza Kutrzeby") → fuzzy; street kind (osiedle/aleja/plac) and
  postal code break ties, a wrong postal code never rejects a match.
- The portal stores "Nr domu" as a number, so "28A" arrives as null. Kindergartens and schools carry an
  RSPO number: their building number is read from the national register (`rspo.gov.pl/api/Institution/<rspo>`,
  1 request/s, cached in `.cache/rspo.json`), used only if the RSPO street is the city record's street.
  Checked on 52 records also found via OSM: same building 40, neighbouring building (≤125 m) 10, wrong 2,
  so RSPO goes first.
- Next, Nominatim (OSM) is asked for the institution; its house number is accepted only if the street and the institution
  ("nr 129" or a distinctive name word) match, and the point is then taken from EMUiA again.
  Nominatim answers are cached in `.cache/nominatim.json` (1 request/s).
- Still without a number: named institutions from OSM (one Overpass query, cached in
  `.cache/osm_institutions.json`). Accepted only if the OSM type fits the dataset, the "nr" and every
  distinctive name word agree, and the object lies ≤ 60 m from an EMUiA point of the source street;
  that EMUiA point becomes the address.
- `manual_fixes.csv` (`dataset,key,street,number,lon,lat,note`): a corrected address or coordinates for
  one record; the note must say where the fix comes from.
- Output: `.cache/geocoded/<dataset>.json` (input for A3) and `reports/geocoding.md` (committed).

## Map layers (A3)

- `uv run geo-layers` turns the geocoded places into `app/public/data/layers/<category>.geojson`
  (`FeatureCollection<Point>`, `properties` = `Place` without `coords`, PLAN.md §5.3) and `index.json`
  (`{ generatedAt, categories: [{ category, count, updatedAt, source: SourceRef[] }] }`).
- Seven categories: zlobek (3 datasets), klub_dzieciecy, przedszkole, szkola_podstawowa,
  szkola_ponadpodstawowa, klub_rodzica, biblioteka. Ids: `<category>:rspo-<n>` for schools and
  kindergartens, `<category>:<slug of name, street, number, premise>` otherwise.
- `attrs.location` is `address` or `street`; street-level places sit on their street, not the building.
- ALL-CAPS register names are rewritten for display (Roman numerals, "nr", "im.", acronyms kept);
  addresses use the EMUiA street name and postal code ("ul. Bolesława Limanowskiego 4, 30-534 Kraków").
- `app/scripts/validate-geo.ts` checks every layer against the `Place` contract, the Kraków bbox,
  unique ids and the counts in `index.json`.
