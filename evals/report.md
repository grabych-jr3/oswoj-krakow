# Agent eval report

Generated 2026-10-21T13:16:27.337Z · model chain from env · GEO_IMPL=mock

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **44/46 (96%)** |
| Right tools | 44/46 (96%) |
| Right sources | 44/46 (96%) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
| pl | 20 | 18 |
| uk | 10 | 10 |
| en | 16 | 16 |

## Failures

### p-pkk
- missing tools: get_procedure
- expected one of KM-21, fetched nothing
- answer lacks a BIP link
- model: gpt-oss-120b
- calls: none

### p-waste
- missing tools: get_procedure
- empty answer
- expected one of PD-17, fetched nothing
- answer lacks a BIP link
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: search_procedures({"query_pl":"deklaracja opłata za śmieci po przeprowadzce","tags":[]}), search_procedures({"query_pl":"deklaracja wywóz odpadów po przeprowadzce","tags":[]}), search_procedures({"query_pl":"opłata za wywóz śmieci","tags":[]}), search_procedures({"query_pl":"zmiana miejsca zamieszkania wywóz odpadów","tags":[]}), search_procedures({"query_pl":"deklaracja opłata za wywóz odpadów komunalnych","tags":[]})
