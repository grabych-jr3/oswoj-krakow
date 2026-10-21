# Agent eval report

Generated 2026-10-21T14:06:58.704Z · model chain from env · GEO_IMPL=mock

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **56/58 (97%)** |
| Right tools | 56/58 (97%) |
| Right sources | 56/58 (97%) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
| pl | 26 | 25 |
| uk | 13 | 13 |
| en | 19 | 18 |

## Failures

### sc-noneu-en
- missing tools: get_scenario
- expected scenario cudzoziemiec-spoza-ue, got none
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie cudzoziemca","tags":["cudzoziemiec"]}), search_procedures({"query_pl":"PESEL cudzoziemca","tags":["cudzoziemiec"]}), get_procedure({"symbol":"SA-12"}), get_procedure({"symbol":"SA-34"})

### p-waste
- missing tools: get_procedure
- empty answer
- expected one of PD-17, fetched nothing
- answer lacks a BIP link
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: search_procedures({"query_pl":"deklaracja opłata za wywóz śmieci po przeprowadzce","tags":[]}), search_procedures({"query_pl":"deklaracja opłata za wywóz odpadów po przeprowadzce","tags":[]}), search_procedures({"query_pl":"opłata za wywóz odpadów komunalnych","tags":[]}), search_procedures({"query_pl":"zgłoszenie zmiany miejsca zamieszkania wywóz odpadów","tags":[]}), search_procedures({"query_pl":"opłata za wywóz odpadów","tags":[]})
