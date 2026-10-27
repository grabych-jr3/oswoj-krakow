"""Translate the visible parts of procedure cards to Ukrainian and English, once.

Runs after parser.py and tagger.py and writes Procedure.translations into procedures.json.
Every line is translated once and cached by its Polish text (translations/cache.<locale>.json, not committed:
without it the cache is rebuilt from procedures.json), so a monthly re-run only sends new or changed lines.

- Engines: DeepL for important cards (relevance >= DEEPL_MIN_RELEVANCE) while the monthly quota
  lasts, gpt-oss on Infercom for the rest.
- Amounts, account numbers, phones, dates, links and official Polish names are wrapped in <x> tags
  that both engines leave untouched; a line whose numbers or links changed is not cached and stays
  in Polish.

Usage: uv run python src/kb/translate.py [--locales uk,en] [--limit 5] [--only SA-34,KM-1] [--dry-run]
Keys: DEEPL_API_KEY and INFERCOM_API_KEY in pipeline/kb/.env.
"""

import argparse
import hashlib
import html
import json
import os
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path

import httpx

KB_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = KB_DIR.parents[1]
PROCEDURES_FILE = ROOT_DIR / "app" / "data" / "kb" / "procedures.json"
CACHE_DIR = KB_DIR / "translations"

SECTIONS = ["kogoDotyczy", "dokumenty", "oplaty", "sposob", "termin"]
DEEPL_MIN_RELEVANCE = 0.7
DEEPL_URL = "https://api-free.deepl.com/v2"
DEEPL_TARGET = {"uk": "UK", "en": "EN-GB"}
DEEPL_BATCH = 50
LLM_URL = "https://api.infercom.ai/v1/chat/completions"
LLM_MODEL = "gpt-oss-120b"
LLM_BATCH = 25
LLM_WORKERS = 6  # parallel LLM requests
RETRY_BATCH = 5  # lines that failed in a big batch get a second try in small ones
LANGUAGE = {"uk": "Ukrainian", "en": "English"}
# Fixed renderings, so every card names the same thing the same way.
GLOSSARY = {
    "uk": 'Use: "opłata skarbowa" = "державне мито"; "Urząd Miasta Krakowa" = "Уряд міста Кракова"; '
    '"pełnomocnictwo" = "довіреність"; "wniosek" = "заява".',
    "en": 'Use: "opłata skarbowa" = "stamp duty"; "Urząd Miasta Krakowa" = "Kraków City Office"; '
    '"pełnomocnictwo" = "power of attorney"; "wniosek" = "application".',
}

# Official names people must say at the office in Polish (AGENTS.md: the card stays usable at the counter).
POLISH_TERMS = [
    r"PESEL",
    r"zameldow\w*",
    r"wymeldow\w*",
    r"dow[óo]d\w* osobist\w*",
    r"mObywatel\w*",
    r"mDow[óo]d\w*",
    r"ePUAP",
    r"[Pp]rofil\w* [Zz]aufan\w*",
    r"kart\w* pobytu",
    r"Kart\w* Du[żz]ej Rodziny",
    r"PKK",
    r"WORD",
    r"USC",
]

PROTECT = re.compile(
    "|".join(
        [
            r"\]\([^)\s]+\)",  # markdown link target: "](https://…)"
            r"https?://[^\s)<>\]]+",  # bare links
            r"[\w.+-]+@[\w-]+\.[\w.]+",  # e-mails
            r"\d[\d\s.,:/–-]*\d|\d",  # amounts, accounts, phones, dates, hours
            *(rf"\b{t}\b" for t in POLISH_TERMS),
        ]
    )
)
TAG = re.compile(r"<x>(.*?)</x>", re.DOTALL)
TABLE_RULE = re.compile(r"^\|?[\s|:-]+\|?$")


def protect(line: str) -> str:
    """XML-escaped line with protected spans wrapped in <x>…</x>."""
    out, last = [], 0
    for m in PROTECT.finditer(line):
        out.append(html.escape(line[last : m.start()], quote=False))
        out.append(f"<x>{html.escape(m.group(0), quote=False)}</x>")
        last = m.end()
    out.append(html.escape(line[last:], quote=False))
    return "".join(out)


def unprotect(text: str) -> str:
    return html.unescape(TAG.sub(lambda m: m.group(1), text))


def facts(text: str) -> Counter:
    """Digit groups and links: what a translation must keep exactly."""
    plain = unprotect(text) if "<x>" in text else text
    digits = re.findall(r"\d+", plain)
    # "document\_library" and "document_library" are the same link; only Markdown escaping differs.
    links = [link.replace("\\", "") for link in re.findall(r"https?://[^\s)<>\]]+", plain)]
    return Counter(digits + links)


# Numbers a correct translation may add: "całą dobę" becomes "24 hours" / "24 години".
ALLOWED_NEW_FACTS = Counter({"24": 1})


