import html
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from lxml import etree
from lxml import html as lhtml
from markdownify import markdownify as md

ROOT_DIR = Path(__file__).resolve().parents[4]
XML_CACHE_DIR = Path(".cache/xml")
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
APP_KB_DIR = ROOT_DIR / "app" / "data" / "kb"
APP_KB_DIR.mkdir(parents=True, exist_ok=True)

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
    """Generate office slug following the kb.ts contract.

    Target structure: street + house number (lowercase, ł->l, diacritics stripped,
    name initials removed, non-alphanumeric chars replaced with single underscore).
    Examples:
    - 'ul. Wielicka 28A, 30-553 Kraków' -> 'ul_wielicka_28a'
    - 'ul. W. Reymonta 20' -> 'ul_reymonta_20'
    - 'os. Złotego Wieku 2' -> 'os_zlotego_wieku_2'
    - 'Grodzki Urząd Pracy w Krakowie, ul. Wąwozowa 34' -> 'ul_wawozowa_34'
    - '31-541 Kraków, al. Powstania Warszawskiego 10' -> 'al_powstania_warszawskiego_10'
    """
    lower = text.lower()
    if "w kazdym" in lower or "w każdym" in lower:
        return ""

    # Clean redundant city suffix and normalize formatting
    text_cleaned = re.sub(r"\bw\s+krakowie\b", "", text, flags=re.IGNORECASE)
    text_cleaned = re.sub(r"([a-zA-Z])(\d+)", r"\1 \2", text_cleaned)
    text_cleaned = re.sub(r"(\d+)\s+([a-zA-Z])\b", r"\1\2", text_cleaned)
    text_cleaned = re.sub(r"\bul\.\s*ul\.", "ul.", text_cleaned, flags=re.IGNORECASE)

    # Search for street / square / estate pattern
    pattern = r"\b(ul\.|aleja|al\.|osiedle|os\.|plac|pl\.|rynek|rondo)\s+.*?\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?"
    m = re.search(pattern, text_cleaned, re.IGNORECASE)
    if m:
        target = m.group(0).strip()
    else:
        target = text_cleaned.split(",")[0].strip()

    target = re.sub(r"\baleja\b", "al", target, flags=re.IGNORECASE)
    target = re.sub(r"\bosiedle\b", "os", target, flags=re.IGNORECASE)
    target = re.sub(r"\bplac\b", "pl", target, flags=re.IGNORECASE)

    # Remove personal initials (e.g. 'W.', 'H.')
    target = re.sub(r"\b[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]\.\s*", "", target)
    target = target.replace("ł", "l").replace("Ł", "l")
    target = unicodedata.normalize("NFKD", target).encode("ascii", "ignore").decode("ascii")
    target = target.lower()
    target = re.sub(r"[^a-z0-9]+", "_", target)
    slug = target.strip("_")

    if not re.search(r"\d", slug):
        return ""
    return slug


def clean_markdown(html_text: str | None) -> str | None:
    """Convert raw section HTML into clean Markdown without excessive whitespace."""
    if not html_text:
        return None
    text = md(html_text, heading_style="ATX", strip=["script", "style"])
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text if text else None


def strip_markup(raw: str) -> str:
    """Plain one-line text from a BIP table cell.

    Cells hold escaped HTML, so text_content() still contains literal tags: <br/> becomes a
    comma, other tags a space. Empty parts of multi-line cells ("parter, , 31-545") collapse.
    """
    text = re.sub(r"(?i)<br\s*/?>", ", ", raw)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*,(\s*,)+", ",", text)  # ", , ," -> ","
    text = re.sub(r"\s+,", ",", text)
    return text.strip(" ,")


def clean_text_field(raw_text: str | None) -> str | None:
    if not raw_text:
        return None
    cleaned = strip_markup(raw_text)
    return cleaned if cleaned else None


def clean_address(raw_addr: str) -> str:
    """Clean raw address string from HTML tags and whitespace."""
    return strip_markup(raw_addr)


def extract_section_html(elem: etree._Element) -> str:
    """Extract complete HTML of a section (Tresc + tables) unescaping entities."""
    parts = []
    c_el = elem.find("Tresc")
    if c_el is not None and c_el.text:
        parts.append(html.unescape(c_el.text))

    for tbl in elem.xpath("./table"):
        parts.append(etree.tostring(tbl, encoding="unicode"))

    full_html = "\n".join(parts).strip()
    return full_html


