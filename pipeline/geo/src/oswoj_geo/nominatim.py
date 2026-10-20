"""Nominatim fallback (PLAN.md §3.2 p.3): at most 1 request/s, every answer cached on disk.

Used only to recover a house number the source lost (the portal stores "Nr domu" as a number,
so "28A" arrives as null); coordinates still come from EMUiA.
"""

import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx

SEARCH_URL = "https://nominatim.openstreetmap.org/search"
KRAKOW_VIEWBOX = "19.79,50.13,20.22,49.96"  # lon_min,lat_max,lon_max,lat_min
MIN_INTERVAL_S = 1.1


class NominatimClient:
    def __init__(
        self,
        client: httpx.Client,
        cache_path: Path,
        min_interval_s: float = MIN_INTERVAL_S,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.client = client
        self.cache_path = cache_path
        self.min_interval_s = min_interval_s
        self._sleep = sleep
        self._clock = clock
        self._last: float | None = None
        self._cache: dict[str, list[dict[str, Any]]] = (
            json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
        )

    def search(self, query: str) -> list[dict[str, Any]]:
        if query in self._cache:
            return self._cache[query]
        if self._last is not None:
            wait = self.min_interval_s - (self._clock() - self._last)
            if wait > 0:
                self._sleep(wait)
        params = {"q": query, "format": "jsonv2", "addressdetails": "1", "limit": "5", "countrycodes": "pl",
                  "viewbox": KRAKOW_VIEWBOX, "bounded": "1", "accept-language": "pl"}
        response = self.client.get(SEARCH_URL, params=params)
        self._last = self._clock()
        response.raise_for_status()
        results = response.json()
        self._cache[query] = results
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(self._cache, ensure_ascii=False, indent=1), encoding="utf-8")
        return results
