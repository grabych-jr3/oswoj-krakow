# Agent eval report

Generated 2026-10-20T17:44:30.261Z · model chain from env · GEO_IMPL=mock

| Metric | Score |
|---|---|
| **Passed (tools and sources)** | **15/38 (39%)** |
| Right tools | 16/38 (42%) |
| Right sources | 15/38 (39%) |

Target (PLAN.md B6): ≥85% passed.

| Locale | Cases | Passed |
|---|---|---|
| pl | 16 | 6 |
| uk | 10 | 4 |
| en | 12 | 5 |

## Failures

### demo1-ua-kharkiv
- missing tools: get_scenario
- expected scenario obywatel-ua, got none
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie","tags":["przeprowadzka"]})

### demo2-pesel
- missing tools: get_procedure
- expected one of SA-34/SA-65, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"PESEL","tags":["dokumenty"]})

### sc-family-pl
- expected scenario rodzina-z-dzieckiem, got przeprowadzka-pl
- model: openai/gpt-oss-120b
- calls: get_scenario({"id":"przeprowadzka-pl"})

### sc-car-uk
- missing tools: get_scenario
- expected scenario samochod, got none
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"rejestracja pojazdu","tags":["pojazd"]})

### sc-noneu-en
- missing tools: get_scenario
- expected scenario cudzoziemiec-spoza-ue, got none
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie","tags":["przeprowadzka"]})

### p-zameldowanie-pl
- missing tools: get_procedure
- expected one of SA-14/SA-12/SA-32, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie na pobyt stały","tags":["przeprowadzka"]})

### p-zameldowanie-uk
- missing tools: get_procedure
- expected one of SA-12, fetched nothing
- model: openai/gpt-oss-120b → openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie","tags":["mieszkanie"]}), search_procedures({"query_pl":"meldunek","tags":["mieszkanie"]})

### p-zameldowanie-en
- missing tools: get_procedure
- expected one of SA-14/SA-32, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zameldowanie w Krakowie","tags":["przeprowadzka"]})

### p-wymeldowanie
- missing tools: get_procedure
- expected one of SA-15/SA-13, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"wymeldowanie","tags":["przeprowadzka"]})

### p-pesel-en
- missing tools: get_procedure
- expected one of SA-34, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"wydanie numeru PESEL cudzoziemca","tags":["cudzoziemiec"]})

### p-dowod
- missing tools: get_procedure
- expected one of SA-10, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"dowód osobisty","tags":["dokumenty"]})

### p-dowod-lost
- missing tools: get_procedure
- expected one of SA-11, fetched nothing
- model: openai/gpt-oss-120b
- calls: none

### p-car-new
- missing tools: get_procedure
- expected one of KM-1, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"rejestracja nowego samochodu","tags":["pojazd"]})

### p-car-address
- missing tools: get_procedure
- expected one of KM-8, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zmiana adresu w dowodzie rejestracyjnym samochodu","tags":["pojazd"]})

### p-license-exchange
- missing tools: get_procedure
- expected one of KM-19, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"wymiana ukraińskiego prawa jazdy na polskie","tags":["pojazd"]})

### p-pkk
- missing tools: get_procedure
- expected one of KM-21, fetched nothing
- model: openai/gpt-oss-120b
- calls: none

### p-parking
- missing tools: get_procedure
- expected one of ZDMK-72/ZDMK-71, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"abonament parkingowy dla mieszkańca strefy","tags":["pojazd"]})

### p-waste
- missing tools: get_procedure
- expected one of PD-17, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"deklaracja opłata za śmieci po przeprowadzce","tags":["przeprowadzka"]})

### p-property-tax
- missing tools: get_procedure
- expected one of PD-4, fetched nothing
- model: openai/gpt-oss-120b → openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"deklaracja podatku od nieruchomości","tags":["mieszkanie"]})

### p-birth
- missing tools: get_procedure
- expected one of SC-1/SC-29, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"zgłoszenie narodzin","tags":["dziecko"]})

### p-unemployed
- missing tools: get_procedure
- expected one of GUP-2/GUP-1, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"rejestracja bezrobotnego","tags":[]})

### p-hire-foreigner
- missing tools: get_procedure
- expected one of GUP-5, fetched nothing
- model: openai/gpt-oss-120b
- calls: search_procedures({"query_pl":"oświadczenie o powierzeniu pracy cudzoziemcowi","tags":["praca"]})

### pl-nurseries-district
- missing tools: find_places
- expected categories zlobek, got 
- model: openai/gpt-oss-120b → openai/gpt-oss-120b
- calls: geocode({"query":"Podgórze Kraków"}), search_procedures({"query_pl":"Podgórze numer dzielnicy Kraków","tags":["mieszkanie"]})
