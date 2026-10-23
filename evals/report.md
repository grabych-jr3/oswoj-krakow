# Agent eval report

Generated 2026-10-23T16:54:31.232Z · model chain from env · GEO_IMPL=real

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **59/60 (98%)** |
| Right tools | 60/60 (100%) |
| Right sources | 59/60 (98%) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
| pl | 26 | 25 |
| uk | 15 | 15 |
| en | 19 | 19 |

## Failures

### sc-family-pl
- expected scenario rodzina-z-dzieckiem, got przeprowadzka-pl
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: get_scenario({"id":"przeprowadzka-pl","locale":"pl"}), search_procedures({"query_pl":"przyjęcie do szkoły podstawowej Kraków","tags":["edukacja"]}), search_procedures({"query_pl":"rekrutacja do szkoły podstawowej Kraków","tags":["edukacja"]}), get_procedure({"symbol":"SA-14"}), get_procedure({"symbol":"KM-8"})
