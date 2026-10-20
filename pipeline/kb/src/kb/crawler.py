import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

CACHE_DIR = Path(".cache")
XML_CACHE_DIR = CACHE_DIR / "xml"
XML_CACHE_DIR.mkdir(parents=True, exist_ok=True)

BASE_API_URL = "https://api.um.krakow.pl/opendata-administracja-lista-uslug-i-procedur/v1/uslugi-adm-procedury-zew-gmk"
BIP_XML_URL_TEMPLATE = "https://www.bip.krakow.pl/uslugi/xml/{symbol}"

HEADERS = {
    "User-Agent": "oswoj-krakow-pipeline (+https://github.com/grabych-jr3/oswoj-krakow)"
}


def fix_api_url(url: str) -> str:
    parsed = urlparse(url)
    if "srv-app-querona" in parsed.netloc:
        query = parsed.query
        return f"{BASE_API_URL}?{query}" if query else BASE_API_URL
    return url


def fetch_all_procedure_symbols() -> list[str]:
    """Fetch all procedure symbols via paginated open data portal API."""
    symbols = []
    current_url = BASE_API_URL
    client = httpx.Client(headers=HEADERS, timeout=30.0)

    print("Fetching procedure symbols from open data portal API...")
    try:
        while current_url:
            resp = client.get(current_url)
            resp.raise_for_status()
            payload = resp.json()

            records = payload.get("value", [])

            for item in records:
                symbol = None
                for key, val in item.items():
                    if "symbol" in key.lower() and val:
                        symbol = str(val).strip()
                        break
                if symbol:
                    symbols.append(symbol)

            next_link = payload.get("nextLink")
            if next_link:
                current_url = fix_api_url(next_link)
                time.sleep(0.3)
            else:
                current_url = None
    finally:
        client.close()

    unique_symbols = list(dict.fromkeys(symbols))
    print(f"Total procedures found: {len(unique_symbols)}")
    return unique_symbols


def download_bip_xmls(symbols: list[str]) -> None:
    client = httpx.Client(headers=HEADERS, timeout=30.0)
    print(f"Starting download of {len(symbols)} XML cards...")

    try:
        for idx, symbol in enumerate(symbols, 1):
            file_path = XML_CACHE_DIR / f"{symbol}.xml"
            if file_path.exists():
                continue

            url = BIP_XML_URL_TEMPLATE.format(symbol=symbol)
            try:
                resp = client.get(url)
                if resp.status_code == 200:
                    file_path.write_text(resp.text, encoding="utf-8")
                    print(f"[{idx}/{len(symbols)}] Downloaded: {symbol}")
                else:
                    print(
                        f"[{idx}/{len(symbols)}] HTTP error {resp.status_code} for {symbol}"
                    )
            except Exception as e:  # noqa: BLE001
                print(f"[{idx}/{len(symbols)}] Exception downloading {symbol}: {e}")

            time.sleep(1.0)
    finally:
        client.close()
    print("Download completed successfully!")


if __name__ == "__main__":
    procedure_symbols = fetch_all_procedure_symbols()
    download_bip_xmls(procedure_symbols)
