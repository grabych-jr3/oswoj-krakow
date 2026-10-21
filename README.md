# Oswój Kraków

**Nowy w Krakowie? Zapytaj własnymi słowami.**
Asystent AI i mapa dla nowych mieszkańców Krakowa – odpowiedzi tylko z oficjalnych danych miasta, zawsze z linkiem do źródła.

🔗 **Demo:** [oswoj-krakow.vercel.app](https://oswoj-krakow.vercel.app) · języki: polski (domyślnie), ukraiński, angielski
🏆 Projekt na konkurs **Open Data App 2026** (Gmina Miejska Kraków) · 🚧 **w budowie**

---

## Dla kogo i po co

Do Krakowa co roku przeprowadzają się tysiące osób – z innych miast Polski i z zagranicy. Na start muszą załatwić sprawy w urzędzie (zameldowanie, PESEL, rejestracja auta), znaleźć żłobek, przedszkole lub szkołę i zrozumieć komunikację miejską.

„Oswój Kraków” zbiera te informacje w jednym miejscu. Pytasz tak, jak mówisz na co dzień. Dostajesz konkretną odpowiedź z oficjalnej karty usługi i widzisz na mapie, gdzie załatwisz sprawę.

## Problem

- Na koniec 2025 r. w Krakowie było zameldowanych **ponad 15 tys. cudzoziemców** na pobyt czasowy i **ok. 5,8 tys.** na pobyt stały – to obywatele **ponad 130 państw** (Otwarte Dane Miasta Krakowa, stan na 31.12.2025).
- W BIP Kraków jest **639 kart usług**. Trudno wiedzieć, której szukać i jak się nazywa sprawa po polsku.
- Informacje są rozproszone: karty usług w BIP, zbiory na portalu Otwarte Dane, mapy MSIP i ZTP. Każde źródło trzeba znać i umieć przeczytać osobno.

Efekt: wizyty w urzędzie bez kompletu dokumentów, stracony czas po obu stronach okienka i trudniejszy start w nowym mieście.

## Rozwiązanie

Aplikacja webowa, która łączy asystenta AI z interaktywną mapą. Ma trzy moduły:

### 💬 Asystent
Pytasz po polsku, ukraińsku lub angielsku. Asystent odpowiada **wyłącznie na podstawie oficjalnych kart usług BIP**: wymagane dokumenty, opłaty, termin załatwienia i link do umówienia wizyty online. Każda odpowiedź ma odnośnik do karty źródłowej. Punkty obsługi od razu pojawiają się na mapie.

### 🗺️ Kraków w 15 minut
Wpisujesz adres – np. wynajmowanego mieszkania – i widzisz, co masz w zasięgu 15 minut pieszo lub komunikacją miejską: żłobki, przedszkola, szkoły, parki, biblioteki, przystanki. Aplikacja wylicza też **indeks dostępności** usług dla tego miejsca.

### ✅ Pierwsze kroki
Lista spraw do załatwienia we właściwej kolejności, dobrana do Twojej sytuacji, z linkami do kart usług. Przygotowujemy scenariusze m.in. dla osób, które:

- przeprowadzają się z innego miasta w Polsce,
- są obywatelami UE,
- są cudzoziemcami spoza UE,
- są obywatelami Ukrainy,
- przyjeżdżają z dziećmi,
- szukają pracy,
- mają samochód,
- przyjeżdżają na studia.

## Przykład

> Andrij przyjechał z Charkowa z pięcioletnią córką. Pisze po ukraińsku: *„Де отримати PESEL і що взяти з собою?”*
>
> Asystent odpowiada po ukraińsku, ale podaje polskie nazwy urzędowe w oryginale – żeby Andrij mógł się nimi posłużyć w urzędzie. Wymienia dokumenty i opłatę z karty usługi BIP, daje link do zapisu online i pokazuje na mapie punkty obsługi z godzinami pracy.
>
> Potem Andrij wpisuje adres mieszkania i sprawdza w „Kraków w 15 minut”, które przedszkola i przystanki ma blisko domu.

## Dane, z których korzystamy

| Źródło | Do czego służy |
|---|---|
| **Otwarte Dane Miasta Krakowa** – lista usług administracyjnych z kartami BIP | indeks wszystkich 639 spraw, które można załatwić w mieście |
| **BIP Kraków** – karty usług (XML) | dokumenty, opłaty, terminy, miejsca obsługi i linki do zapisu – podstawa odpowiedzi asystenta |
| **Otwarte Dane** – przedszkola, szkoły podstawowe i ponadpodstawowe, żłobki, kluby dziecięce, kluby rodziców, biblioteki, parki | warstwy na mapie i „Kraków w 15 minut” |
| **Otwarte Dane** – mieszkańcy i cudzoziemcy według dzielnic | skala problemu i profil dzielnic |
| **MSIP** – punkty adresowe EMUiA, granice dzielnic | wyszukiwanie adresów (geokodowanie) i przypisanie miejsc do dzielnic |
| **ZTP** – rozkłady GTFS, przystanki, P+R | dojazd komunikacją miejską w „Kraków w 15 minut” |
| **OpenStreetMap / OpenFreeMap** | podkład mapy, sieć pieszych dróg, kształty parków |

Najważniejsze jest **łączenie tych źródeł**. Przykład: sprawa (karta BIP) → wydział urzędu → adres (EMUiA) → punkt na mapie → dostępność z domu użytkownika (GTFS + OSM). Albo: adres → strefa 15 minut → placówki → indeks dostępności.

## Dlaczego to ważne dla Krakowa

- **Mniej wizyt z niekompletnymi dokumentami.** Mieszkaniec przychodzi do urzędu przygotowany.
- **Łatwiejsza integracja nowych mieszkańców** – w ich języku, ale z oficjalnymi polskimi nazwami spraw.
- **Mapa luk w usługach publicznych.** Indeks „Kraków w 15 minut” pokazuje, gdzie brakuje np. żłobków czy przedszkoli w zasięgu spaceru.
- **Łatwe wdrożenie.** Aplikację można osadzić w serwisach miejskich, na stronach uczelni i u pracodawców.
- **Do przeniesienia do innych miast**, które publikują podobne dane.

Projekt wpisuje się w ideę Smart City i cyfryzacji usług publicznych ze Strategii Rozwoju Krakowa „Tu chcę żyć. Kraków 2030”.

## Jak to działa (w skrócie)

```mermaid
flowchart LR
  SRC["Dane miasta:<br/>Otwarte Dane, BIP,<br/>MSIP, ZTP, OSM"] --> PIPE["Skrypty Python<br/>(pobranie, czyszczenie,<br/>geokodowanie, 15 minut)"]
  PIPE --> DATA[("Gotowe pliki<br/>JSON / GeoJSON")]
  DATA --> APP["Aplikacja Next.js<br/>(mapa + czat)"]
  APP <--> LLM["Model językowy<br/>(tylko narzędzia z danymi)"]
  USER(("Mieszkaniec")) <--> APP
```

- **Aplikacja:** Next.js (TypeScript) na Vercel, mapa MapLibre.
- **Dane:** skrypty w Pythonie pobierają dane z oficjalnych źródeł i zapisują je jako statyczne pliki. Nie ma osobnej bazy danych.
- **AI:** Gemini przez Vercel AI SDK, z zapasowym dostawcą (Groq). Model odpowiada **tylko na podstawie wyników narzędzi** (karty BIP, dane miasta) i podaje źródła. Jeśli danych brak – mówi o tym wprost.
- **Prywatność:** bez kont użytkowników, bez przechowywania danych osobowych.

## Uruchomienie

**Online:** [oswoj-krakow.vercel.app](https://oswoj-krakow.vercel.app) – strona główna `/pl`, mapa i asystent `/pl/mapa`.

**Lokalnie** (wymaga Node.js):

```bash
cd app
npm ci
cp .env.example .env.local   # klucze API; LLM_MOCK=1 działa bez kluczy
npm run dev                  # http://localhost:3000 → /pl
```

Z ustawieniem `LLM_MOCK=1` czat działa bez żadnych kluczy (odpowiedzi testowe) – wystarczy do obejrzenia interfejsu i mapy. Więcej poleceń: [app/README.md](app/README.md).

## Status projektu

🚧 **Aplikacja jest w budowie.** Rozwijamy ją na konkurs – termin złożenia pracy to 5 listopada 2026 r. Część funkcji opisanych wyżej jest jeszcze w przygotowaniu, a wygląd i dane mogą się zmieniać. Demo online pokazuje bieżący stan prac.

Szczegółowy plan prac (po ukraińsku): [PLAN.md](PLAN.md).

## Zespół i konkurs

- **Zespół:** 3 osoby.
- **Konkurs:** Open Data App 2026, organizowany przez Gminę Miejską Kraków.
- Tekst zgłoszenia konkursowego: [docs/zgloszenie.md](docs/zgloszenie.md).

## Źródła danych i licencje

- Źródło danych: **Otwarte Dane Miasta Krakowa** (portal Urzędu Miasta Krakowa).
- Karty usług: **BIP Kraków** – każda odpowiedź asystenta zawiera link do karty.
- Punkty adresowe i dzielnice: **MSIP Kraków**. Komunikacja miejska: **ZTP Kraków**.
- Mapa: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL), OpenFreeMap.

Oswój Kraków to serwis informacyjny, a nie porada prawna. W razie wątpliwości obowiązuje treść karty usługi w BIP.
