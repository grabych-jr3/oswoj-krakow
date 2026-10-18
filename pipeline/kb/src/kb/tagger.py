import json
import re
from pathlib import Path

PROCEDURES_FILE = Path("output/procedures.json")

# Ключевые слова для тегов (поиск по названию, описанию и коду департамента)
TAG_RULES = {
    "obywatel_ua": [
        r"ukrain", r"ukra", r"wojn", r"uchodzc", r"ochron[aę]\s+czasow", r"specustaw"
    ],
    "cudzoziemiec": [
        r"cudzoziem", r"obcokraj", r"karta\s+pobytu", r"pobyt\s+czasow", r"pobyt\s+stał",
        r"obywatel\s+ue", r"pobyt\s+obywatela"
    ],
    "przeprowadzka": [
        r"meldun", r"zameldow", r"wymeldow", r"miejsce\s+zamieszkania", r"pobyt\s+stały", r"pobyt\s+czasowy"
    ],
    "dziecko": [
        r"dziec", r"żłob", r"przedszkol", r"urodzen", r"opiek", r"noworodek", r"akt\s+urodzenia"
    ],
    "edukacja": [
        r"szkoł", r"edukac", r"naucz", r"uczn", r"stypend", r"rekrutacj"
    ],
    "pojazd": [
        r"pojazd", r"rejestracj[aę]\s+pojazdu", r"prawo\s+jazdy", r"samochód", r"tablic", r"dowód\s+rejestracyj"
    ],
    "mieszkanie": [
        r"lokal\s+mieszkal", r"mieszkan", r"najm", r"lokal\s+socjal", r"dodatek\s+mieszkaniow"
    ],
    "praca": [
        r"prac[aęy]", r"zatrudn", r"zezwolenie\s+na\s+prac", r"oświadczeni.*o\s+powierzeniu", r"bezrobot"
    ],
    "pomoc_spoleczna": [
        r"pomoc\s+społeczn", r"mops", r"zasił", r"świadczeni", r"wsparc", r"niepełnosprawn"
    ],
    "dokumenty": [
        r"pesel", r"dowód\s+osobist", r"zaświadczen", r"akt\s+stanu\s+cywil", r"odpis\s+aktu"
    ],
}

# Явные приоритеты для ключевых процедур (топ-процедуры для новых жителей)
EXPLICIT_RELEVANCE = {
    "SA-34": 1.0,  # PESEL
    "SA-65": 1.0,  # PESEL UKR
    "SA-14": 1.0,  # Zameldowanie obywatela RP
    "SA-12": 1.0,  # Zameldowanie cudzoziemca
    "KM-8": 1.0,   # Rejestracja pojazdu
    "KM-14": 0.9,  # Prawo jazdy
    "SO-20": 0.9,  # Zapisy do szkół / przedszkoli
    "MOPS-21": 0.9,# Pomoc społeczna
    "GUP-1": 0.85, # Rejestracja bezrobotnego
    "GUP-2": 0.85, # Zezwolenia na pracę
}


def tag_procedure(proc: dict) -> tuple[list[str], float]:
    symbol = proc.get("symbol", "")
    title = (proc.get("title") or "").lower()
    
    sections = proc.get("sections") or {}
    opis = (sections.get("opis") or "").lower()
    kogo = (sections.get("kogoDotyczy") or "").lower()
    full_text = f"{title} {opis} {kogo}"

    # 1. Проставляем теги
    tags = set()
    for tag, patterns in TAG_RULES.items():
        for pat in patterns:
            if re.search(pat, full_text):
                tags.add(tag)
                break

    # 2. Вычисляем relevance
    if symbol in EXPLICIT_RELEVANCE:
        relevance = EXPLICIT_RELEVANCE[symbol]
    else:
        # Базовая эвристика релевантности для новых жителей:
        # Если есть пересечения с ключевыми темами переезда и документов
        key_tags = {"przeprowadzka", "cudzoziemiec", "obywatel_ua", "dokumenty"}
        family_tags = {"dziecko", "edukacja", "pojazd", "mieszkanie", "praca"}
        
        if tags & key_tags:
            relevance = 0.8
        elif tags & family_tags:
            relevance = 0.6
        elif "pomoc_spoleczna" in tags:
            relevance = 0.5
        elif any(w in full_text for w in ["konserwator", "zabytek", "mural", "rozbiórk", "budowlan", "renta planistyczna"]):
            # Специфические строительные и музейные процедуры
            relevance = 0.05
        else:
            relevance = 0.2

    # Если ни один тег не подошел — помечаем как "inne"
    if not tags:
        tags.add("inne")

    return sorted(list(tags)), round(relevance, 2)


def main():
    if not PROCEDURES_FILE.exists():
        print(f"Файл {PROCEDURES_FILE} не найден! Сначала запусти parser.py")
        return

    procedures = json.loads(PROCEDURES_FILE.read_text(encoding="utf-8"))
    print(f"Тегируем {len(procedures)} процедур...")

    tagged_count = 0
    high_rel_count = 0

    for proc in procedures:
        tags, relevance = tag_procedure(proc)
        proc["tags"] = tags
        proc["relevance"] = relevance
        if tags != ["inne"]:
            tagged_count += 1
        if relevance >= 0.7:
            high_rel_count += 1

    PROCEDURES_FILE.write_text(json.dumps(procedures, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Готово! Размечено процедур:")
    print(f"- С конкретными тегами (не 'inne'): {tagged_count}/{len(procedures)}")
    print(f"- С высоким приоритетом (relevance >= 0.7): {high_rel_count}")


if __name__ == "__main__":
    main()