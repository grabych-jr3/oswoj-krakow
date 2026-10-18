import json
import re
import unicodedata
from pathlib import Path
from typing import Any
from lxml import etree, html
from markdownify import markdownify as md

XML_CACHE_DIR = Path(".cache/xml")
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SECTION_MAPPING = {
    "krótki opis usługi": "opis",
    "kogo dotyczy usługa": "kogoDotyczy",
    "kogo dotyczy": "kogoDotyczy",
    "kryteria dla realizacji usług": "kryteria",
    "kryteria": "kryteria",
    "wymagane dokumenty": "dokumenty",
    "opłaty": "oplaty",
    "sposób realizacji usługi": "sposob",
    "sposób i miejsce składania dokumentów": "sposob",
    "informacje dodatkowe": "informacje",
    "termin załatwienia": "termin",
    "termin realizacji": "termin",
    "odpowiedzialna komórka organizacyjna": "komorka",
    "podstawa prawna": "podstawaPrawna",
}


def slugify(text: str) -> str:
    """Генерирует slug: 'al. Powstania Warszawskiego 10' -> 'al-powstania-warszawskiego-10'"""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text).strip("-")
    return text


def clean_markdown(html_text: str | None) -> str | None:
    """Переводит сырой HTML секции в Markdown без лишних пустот."""
    if not html_text:
        return None
    text = md(html_text, heading_style="ATX", strip=["script", "style"])
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text if text else None


def clean_address(raw_addr: str) -> str:
    """Очищает строку адреса."""
    addr = re.sub(r"(?i)<br\s*/?>", ", ", raw_addr)
    addr = re.sub(r"<[^>]+>", " ", addr)
    addr = re.sub(r"\s+", " ", addr).strip()
    return addr


def parse_offices_from_html(html_content: str | None) -> list[dict[str, Any]]:
    """Парсит отделения из HTML-таблицы или текста."""
    if not html_content:
        return []

    offices = []
    try:
        doc = html.fromstring(html_content)
    except Exception:
        return []

    tables = doc.xpath("//table")
    if tables:
        rows = tables[0].xpath(".//tr")
        for tr in rows:
            tds = tr.xpath("./td")
            if not tds or len(tds) < 2:
                continue

            name = tds[0].text_content().strip()
            raw_addr = tds[1].text_content().strip()

            if not raw_addr or "adres" in raw_addr.lower() or "nazwa" in name.lower():
                continue

            addr = clean_address(raw_addr)
            base_addr_match = re.search(r"^(?:ul\.|al\.|os\.|pl\.)?[^,]+?\d+[a-zA-Z]?", addr)
            slug_part = base_addr_match.group(0) if base_addr_match else addr.split(",")[0]
            office_id = f"urzad:{slugify(slug_part)}"

            hours = tds[2].text_content().strip() if len(tds) > 2 else None
            hours = re.sub(r"\s+", " ", hours) if hours else None

            booking_url = None
            links = tr.xpath(".//a/@href")
            for link in links:
                if "umawianiewizyt" in link or "umow" in link:
                    booking_url = link.strip()
                    break

            phone = None
            text_all = tr.text_content()
            phone_match = re.search(r"(?:\+48\s*)?(?:\(?\d{2}\)?[\s-]?)?\d{3}[\s-]?\d{2}[\s-]?\d{2}", text_all)
            if phone_match:
                phone = phone_match.group(0).strip()

            offices.append({
                "id": office_id,
                "name": name if name else "Urząd Miasta Krakowa",
                "address": addr,
                "hours": hours if hours else None,
                "bookingUrl": booking_url,
                "phone": phone,
                "coords": None,
            })

    return offices


def parse_xml_file(file_path: Path) -> dict[str, Any] | None:
    try:
        tree = etree.parse(str(file_path))
    except Exception as e:
        print(f"Ошибка чтения {file_path.name}: {e}")
        return None

    root = tree.getroot()

    # 1. Заголовок
    naglowek = root.find("Naglowek")
    if naglowek is None:
        return None

    symbol = (naglowek.findtext("Symbol") or file_path.stem).strip()
    title = (naglowek.findtext("Tytul") or "").strip()
    department = (naglowek.findtext("Wydzial") or "").strip() or None

    # 2. Метка
    metka = root.find("Metka")
    version = None
    published_at = None
    if metka is not None:
        ver_text = metka.findtext("Wersja")
        if ver_text and ver_text.isdigit():
            version = int(ver_text)
        published_at = metka.findtext("DataPublikacji") or None

    # 3. Секции
    sections = {v: None for v in SECTION_MAPPING.values()}
    offices = []

    for elem in root.xpath("//TrescUslugi/Element"):
        t_el = elem.find("Tytul")
        c_el = elem.find("Tresc")
        if t_el is None or c_el is None:
            continue

        # ВАЖНО: берем весь текст внутри Tytul, даже если он внутри <h3>
        raw_title = elem.xpath("string(./Tytul)").strip().lower()
        html_content = c_el.text or ""

        # Если это секция отделений
        if "miejsce" in raw_title and ("składania" in raw_title or "przyjmowania" in raw_title):
            parsed_offices = parse_offices_from_html(html_content)
            if parsed_offices:
                offices = parsed_offices

        # Сопоставляем с текстовыми секциями контракта
        for pattern, field_name in SECTION_MAPPING.items():
            if pattern in raw_title:
                sections[field_name] = clean_markdown(html_content)
                break

    # 4. Вложения
    attachments = []
    for zal in root.xpath("//ZalacznikiUslugi/Zalacznik"):
        nazwa = zal.findtext("Nazwa") or "Załącznik"
        url = zal.findtext("Url") or zal.findtext("Plik")
        if url and url.startswith("http"):
            attachments.append({"title": nazwa.strip(), "url": url.strip()})

    procedure = {
        "symbol": symbol,
        "title": title,
        "bipUrl": f"https://www.bip.krakow.pl/uslugi/{symbol}",
        "department": department,
        "version": version,
        "publishedAt": published_at,
        "tags": [],
        "relevance": 1.0,
        "sections": sections,
        "offices": offices,
        "attachments": attachments,
    }
    return procedure


def run_pipeline() -> None:
    xml_files = list(XML_CACHE_DIR.glob("*.xml"))
    print(f"Найдено XML-файлов для парсинга: {len(xml_files)}")

    all_procedures = []
    all_offices_map: dict[str, dict[str, Any]] = {}

    for idx, f in enumerate(xml_files, 1):
        proc = parse_xml_file(f)
        if proc:
            all_procedures.append(proc)
            for off in proc["offices"]:
                if off["id"] not in all_offices_map:
                    all_offices_map[off["id"]] = off

        if idx % 100 == 0 or idx == len(xml_files):
            print(f"Обработано {idx}/{len(xml_files)}...")

    offices_list = list(all_offices_map.values())

    proc_file = OUTPUT_DIR / "procedures.json"
    offices_file = OUTPUT_DIR / "offices_raw.json"

    proc_file.write_text(json.dumps(all_procedures, ensure_ascii=False, indent=2), encoding="utf-8")
    offices_file.write_text(json.dumps(offices_list, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\nПарсинг успешно завершен!")
    print(f"- Процедур сохранено: {len(all_procedures)} -> {proc_file}")
    print(f"- Уникальных отделений для геокодирования: {len(offices_list)} -> {offices_file}")


if __name__ == "__main__":
    run_pipeline()