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

## Districts (A4)

- `uv run geo-districts` (after `geo-layers`) writes the 18 districts with `DistrictStats` to
  `app/public/data/layers/districts.geojson` (map) and the identical `app/data/geo/districts.json`
  (server, `getDistrict`), plus `reports/districts.md`.
- Boundaries: MSIP Dzielnice, `coverage_simplify` 5 m so neighbours share one border (no gaps or overlaps).
- residents / foreigners = registered permanent + temporary, 31.12.2025; top 5 citizenships ("INNE KRAJE",
  "NIEUSTALONE", "BEZPAŃSTWOWCY" are not countries and are left out); placeCounts from the A3 layers.
- Cross-check: every district table must add up to the detailed table of the same population
  (`*_szczegoly`); the command exits 1 otherwise.

## Parks (A5)

- `uv run geo-parks` (after `geo-districts`) writes `park.geojson` and `park_kieszonkowy.geojson`, adds
  them to `index.json` and writes `reports/parks.md`; then run `geo-districts` again for the park counts.
- The portal gives only name, district and area. Located in order: pocket parks in the city's ArcGIS
  polygons (same name, or same district and the same stated area for a renamed park); an OSM area with
  a matching name in the district and 1/3–3× the stated area (the point lies inside it); an OSM object
  with exactly the same name in the district (Nominatim; mostly the `tourism=checkpoint` posts).
- `attrs.location` is `area` (point inside the mapped park) or `point` (OSM point of the park).
- Matched polygons go to `.cache/parks_areas.geojson` for the 15-minute analysis (A8).
- Build order: `geo-fetch` → `geo-geocode` → `geo-layers` → `geo-districts` → `geo-parks` → `geo-stops` → `geo-districts`.

## Stops and P+R (A6)

- `uv run geo-stops` (after `geo-districts`) writes `przystanek.geojson` and `park_and_ride.geojson`.
- The ZTP layer has one feature per post ("Podgórze SKA 02", code `642-02`); posts are grouped into one
  stop per number (`przystanek:642`). Kept: groups `KMK` / `KMK_inny` and types A, T, TA and terminal
  platforms pA, pT, pTA. Left out: not served by KMK (`GMK`), private, suspended, temporary, virtual,
  service and historic stops, posts valid from a future date, stops with no post in Kraków.
- `attrs.lines` (e.g. "3, 13, 158") and the stop name come from the GTFS feeds A, T, M (`stop_code` =
  post code); `attrs.type` "A" | "T" | "AT"; stops without any GTFS trip keep `lines: null`.
- Source: the arcgis.com item pages of the ZTP layers (`SourceRef.dataset` "ztp-arcgis").
- Build order: … → `geo-parks` → `geo-stops` → `geo-districts` (counts per district).

## Offices (A7)

- `uv run geo-offices` reads `app/data/kb/offices_raw.json` and `procedures.json` (stream B) and writes the
  `urzad` layer: one place per office with B's id (`Office.id`), so `getPlace(office.id)` finds it.
- The free-text address is cut at commas, " - " and the postal code; room, floor and desk parts are
  skipped; each "street + number" part is tried against EMUiA, the first address-level hit wins. A number
  missing from EMUiA whose plain form is missing too ("8W") goes to the middle building of the lettered
  complex (8a…8j), flagged `~number`. Offices outside Kraków (postal code not 30-/31-) are left out.
- `attrs`: hours, bookingUrl, procedures ("SA-34,SA-65"), location; source = the first BIP card naming it.
- Run after B regenerates `offices_raw.json`; then `geo-districts` for the counts.

## 15 minutes (A8)

- `uv run geo-access` (after every layer) routes with r5py from each H3 cell (res 9, 3217 cells) to every
  place and every other cell, on foot (4.8 km/h) and by walk + KMK (GTFS A/T/M, Tuesday 2026-10-27 08:00,
  30-minute window, median); everything within 15 minutes is kept. About 6 minutes on 8 cores.
- Needs a JDK 21+ (`JAVA_HOME`; on Windows an installed JDK under `C:/Program Files/Java` is found).
  The departure date must lie inside the GTFS calendars: change `DEPARTURE` when the feeds are renewed.
- Writes `app/data/geo/places.json` (all places, the order the index uses), `app/data/geo/access.json`
  (per cell and mode: reachable cells and [place, minutes]), `app/public/data/layers/access-index.json`
  (`[h3, scoreWalk, scoreTransit]` per cell) and `reports/access.md` (5 control addresses).
- `uv run geo-access --report-only` rebuilds the report from those files; `--places-only` rewrites
  `places.json` after a layer changed only place details (same ids), without routing.
- Runtime: `app/src/server/geo/access.ts` maps a point to its cell (or a neighbour ≤ 2 rings away), unions
  the reachable cells into the zone (h3-js) and answers `nearby()` in under a millisecond.

## Fallback without r5py (A8b)

- `uv run geo-access --engine osmnx` computes the 15 minutes on foot only, on the OSM footway network of
  Kraków (osmnx via Overpass, cached in `.cache/osmnx`), with Dijkstra at the same 4.8 km/h — no Java.
  The data format is the same; `transit` repeats the walking reach and `method` says so. It overwrites
  `app/data/geo` unless `--out <dir>` is given.
- Cross-check against r5py (walk, 2026-10-21): same «Indeks 15 minut» at all 5 control addresses and in
  82% of cells; reachable places overlap 89% (median Jaccard); minutes within ±1 for 84% of places,
  osmnx 0.65 min slower on average.
- `uv run geo-isochrones`: ZTP's walking isochrones to KMK stops (100–500 m, July 2026) merged into
  distance bands and sampled on H3 res 10 → `app/public/data/layers/stop-isochrones.json`
  (`{res, levels, source, cells: [[h3, toM]]}`, ~0.3 MB). 54% of Kraków's area is within 500 m of a
  stop on foot, 27% within 300 m.

## Geocoder and places for the server (A9)

- `uv run geo-addresses` turns the 70k EMUiA points into `app/data/geo/addresses.json` (~2.4 MB): streets
  with their postal form ("ul. Wielicka"), folded search key and kind, and per number `[number, lng, lat,
  postal index, district]` (5 decimals). Run it whenever EMUiA is refreshed.
- `app/src/server/geo/geocode.ts` answers `/api/geocode`: every query word may start a street word
  ("wiel" → ul. Wielicka), Polish letters optional, one typo (or two swapped letters) forgiven, the house
  number may be partial ("2" → 2, 2a, 20…), osiedle/aleja/plac decide ties ("os. Zgody 2" vs "Zgody 2"),
  longer streets win equal scores; ~0.5 ms per query. `reverse()` names the `nearby()` origin by the
  nearest address within 60 m.
- `places.ts`: `findPlaces` / `getPlace` over `places.json` (all layers). `GEO_IMPL=real` is fully real;
  `GEO_IMPL=mock` keeps the A0 fixtures.
- Full rebuild order: `geo-fetch` → `geo-geocode` → `geo-layers` → `geo-districts` → `geo-parks` →
  `geo-stops` → `geo-offices` → `geo-districts` → `geo-access` (Java) → `geo-isochrones`, `geo-addresses`.