def parse_offices_from_element(elem: etree._Element) -> list[dict[str, Any]]:
    """Parse office locations from 'Miejsce przyjmowania dokumentów' table."""
    doc = None
    tbl = elem.find("table")
    if tbl is not None:
        tbl_html = etree.tostring(tbl, encoding="unicode")
        try:
            doc = lhtml.fromstring(tbl_html)
        except Exception:  # noqa: BLE001, S110
            pass
    else:
        c_el = elem.find("Tresc")
        if c_el is not None and c_el.text:
            text = html.unescape(c_el.text)
            if "<table" in text:
                try:
                    doc = lhtml.fromstring(text)
                except Exception:  # noqa: BLE001, S110
                    pass

    if doc is None:
        return []

    tables = doc.xpath("//table")
    if not tables:
        return []

    rows = tables[0].xpath(".//tr")
    if len(rows) < 2:
        return []

    # Analyze column headers
    headers = [
        th.text_content().strip().lower() for th in rows[0].xpath("./th | ./td")
    ]
    name_idx = -1
    addr_idx = -1
    hours_idx = -1
    phone_idx = -1
    booking_idx = -1

    for idx, h in enumerate(headers):
        if any(w in h for w in ["komórka", "komorka", "nazwa", "podmiot"]):
            name_idx = idx
        elif any(w in h for w in ["adres", "siedziba"]):
            addr_idx = idx
        elif any(w in h for w in ["godzin", "otwarci", "czas"]):
            hours_idx = idx
        elif any(w in h for w in ["telefon", "kontakt"]):
            phone_idx = idx
        elif any(w in h for w in ["wizyt", "rezerwac", "umów", "umow"]):
            booking_idx = idx

    # Defaults for standard BIP table: Nazwa | Adres | Godziny | Wizyta | Telefon
    if addr_idx == -1 and len(headers) >= 2:
        name_idx = 0
        addr_idx = 1
        if len(headers) >= 5:
            hours_idx = 2
            booking_idx = 3
            phone_idx = 4
        elif len(headers) == 4:
            phone_idx = 2
            hours_idx = 3

    if addr_idx == -1:
        return []

    offices = []
    for tr in rows[1:]:
        tds = tr.xpath("./td")
        if not tds or len(tds) <= addr_idx:
            continue

        raw_addr = tds[addr_idx].text_content().strip()
        if not raw_addr or "adres" in raw_addr.lower() or len(raw_addr) < 4:
            continue

        addr = clean_address(raw_addr)
        base_slug = slugify(addr)
        if not base_slug:
            continue
        office_id = f"urzad:{base_slug}"

        raw_name = (
            tds[name_idx].text_content().strip()
            if name_idx >= 0 and name_idx < len(tds)
            else "Urząd Miasta Krakowa"
        )
        name = clean_text_field(raw_name) or "Urząd Miasta Krakowa"

        raw_hours = (
            tds[hours_idx].text_content().strip()
            if hours_idx >= 0 and hours_idx < len(tds)
            else None
        )
        hours = clean_text_field(raw_hours)

        raw_phone = (
            tds[phone_idx].text_content().strip()
            if phone_idx >= 0 and phone_idx < len(tds)
            else None
        )
        phone = clean_text_field(raw_phone)

        booking_url = None
        if booking_idx >= 0 and booking_idx < len(tds):
            links = tds[booking_idx].xpath(".//a/@href")
            if links and links[0].strip().startswith("http"):
                booking_url = links[0].strip()
        if not booking_url:
            links = tr.xpath(".//a/@href")
            for link in links:
                l_str = link.strip()
                if (
                    "umawianiewizyt" in l_str or "umow" in l_str
                ) and l_str.startswith("http"):
                    booking_url = l_str
                    break

        offices.append(
            {
                "id": office_id,
                "name": name,
                "address": addr,
                "hours": hours,
                "bookingUrl": booking_url,
                "phone": phone,
                "coords": None,
            }
        )

    return offices


def parse_xml_file(file_path: Path) -> dict[str, Any] | None:
    try:
        tree = etree.parse(str(file_path))
    except Exception as e:  # noqa: BLE001
        print(f"Error reading {file_path.name}: {e}")
        return None

    root = tree.getroot()

    # 1. Header
    naglowek = root.find("Naglowek")
    if naglowek is None:
        return None

    symbol = (naglowek.findtext("Symbol") or file_path.stem).strip()
    title = clean_text_field(naglowek.findtext("Tytul")) or ""
    department = clean_text_field(naglowek.findtext("Wydzial"))

    # 2. Metadata
    metka = root.find("Metka")
    version = None
    published_at = None
    if metka is not None:
        ver_text = metka.findtext("Wersja")
        if ver_text and ver_text.isdigit():
            version = int(ver_text)
        published_at = metka.findtext("DataPublikacji") or None

    # 3. Sections
    sections = {v: None for v in SECTION_MAPPING.values()}
    offices = []

    for elem in root.xpath("//TrescUslugi/Element"):
        raw_title = elem.xpath("string(./Tytul)").strip().lower()
        full_html = extract_section_html(elem)

        # Office intake locations section
        if "miejsce" in raw_title and (
            "składania" in raw_title
            or "przyjmowania" in raw_title
            or "skladania" in raw_title
        ):
            parsed_offices = parse_offices_from_element(elem)
            if parsed_offices:
                offices = parsed_offices

        # Match content sections against contract fields
        for pattern, field_name in SECTION_MAPPING.items():
            if pattern in raw_title:
                sections[field_name] = clean_markdown(full_html)
                break

    # 4. Attachments
    attachments = []
    for zal in root.xpath("//ZalacznikiUslugi/Zalacznik"):
        nazwa = (
            zal.findtext("Nazwa")
            or zal.findtext("Opis")
            or zal.findtext("Tytul")
            or "Załącznik"
        )
        url = zal.findtext("Url") or zal.findtext("Plik")
        if url and url.startswith("http"):
            attachments.append(
                {"title": clean_text_field(nazwa) or "Załącznik", "url": url.strip()}
            )

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
    print(f"Found XML files to parse: {len(xml_files)}")

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
            print(f"Parsed {idx}/{len(xml_files)}...")

    offices_list = list(all_offices_map.values())

    proc_file = APP_KB_DIR / "procedures.json"
    offices_file = APP_KB_DIR / "offices_raw.json"

    proc_file.write_text(
        json.dumps(all_procedures, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    offices_file.write_text(
        json.dumps(offices_list, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("\nParsing completed successfully!")
    print(f"- Procedures saved: {len(all_procedures)} -> {proc_file}")
    print(
        f"- Unique offices for geocoding: {len(offices_list)} -> {offices_file}"
    )


if __name__ == "__main__":
    run_pipeline()
