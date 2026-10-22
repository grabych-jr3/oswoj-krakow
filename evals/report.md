# Agent eval report

Generated 2026-10-22T16:12:36.523Z · model chain from env · GEO_IMPL=real

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **58/60 (97%)** |
| Right tools | 59/60 (98%) |
| Right sources | 58/60 (97%) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
| pl | 26 | 25 |
| uk | 15 | 15 |
| en | 19 | 18 |

## Failures

### sc-family-pl
- expected scenario rodzina-z-dzieckiem, got przeprowadzka-pl
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: get_scenario({"id":"przeprowadzka-pl","locale":"pl"}), search_procedures({"query_pl":"przyjęcie do szkoły podstawowej Kraków","tags":["dziecko"]}), search_procedures({"query_pl":"przyjęcie do przedszkola Kraków","tags":["dziecko"]}), search_procedures({"query_pl":"wydanie numeru PESEL dziecko Kraków","tags":["dziecko"]}), get_procedure({"symbol":"SA-34"}), get_procedure({"symbol":"SA-14"}), get_procedure({"symbol":"KM-8"})

### sc-eu-en
- missing tools: get_scenario
- expected scenario cudzoziemiec-ue, got none
- model: gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b → gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie cudzoziemca UE","tags":["cudzoziemiec"]}), search_procedures({"query_pl":"PESEL cudzoziemca UE","tags":["cudzoziemiec"]}), get_procedure({"symbol":"SA-12"}), get_procedure({"symbol":"SA-34"})
