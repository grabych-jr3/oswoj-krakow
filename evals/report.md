# Agent eval report

Generated 2026-10-20T18:29:14.882Z · model chain from env · GEO_IMPL=mock

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **20/24 (83%)** |
| Right tools | 21/24 (88%) |
| Right sources | 20/24 (83%) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
| pl | 10 | 9 |
| uk | 5 | 4 |
| en | 9 | 7 |

## Failures

### sc-family-pl
- expected scenario rodzina-z-dzieckiem, got przeprowadzka-pl
- model: openai/gpt-oss-120b
- calls: get_scenario({"id":"przeprowadzka-pl"})

### sc-noneu-en
- missing tools: get_scenario
- expected scenario cudzoziemiec-spoza-ue, got none
- model: openai/gpt-oss-120b → openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie cudzoziemca","tags":["cudzoziemiec"]}), get_procedure({"symbol":"SA-12"})

### p-zameldowanie-uk
- missing tools: get_procedure
- expected one of SA-12, fetched nothing
- model: openai/gpt-oss-120b → openai/gpt-oss-120b
- calls: get_scenario({"id":"obywatel-ua","locale":"uk"}), search_procedures({"query_pl":"zameldowanie","tags":["cudzoziemiec"]})

### p-car-new
- missing tools: get_procedure
- expected one of KM-1, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"rejestracja nowego samochodu","tags":["pojazd"]})
