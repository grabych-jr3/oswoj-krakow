# Asystent AI: jak działa

Asystent odpowiada na pytania nowych mieszkańców Krakowa po polsku, ukraińsku i angielsku. Każdą odpowiedź opiera na oficjalnych danych miasta: kartach usług BIP i danych przestrzennych. Fakty pochodzą z narzędzi, a nie z pamięci modelu językowego. To jest główna zasada projektu i większość rozwiązań opisanych niżej służy właśnie jej.

## 1. Przepływ jednego pytania

```
Użytkownik ─► POST /api/chat ─► model językowy (LLM)
                                   │  wybiera narzędzia (do 6 kroków)
                                   ▼
               ┌──────────── narzędzia ────────────┐
               │ search_procedures  get_procedure  │ ◄── baza wiedzy BIP (app/data/kb)
               │ get_scenario                      │
               │ find_places  nearby_15min geocode │ ◄── dane przestrzenne (moduł geo)
               └───────────────────────────────────┘
                                   │
                                   ▼
          strumień odpowiedzi: tekst + wyniki narzędzi ─► czat (karty) i mapa (znaczniki)
```

Wyniki narzędzi trafiają do przeglądarki w niezmienionej postaci. Interfejs pokazuje je jako kartę procedury, listę kroków lub znaczniki na mapie. Dzięki temu adres, godziny otwarcia i lista dokumentów, które widzi użytkownik, pochodzą wprost z danych, a nie z tekstu wygenerowanego przez model.

Kod: `app/src/app/api/chat/route.ts`, `app/src/server/agent/`.

## 2. Baza wiedzy (RAG)

| Zbiór | Rozmiar | Źródło |
|---|---|---|
| Karty usług (`procedures.json`) | 639 procedur | API listy usług GMK + karty XML z `bip.krakow.pl/uslugi/xml/{SYMBOL}` |
| Scenariusze „Pierwsze kroki” (`scenarios.{pl,uk,en}.json`) | 8 scenariuszy × 3 języki | opracowane na podstawie kart BIP; każdy krok wskazuje symbole procedur i źródła |

Każda procedura ma tagi sytuacji życiowej (np. `przeprowadzka`, `pojazd`, `obywatel_ua`) i wagę `relevance` (0–1). Waga określa, jak ważna jest procedura dla nowego mieszkańca.

**Wyszukiwanie** to pełnotekstowy indeks MiniSearch w pamięci serwera. Nie wymaga zewnętrznej bazy ani embeddingów.
- Tekst indeksu i zapytania jest normalizowany: małe litery, bez polskich znaków, `ł → l`. Dzięki temu „pobyt staly” znajduje „pobyt stały”.
- Pola mają różne wagi: symbol ×5, tytuł ×3, „kogo dotyczy” ×1,5. Wyszukiwanie toleruje odmianę i literówki (prefix, fuzzy 0,2).
- Wynik jest mnożony przez `0,3 + relevance`. Procedury ważne dla nowych mieszkańców są wyżej niż np. sprawy budowlane, ale niszowa procedura nadal się znajdzie, gdy ktoś jej szuka dokładnie.
- Model zawsze tłumaczy pytanie na urzędową polszczyznę (`query_pl`), np. „прописка” → „zameldowanie”. Jeden polski indeks obsługuje więc trzy języki.

## 3. Narzędzia

| Narzędzie | Do czego służy | Dane |
|---|---|---|
| `search_procedures` | wyszukanie procedur po polskim zapytaniu, opcjonalnie z filtrem tagów | baza BIP |
| `get_procedure` | pełna karta jednej procedury: dokumenty, opłaty, terminy, wydziały z godzinami i linkiem do rezerwacji wizyty | baza BIP + współrzędne wydziałów z warstwy `urzad` |
| `get_scenario` | lista kroków dla sytuacji życiowej (np. obywatel Ukrainy, student, rodzina z dzieckiem) | scenariusze |
| `find_places` | miejsca na mapie (przedszkola, szkoły, parki, przystanki, urzędy…) wokół adresu lub w dzielnicy | dane przestrzenne |
| `nearby_15min` | co jest osiągalne w 15 minut pieszo lub komunikacją | dane przestrzenne |
| `geocode` | adres → współrzędne i dzielnica | dane przestrzenne |

