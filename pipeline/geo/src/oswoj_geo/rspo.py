"""RSPO, the national register of schools and kindergartens (rspo.gov.pl).

The portal's education tables carry the RSPO number but lose house numbers with letters ("76b"
arrives as null). The register's public search site serves each institution as JSON at
``/api/Institution/<rspo>``; we read only its street and building number, at most 1 request/s,
with every answer cached on disk.
"""

import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx

INSTITUTION_URL = "https://rspo.gov.pl/api/Institution/{rspo}"
MIN_INTERVAL_S = 1.0


class RspoClient:
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
        self._cache: dict[str, dict[str, Any] | None] = (
            json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
        )

    def address(self, rspo: str) -> dict[str, Any] | None:
        """``{"street", "number", "postal"}`` of the institution's seat, or None if unknown."""
        if rspo not in self._cache:
            if self._last is not None:
                wait = self.min_interval_s - (self._clock() - self._last)
                if wait > 0:
                    self._sleep(wait)
            response = self.client.get(INSTITUTION_URL.format(rspo=rspo),
                                       headers={"Accept": "application/json"})
            self._last = self._clock()
            if response.status_code == 404:
                self._cache[rspo] = None
            else:
                response.raise_for_status()
                data = response.json()
                self._cache[rspo] = {
                    "street": data.get("hqAddressStreet"),
                    "number": data.get("hqAddressBuildingNr"),
                    "postal": data.get("hqAddressZipCode"),
                }
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps(self._cache, ensure_ascii=False, indent=1),
                                       encoding="utf-8")
        return self._cache[rspo]