def is_valid(source: str, translated: str) -> bool:
    """Every number and link of the source is kept; nothing is added but ALLOWED_NEW_FACTS."""
    if not translated.strip():
        return False
    before, after = facts(source), facts(translated)
    return not (before - after) and not (after - before - ALLOWED_NEW_FACTS)


def needs_translation(line: str) -> bool:
    stripped = line.strip()
    if not stripped or TABLE_RULE.match(stripped):
        return False
    return bool(re.search(r"[^\W\d_]{2,}", PROTECT.sub("", stripped)))


def key(line: str) -> str:
    return hashlib.sha1(line.encode("utf-8")).hexdigest()


def load_env() -> None:
    env = KB_DIR / ".env"
    if env.exists():
        for raw in env.read_text(encoding="utf-8").splitlines():
            if "=" in raw and not raw.startswith("#"):
                name, value = raw.split("=", 1)
                os.environ.setdefault(name.strip(), value.strip())


def deepl_remaining(client: httpx.Client) -> int:
    r = client.get(f"{DEEPL_URL}/usage", headers={"Authorization": f"DeepL-Auth-Key {os.environ['DEEPL_API_KEY']}"})
    r.raise_for_status()
    usage = r.json()
    return usage["character_limit"] - usage["character_count"]


def deepl_translate(client: httpx.Client, lines: list[str], locale: str) -> list[str]:
    r = client.post(
        f"{DEEPL_URL}/translate",
        headers={"Authorization": f"DeepL-Auth-Key {os.environ['DEEPL_API_KEY']}"},
        json={
            "text": [protect(line) for line in lines],
            "source_lang": "PL",
            "target_lang": DEEPL_TARGET[locale],
            "tag_handling": "xml",
            "ignore_tags": ["x"],
        },
    )
    r.raise_for_status()
    return [unprotect(t["text"]) for t in r.json()["translations"]]


def llm_translate(client: httpx.Client, lines: list[str], locale: str) -> list[str]:
    items = [protect(line) for line in lines]
    prompt = (
        f"Translate each item of the JSON array from Polish to {LANGUAGE[locale]}. These are lines of an "
        "official Kraków city service card. Keep every <x>…</x> span exactly as it is, including the tags. "
        "Keep Markdown (bold, list markers, table pipes). Do not add, drop or explain anything. "
        f"{GLOSSARY[locale]} "
        'Answer with JSON only: {"items": [...]} with exactly as many strings as the input.'
    )
    r = client.post(
        LLM_URL,
        headers={"Authorization": f"Bearer {os.environ['INFERCOM_API_KEY']}"},
        json={
            "model": LLM_MODEL,
            "temperature": 0,
            "reasoning_effort": "low",  # translation needs no long reasoning; it was ~75% of the tokens
            "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps(items, ensure_ascii=False)}],
        },
        timeout=180,
    )
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"] or ""
    match = re.search(r"\{.*\}", content, re.DOTALL)
    try:
        result = json.loads(match.group(0))["items"] if match else []
    except (ValueError, KeyError, TypeError):
        result = []  # broken JSON from the model: the batch fails validation and is retried
    if len(result) != len(items):
        return [""] * len(items)  # misaligned batch: every line fails validation and is retried next run
    return [unprotect(t) for t in result]


def save_cache(cache_file: Path, cache: dict) -> None:
    cache_file.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")


def translate_missing(client, cache: dict, cache_file: Path, lines: list[str], engine: str, locale: str, stats: Counter) -> None:
    translate = deepl_translate if engine == "deepl" else llm_translate
    size = DEEPL_BATCH if engine == "deepl" else LLM_BATCH
    failed = translate_batches(client, cache, cache_file, lines, engine, locale, size, translate)
    if failed:
        # The LLM sometimes returns a misaligned batch; small batches usually fix it.
        failed = translate_batches(client, cache, cache_file, failed, engine, locale, RETRY_BATCH, translate)
    if failed:
        # Long table rows with HTML still trip it in batches of 5; one line per request settles them.
        failed = translate_batches(client, cache, cache_file, failed, engine, locale, 1, translate)
    stats[f"{engine}:ok"] += len(lines) - len(failed)
    stats[f"{engine}:rejected"] += len(failed)


def translate_batches(client, cache, cache_file, lines, engine, locale, size, translate) -> list[str]:
    """Translates and caches valid lines, saving after every batch; returns the lines that failed validation.

    LLM batches run in parallel (Infercom allows 150 requests a minute); DeepL batches run one by one.
    """
    batches = [lines[i : i + size] for i in range(0, len(lines), size)]
    workers = LLM_WORKERS if engine == "llm" else 1
    failed, done = [], 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(translate, client, batch, locale): batch for batch in batches}
        for future in as_completed(futures):
            batch = futures[future]
            try:
                translations = future.result()
            except httpx.HTTPError as error:
                print(f"  {locale} {engine}: batch failed ({error}), retried later", flush=True)
                translations = [""] * len(batch)
            for source, translated in zip(batch, translations, strict=True):
                if is_valid(source, translated):
                    cache[key(source)] = {"pl": source, "t": translated, "e": engine}
                else:
                    failed.append(source)
            save_cache(cache_file, cache)  # a stopped run keeps everything translated so far
            done += len(batch)
            print(f"  {locale} {engine}: {done}/{len(lines)} lines", flush=True)
    return failed


