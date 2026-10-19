"""Client for the Kraków open data API (https://api.um.krakow.pl, PLAN.md §3.1, §3.2 p.1).

Pages hold 100 records. ``nextLink`` points at an internal host
(``https://srv-app-querona:<port>/api/<table>?$after=…``), so we keep only its query
string and append it to the public table URL. ``$skip``/``$top`` are not supported.
"""

from typing import Any
from urllib.parse import urlsplit

import httpx

API_BASE = "https://api.um.krakow.pl"
USER_AGENT = "oswoj-krakow-pipeline (+https://github.com/grabych-jr3/oswoj-krakow)"
MAX_PAGES = 1000  # guard against a nextLink loop


class PortalError(RuntimeError):
    pass


def table_url(api: str, table: str) -> str:
    return f"{API_BASE}/{api}/v1/{table}"


def public_next_url(next_link: str, api: str, table: str) -> str:
    """Rewrite an internal ``nextLink`` to the public endpoint of the same table."""
    query = urlsplit(next_link).query
    if not query:
        raise PortalError(f"nextLink without a cursor: {next_link}")
    return f"{table_url(api, table)}?{query}"


def make_client(timeout: float = 60.0) -> httpx.Client:
    transport = httpx.HTTPTransport(retries=3)
    return httpx.Client(
        timeout=timeout, headers={"User-Agent": USER_AGENT}, transport=transport, follow_redirects=True
    )


class PortalClient:
    def __init__(self, client: httpx.Client) -> None:
        self.client = client

    def _get_json(self, url: str) -> dict[str, Any]:
        response = self.client.get(url)
        if response.status_code != 200:
            raise PortalError(f"GET {url} → {response.status_code}: {response.text[:200]}")
        data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("value"), list):
            raise PortalError(f"GET {url}: unexpected payload {str(data)[:200]}")
        return data

    def fetch_table(self, api: str, table: str) -> list[dict[str, Any]]:
        """All records of a table, following ``nextLink`` pages."""
        url: str | None = table_url(api, table)
        records: list[dict[str, Any]] = []
        for _ in range(MAX_PAGES):
            if url is None:
                return records
            page = self._get_json(url)
            records.extend(page["value"])
            next_link = page.get("nextLink")
            url = public_next_url(next_link, api, table) if next_link else None
        raise PortalError(f"{api}/{table}: more than {MAX_PAGES} pages")

    def metadata(self, api: str) -> list[dict[str, Any]]:
        """Tables of an API (``object_name``, ``number_of_rows``, ``last_refresh``)."""
        return self._get_json(f"{API_BASE}/{api}/v1/metadata")["value"]