Typy wyników są wspólnym kontraktem dla serwera i interfejsu (`app/src/contracts/chat.ts`). Zmiana formatu po jednej stronie zostaje wykryta podczas kompilacji.

## 4. Zasady odpowiedzi (prompt systemowy)

Prompt (`app/src/server/agent/prompt.ts`) realizuje zasady z planu projektu:
- Fakty (dokumenty, opłaty, terminy, adresy, godziny) można podawać **tylko z wyników narzędzi** w bieżącej rozmowie.
- Pytanie o konkretną sprawę zawsze przechodzi przez `search_procedures` → `get_procedure`, także wtedy, gdy model „zna” odpowiedź.
- Każda odpowiedź o procedurze zawiera link do jej karty BIP. Tytuł jest cytowany dokładnie tak, jak zwróciło go narzędzie.
- Sprawy spoza kompetencji miasta (karta pobytu, NFZ, ZUS, podatki) dostają krótką informację, kto się nimi zajmuje, i link z białej listy oficjalnych stron. Bez szczegółów.
- Brak danych oznacza uczciwą odpowiedź „nie mam tej informacji” i odesłanie do BIP.
- Odpowiedź jest w języku użytkownika. Polskie nazwy urzędowe zostają w oryginale z tłumaczeniem w nawiasie, żeby użytkownik mógł się nimi posłużyć w urzędzie.
- Serwis ma charakter informacyjny i nie udziela porad prawnych. Model nie prosi o dane osobowe i ich nie powtarza.

## 5. Ochrona przed halucynacjami

Sam prompt nie wystarcza, dlatego ograniczenia są wbudowane w kod:

1. **Fakty widoczne w interfejsie pochodzą z danych.** Karta procedury i znaczniki są renderowane z wyników narzędzi, a nie z tekstu modelu.
2. **Zamknięte listy wartości.** Identyfikator scenariusza i kategorie miejsc są typu `enum`. Model nie może wywołać nieistniejącego scenariusza, bo takie wywołanie zostaje odrzucone przed wykonaniem.
3. **Błąd jako informacja.** Nieznany symbol, nieodnaleziony adres lub brak punktu startowego zwracają komunikat z instrukcją („użyj search_procedures”, „zapytaj o dokładny adres”) zamiast pustego wyniku. Model poprawia się, zamiast dopowiadać odpowiedź.
4. **Prawdziwe tytuły w scenariuszach.** Scenariusz zawiera tylko symbole procedur. Dlatego model dostaje dodatkowo ich oficjalne tytuły i linki BIP. Bez tego model wymyślał lub tłumaczył tytuły, co wykryły testy.
5. **Normalizacja symboli.** Zapisy „sa 34”, „SA34”, „sa_34” prowadzą do tej samej karty `SA-34`. Model nie odpowie więc „nie ma takiej procedury” z powodu formatu zapisu.
6. **Walidacja danych przy starcie.** Baza wiedzy jest sprawdzana schematem (`zod`), a błędne dane zatrzymują serwer, zamiast trafić do modelu. Na tym samym schemacie opiera się `npm run validate:data` w CI.
7. **Ewaluacja wykrywa zmyślone źródła.** Link do karty BIP, której żadne narzędzie nie zwróciło w danej rozmowie, jest liczony jako błąd (sekcja 7).

## 6. Modele i dostępność