def seed_cache(procedures: list[dict], locale: str) -> dict:
    """Cache rebuilt from translations already in procedures.json (line by line), so the cache need not be committed."""
    cache = {}
    for proc in procedures:
        done = proc.get("translations", {}).get(locale)
        if not done:
            continue
        pairs = [(proc["title"], done["title"])]
        pairs += [(proc["sections"].get(s) or "", done["sections"].get(s) or "") for s in SECTIONS]
        for source, translated in pairs:
            source_lines, translated_lines = source.split("\n"), translated.split("\n")
            if len(source_lines) != len(translated_lines):
                continue
            for pl, tr in zip(source_lines, translated_lines, strict=True):
                if needs_translation(pl):
                    cache[key(pl)] = {"pl": pl, "t": tr, "e": done["engine"]}
    return cache


def card_lines(proc: dict) -> list[str]:
    texts = [proc["title"], *(proc["sections"].get(s) or "" for s in SECTIONS)]
    return [line for text in texts for line in text.split("\n") if needs_translation(line)]


def translate_text(text: str | None, cache: dict) -> str | None:
    if text is None:
        return None
    return "\n".join(cache[key(line)]["t"] if key(line) in cache else line for line in text.split("\n"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--locales", default="uk,en")
    parser.add_argument("--limit", type=int, default=None, help="only the N most relevant cards")
    parser.add_argument("--only", default=None, help="comma-separated symbols")
    parser.add_argument("--dry-run", action="store_true", help="count characters to send, translate nothing")
    args = parser.parse_args()
    load_env()

    procedures = json.loads(PROCEDURES_FILE.read_text(encoding="utf-8"))
    ordered = sorted(procedures, key=lambda p: -p["relevance"])[: args.limit]
    if args.only:
        ordered = [p for p in ordered if p["symbol"] in args.only.split(",")]
    CACHE_DIR.mkdir(exist_ok=True)
    client = httpx.Client(timeout=60)
    today = datetime.now(UTC).date().isoformat()

    for locale in args.locales.split(","):
        cache_file = CACHE_DIR / f"cache.{locale}.json"
        cache = json.loads(cache_file.read_text(encoding="utf-8")) if cache_file.exists() else seed_cache(procedures, locale)

        wanted = {"deepl": [], "llm": []}
        seen = set(cache)
        for proc in ordered:
            engine = "deepl" if proc["relevance"] >= DEEPL_MIN_RELEVANCE else "llm"
            for line in card_lines(proc):
                if key(line) not in seen:
                    seen.add(key(line))
                    wanted[engine].append(line)

        deepl_chars = sum(len(line) for line in wanted["deepl"])
        llm_chars = sum(len(line) for line in wanted["llm"])
        print(f"{locale}: to translate {len(wanted['deepl'])} lines via DeepL ({deepl_chars} chars), "
              f"{len(wanted['llm'])} via LLM ({llm_chars} chars); {len(cache)} cached")
        if args.dry_run:
            continue

        # DeepL takes important lines while its monthly quota lasts; the overflow goes to the LLM.
        budget = deepl_remaining(client) - 5000
        deepl_lines, overflow = [], []
        for line in wanted["deepl"]:
            if budget - len(line) >= 0:
                budget -= len(line)
                deepl_lines.append(line)
            else:
                overflow.append(line)
        if overflow:
            print(f"  DeepL quota: {len(overflow)} lines move to the LLM")

        stats: Counter = Counter()
        translate_missing(client, cache, cache_file, deepl_lines, "deepl", locale, stats)
        translate_missing(client, cache, cache_file, overflow + wanted["llm"], "llm", locale, stats)
        print(f"  {locale}: {dict(stats)}")

        for proc in procedures:
            lines = card_lines(proc)
            if not lines or not all(key(line) in cache for line in lines):
                continue  # a partly translated card would mix languages; it stays Polish until complete
            engines = {cache[key(line)]["e"] for line in lines}
            proc.setdefault("translations", {})[locale] = {
                "title": translate_text(proc["title"], cache),
                "sections": {s: translate_text(proc["sections"].get(s), cache) for s in SECTIONS},
                "engine": "deepl" if engines == {"deepl"} else "llm",
                "translatedAt": proc.get("translations", {}).get(locale, {}).get("translatedAt", today),
            }

    if not args.dry_run:
        PROCEDURES_FILE.write_text(json.dumps(procedures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        done = {loc: sum(1 for p in procedures if loc in p.get("translations", {})) for loc in args.locales.split(",")}
        print(f"Translated cards: {done} of {len(procedures)}")


if __name__ == "__main__":
    main()
