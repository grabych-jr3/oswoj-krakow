# Agent eval report

Generated 2026-10-22T14:43:13.489Z · model chain from env · GEO_IMPL=mock

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **56/59 (95%)** |
| Right tools | 57/59 (97%) |
| Right sources | 56/59 (95%) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
| pl | 26 | 24 |
| uk | 14 | 14 |
| en | 19 | 18 |

## Failures

### sc-student-en
- missing tools: get_scenario
- empty answer
- expected scenario student, got none
- answer lacks a BIP link
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie","tags":["przeprowadzka"]}), search_procedures({"query_pl":"PESEL","tags":["dokumenty"]}), search_procedures({"query_pl":"rejestracja studenta","tags":["edukacja"]}), search_procedures({"query_pl":"dowód osobisty","tags":["dokumenty"]}), get_procedure({"symbol":"SA-14"})

### sc-family-pl
- expected scenario rodzina-z-dzieckiem, got przeprowadzka-pl
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: get_scenario({"id":"przeprowadzka-pl","locale":"pl"}), search_procedures({"query_pl":"przyjęcie do przedszkola Kraków","tags":["dziecko"]}), search_procedures({"query_pl":"przyjęcie do przedszkola","tags":["dziecko"]})

### p-waste
- missing tools: get_procedure
- expected one of PD-17, fetched nothing
- answer lacks a BIP link
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: search_procedures({"query_pl":"deklaracja opłata za śmieci po przeprowadzce","tags":[]}), search_procedures({"query_pl":"deklaracja opłata za wywóz odpadów po przeprowadzce","tags":[]}), search_procedures({"query_pl":"deklaracja wywóz odpadów komunalnych","tags":[]}), search_procedures({"query_pl":"deklaracja opłata za wywóz śmieci","tags":[]}), search_procedures({"query_pl":"zmiana miejsca zamieszkania opłata za wywóz odpadów","tags":[]})
