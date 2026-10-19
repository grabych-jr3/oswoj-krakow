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
    "User-Agent": "OswojKrakow-Bot/1.0 (Open Data App Contest; contact: team@oswojkrakow.pl)"
}


def fix_api_url(url: str) -> str:
    parsed = urlparse(url)
    if "srv-app-querona" in parsed.netloc:
        query = parsed.query
        return f"{BASE_API_URL}?{query}" if query else BASE_API_URL
    return url


def fetch_all_procedure_symbols() -> list[str]:
    """Скачивает список всех процедур через постраничный API портала."""
    symbols = []
    current_url = BASE_API_URL
    client = httpx.Client(headers=HEADERS, timeout=30.0)

    print("Получаем список процедур из API портала...")
    try:
        while current_url:
            resp = client.get(current_url)
            resp.raise_for_status()
            payload = resp.json()

            # API Кракова отдает записи в ключе 'value'
            records = payload.get("value", [])

            for item in records:
                # Ищем поле с символом (symbol / Symbol / symbol_procedury)
                symbol = None
                for key, val in item.items():
                    if "symbol" in key.lower() and val:
                        symbol = str(val).strip()
                        break
                if symbol:
                    symbols.append(symbol)

            # Пагинация через nextLink
            next_link = payload.get("nextLink")
            if next_link:
                current_url = fix_api_url(next_link)
                time.sleep(0.3)
            else:
                current_url = None
    finally:
        client.close()

    unique_symbols = list(dict.fromkeys(symbols))
    print(f"Всего найдено процедур: {len(unique_symbols)}")
    return unique_symbols


def download_bip_xmls(symbols: list[str]) -> None:
    client = httpx.Client(headers=HEADERS, timeout=30.0)
    print(f"Начинаем скачивание {len(symbols)} XML-карточек...")

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
                    print(f"[{idx}/{len(symbols)}] Скачано: {symbol}")
                else:
                    print(
                        f"[{idx}/{len(symbols)}] Ошибка {resp.status_code} для {symbol}"
                    )
            except Exception as e:  # noqa: BLE001
                print(f"[{idx}/{len(symbols)}] Исключение при скачивании {symbol}: {e}")

            time.sleep(1.0)
    finally:
        client.close()
    print("Скачивание завершено!")


if __name__ == "__main__":
    procedure_symbols = fetch_all_procedure_symbols()
    download_bip_xmls(procedure_symbols)
