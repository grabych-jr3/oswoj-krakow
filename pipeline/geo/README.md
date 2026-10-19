# pipeline/geo — Geo & Data (stream A)

uv project, Python 3.12. See PLAN.md §3 (sources, quirks) and §6.A (tasks).

```bash
uv sync
uv run geo-fetch                 # download every source into .cache/raw (cached files are reused)
uv run geo-fetch --skip-large    # everything except the OSM PBF (~200 MB)
uv run geo-fetch biblioteki dzielnice --refresh   # selected sources, re-downloaded
uv run ruff check && uv run pytest
```

- `.cache/` is gitignored. `.cache/manifest.json` lists URL, fetch time and record count / size per source.
- Raw portal responses are stored as fetched; `oswoj_geo.fetch.load_table(name)` returns normalized records
  (integer floats → ints, trimmed keys and strings, phones as `12 411 74 30` / `602 454 775`).
- Portal `nextLink` points at an internal host; the client keeps only its `$after` cursor.
- Source registry: `src/oswoj_geo/sources.py`.