Dostawca i model są ustawiane zmiennymi środowiskowymi (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_PROVIDER`), bez zmian w kodzie. Domyślny łańcuch:

1. Google Gemini 2.5 Flash (podstawowy),
2. dostawcy zapasowi z `LLM_FALLBACK_PROVIDER`, np. Mistral, Groq (`openai/gpt-oss-120b`),
3. Gemini 2.5 Flash-Lite (osobny limit tego samego dostawcy).

Przy błędzie 429 (limit) lub 5xx zapytanie automatycznie przechodzi do kolejnego modelu. Przy błędzie 400 (błąd zapytania) nie przechodzi, żeby nie maskować błędów w kodzie. Dostawca bez klucza API jest pomijany.

Dodatkowe zabezpieczenia:
- **Limit zapytań na IP** (`RATE_LIMIT_PER_MIN`, domyślnie 10 na minutę). Jeden użytkownik nie wyczerpie limitu dla wszystkich.
- **Pamięć odpowiedzi na pytania startowe.** Odpowiedzi na podpowiedzi z czatu są zapamiętywane na 6 godzin i odtwarzane bez wywołania modelu. Odpowiedź zakończona błędem nie jest zapamiętywana.
- **Kompaktowy widok wyników dla modelu.** Model dostaje skrót wyników: 5 trafień zamiast 8, karta tylko z polami potrzebnymi do odpowiedzi. Interfejs dostaje pełne dane. Jedna odpowiedź to kilka kroków, a każdy krok wysyła cały kontekst, więc skrót mieści odpowiedź w małych limitach tokenów na minutę i przyspiesza ją.
- **Tryb bez modelu** (`LLM_MOCK=1`). Skryptowane odpowiedzi z danych testowych służą do pracy nad interfejsem bez kluczy API.

## 7. Ewaluacja

Zestaw `evals/cases.json` zawiera 46 pytań po polsku, ukraińsku i angielsku:
- scenariusz demonstracyjny,
- 8 sytuacji życiowych,
- 24 konkretne procedury,
- wyszukiwanie miejsc i „15 minut”,
- pytania spoza kompetencji miasta.

Dla każdego pytania zapisane są oczekiwane narzędzia i źródła (symbol procedury, scenariusz, kategoria miejsc, tryb dojazdu, oficjalny link).

Skrypt `evals/run.ts` zadaje pytania prawdziwemu modelowi w tej samej konfiguracji co serwer. Następnie sprawdza:
- czy wywołano właściwe narzędzia,
- czy odpowiedź opiera się na właściwym źródle,
- czy odpowiedź nie jest pusta,
- czy nie zawiera linków BIP spoza wyników narzędzi.

Wynik trafia do `evals/report.md`. Kryterium jakości: ≥85% pytań z właściwymi narzędziami i źródłami.

Niezależnie od modelu testy jednostkowe sprawdzają wyszukiwarkę: dla 25 polskich zapytań z ewaluacji właściwa karta musi być w pierwszych 5 wynikach. Testy działają bez kluczy API i są uruchamiane w CI.

## 8. Ograniczenia

- **Aktualność:** baza wiedzy to stan kart BIP z dnia pobrania. Każda odpowiedź linkuje do karty źródłowej, gdzie obowiązuje aktualna wersja.
- **Zakres:** asystent zna procedury Urzędu Miasta Krakowa. Sprawy wojewody, NFZ, ZUS czy urzędu skarbowego tylko wskazuje z linkiem i nie opisuje.
- **Wyszukiwanie leksykalne:** indeks nie rozumie synonimów. Lukę tę pokrywa tłumaczenie pytania przez model na urzędowe terminy. Wyszukiwanie semantyczne jest planowane jako rozszerzenie.
- **Limity darmowych planów:** darmowe plany dostawców LLM mają dzienne limity (np. kilkadziesiąt zapytań dziennie dla Gemini). Wystarczają na prezentację i testy, a do szerszego użycia potrzebny jest płatny plan. Konfiguracja dostawcy nie wymaga zmian w kodzie.
- **Model może się mylić:** zabezpieczenia z sekcji 5 ograniczają błędy, ale ich nie wykluczają. Dlatego interfejs pokazuje źródło przy każdej odpowiedzi, a serwis ma charakter informacyjny.
- **Prywatność:** rozmowy nie są zapisywane po stronie serwera, poza krótkotrwałą pamięcią odpowiedzi na pytania startowe, które nie zawierają danych użytkownika.
