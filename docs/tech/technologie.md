# Technologie

Oswój Kraków to aplikacja webowa z asystentem AI i mapą. Wybieraliśmy technologie według czterech zasad:

1. **Bez kosztów stałych.** Hosting, mapa i modele językowe działają w darmowych planach. Nie ma serwera bazy danych do utrzymania.
2. **Dane miasta są przetwarzane raz, a nie przy każdym zapytaniu.** Ciężkie obliczenia (geokodowanie, czasy dojścia) wykonują skrypty, a aplikacja czyta gotowe pliki.
3. **Jeden kontrakt danych.** Format danych jest opisany raz (schematy `zod`) i sprawdzany w potokach danych, na serwerze, w interfejsie i w testach.
4. **Otwarte standardy.** GeoJSON, H3, GTFS, OpenStreetMap – łatwo przenieść rozwiązanie do innego miasta.

## Aplikacja (frontend i serwer)

| Technologia | Wersja | Do czego |
|---|---|---|
| **Next.js** (App Router) + **React** | 16.4 / 19.3 | aplikacja i serwer w jednym projekcie: strony, API czatu i „15 minut” |
| **TypeScript** (tryb `strict`) | 5 | cały kod aplikacji |
| **Tailwind CSS** + komponenty w stylu shadcn/ui | 4 | wygląd, tryb mobilny, kolory miasta |
| **next-intl** | 4.14 | trzy języki interfejsu: polski (domyślny), ukraiński, angielski |
| **MapLibre GL JS** + react-map-gl | 6.15 / 8.1 | mapa wektorowa: warstwy, klastry, strefy, popupy |
| **OpenFreeMap** (styl Positron) | – | darmowy podkład mapy z danych OpenStreetMap, bez klucza API |
| **h3-js**, **Turf** | 4.5 / 7.4 | siatka heksagonów „Indeksu 15 minut” i geometria stref w przeglądarce |
| **zod** | 4.6 | schematy danych (kontrakty) i ich walidacja |
| **lucide-react** | 1.59 | ikony kategorii miejsc i interfejsu |

## Asystent AI

| Technologia | Do czego |
|---|---|
| **Vercel AI SDK** (`ai`, `@ai-sdk/react`) | strumieniowanie odpowiedzi, wywoływanie narzędzi (tool calling), czat w przeglądarce |
| **Modele językowe** przez dostawców z darmowym planem: Infercom i Groq (`gpt-oss-120b`), Google Gemini (Flash, Flash-Lite) | odpowiedzi asystenta; łańcuch modeli zapasowych przy limicie lub awarii |
| **MiniSearch** | pełnotekstowe wyszukiwanie w 639 kartach usług BIP, w pamięci serwera (RAG bez bazy wektorowej) |

Dostawcę i model zmienia się zmienną środowiskową, bez zmian w kodzie. Szczegóły: [ai.md](ai.md).

## Potoki danych

| Technologia | Do czego |
|---|---|
| **Python 3.12** + **uv** | dwa niezależne projekty: `pipeline/geo` (dane przestrzenne) i `pipeline/kb` (baza wiedzy BIP) |
| **httpx**, **lxml**, **markdownify**, **pydantic** | pobieranie API Otwartych Danych i kart XML z BIP, zamiana kart na tekst, walidacja |
| **pyproj**, **shapely**, **rapidfuzz** | przeliczenie współrzędnych MSIP (EPSG:2178 → WGS84), geometria, dopasowanie nazw ulic |
| **r5py** (silnik R5), **osmnx**, **h3** | czasy dojścia pieszo i komunikacją miejską (GTFS ZTP + sieć OSM) na siatce H3 |

Wynikiem potoków są statyczne pliki JSON i GeoJSON w repozytorium (`app/data`, `app/public/data`). Aplikacja nie łączy się z zewnętrznymi bazami ani API danych w czasie działania. Szczegóły: [dane.md](dane.md).

## Hosting, jakość i automatyzacja

| Technologia | Do czego |
|---|---|
| **Vercel** | hosting aplikacji i podgląd każdej zmiany (preview) |
| **GitHub** + **GitHub Actions** | publiczne repozytorium; przy każdej zmianie: lint, typy, testy, walidacja danych, testy potoków |
| **Vitest** | ponad 160 testów jednostkowych aplikacji (kontrakty, wyszukiwarka, mapa, czat) |
| **pytest**, **ruff** | testy i jakość kodu potoków danych |
| **ESLint** | jakość kodu aplikacji |
| **Lighthouse**, **Puppeteer** | dostępność, wydajność i scenariusze w przeglądarce (komputer i telefon) |

Ewaluacja asystenta (60 pytań w trzech językach, sprawdzanie narzędzi i źródeł; wynik 97%, raport: [evals/report.md](../../evals/report.md)) jest opisana w [ai.md, pkt 7](ai.md#7-ewaluacja).

## Dostępność i wydajność

- **Dostępność:** wynik Lighthouse 100 na wszystkich stronach. Obsługa klawiaturą (link „przejdź do rozmowy”, Esc zamyka okna, przełączniki warstw jako pola wyboru), czytniki ekranu (role ARIA, komunikaty `aria-live`), kontrast, tryb „ogranicz ruch”.
- **Telefon:** mapa na cały ekran, czat i panel „15 minut” jako wysuwane arkusze z gestami.
- **Szybkie pierwsze wyświetlenie:** strona mapy przychodzi z serwera jako gotowy szkielet (pasek, wyszukiwarka, czat), a najcięższa biblioteka – MapLibre – ładuje się dopiero, gdy jest potrzebna. Warstwy i biblioteki geometrii ładują się dopiero po włączeniu.

## Dlaczego tak

- **Bez bazy danych.** Dane miasta zmieniają się rzadko (raz na tygodnie lub miesiące). Statyczne pliki są szybsze, tańsze i prostsze w utrzymaniu niż baza, a aktualizacja to ponowne uruchomienie potoku.
- **„15 minut” liczone z góry.** Dla każdego heksagonu miasta (ok. 3 200) czasy dojścia są policzone wcześniej. Odpowiedź w aplikacji to odczyt z pliku w czasie poniżej milisekundy, bez zewnętrznych serwisów tras i ich limitów.
- **Wyszukiwanie bez bazy wektorowej.** 639 kart mieści się w pamięci serwera. Model tłumaczy pytanie na urzędową polszczyznę, a MiniSearch znajduje kartę – bez kosztów embeddingów.
- **Wymienialny model.** Darmowe plany mają limity, dlatego aplikacja ma łańcuch zapasowych dostawców. Miasto może podłączyć własny model lub płatny plan bez zmian w kodzie.
