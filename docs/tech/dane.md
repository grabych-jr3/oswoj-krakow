# Dane: źródła, przetwarzanie, licencje, jakość

Mapa i asystent Oswój Kraków korzystają wyłącznie z danych publicznych: przede wszystkim z portalu Otwarte Dane Miasta Krakowa, a także z MSIP, ZTP, BIP i OpenStreetMap. Ten dokument opisuje, skąd pochodzą dane, jak je przetwarzamy, jak sprawdzamy ich jakość i na jakich warunkach z nich korzystamy.

Wszystkie dane przestrzenne przygotowuje powtarzalny potok w Pythonie (`pipeline/geo`). Nic nie jest wpisywane ręcznie: każdą liczbę w tym dokumencie można odtworzyć poleceniami z sekcji 7, a raporty jakości są w repozytorium (`pipeline/geo/reports/`).

## 1. Przepływ danych

```
Otwarte Dane (API) ─┐
MSIP: adresy, dzielnice ─┤                       ┌─► app/public/data/layers/   (mapa w przeglądarce)
ZTP: GTFS, ArcGIS ─┼─► pipeline/geo ─► walidacja ─┤
BIP (przez strumień B) ─┤   (Python)              └─► app/data/geo/             (serwer: geokoder, „15 minut”)
OpenStreetMap, RSPO ─┘
```

1. **Pobranie** (`geo-fetch`): surowe odpowiedzi trafiają do lokalnej pamięci podręcznej. Manifest zapisuje adres, czas pobrania i liczbę rekordów każdego źródła.
2. **Normalizacja**: liczby zapisane jako float (`1.08e+002`) i telefony zapisane jako liczby (`1.2411743e+008` → „12 411 74 30”) wracają do właściwej postaci, a spacje na początku pól są usuwane.
3. **Geokodowanie** (`geo-geocode`): zbiory miasta zwykle nie mają współrzędnych, tylko adres. Punkt bierzemy z oficjalnych punktów adresowych EMUiA (MSIP).
4. **Warstwy** (`geo-layers`, `geo-parks`, `geo-stops`, `geo-offices`): GeoJSON zgodny z jednym kontraktem `Place`, z odnośnikiem do źródła w każdym obiekcie.
5. **Dzielnice** (`geo-districts`): granice 18 dzielnic, liczba mieszkańców i cudzoziemców, liczba miejsc z każdej kategorii.
6. **„15 minut”** (`geo-access`): dojścia piesze i dojazdy komunikacją miejską policzone z siatki heksagonów H3.
7. **Walidacja** (`app/scripts/validate-geo.ts`) sprawdza wynik przed każdym scaleniem kodu (CI).

## 2. Źródła

### Otwarte Dane Miasta Krakowa (`otwartedane.um.krakow.pl`, API `api.um.krakow.pl`)

| Zbiór danych | Rekordy | Stan danych | Użycie |
|---|---:|---|---|
| Przedszkola w Krakowie – liczba dzieci (samorządowe + niesamorządowe) | 136 + 350 | 30.09.2025 | warstwa `przedszkole` |
| Szkoły podstawowe – liczba dzieci (samorządowe + niesamorządowe) | 129 + 79 | 30.09.2025 | warstwa `szkola_podstawowa` |
| Szkoły ponadpodstawowe – liczba uczniów (samorządowe + niesamorządowe) | 132 + 101 | 30.09.2025 | warstwa `szkola_ponadpodstawowa` |
| Żłobki samorządowe / prywatne / prowadzone na zlecenie GMK | 33 / 266 / 11 | 19.10.2026 / 22.07.2026 / 22.07.2026 | warstwa `zlobek` |
| Kluby dziecięce | 21 | 22.07.2026 | warstwa `klub_dzieciecy` |
| Kluby rodziców z dziećmi do lat 3 | 50 | brak daty w zbiorze | warstwa `klub_rodzica` |
| Lista bibliotek miejskich (filie Biblioteki Kraków) | 62 | brak daty w zbiorze | warstwa `biblioteka` |
| Parki miejskie / parki kieszonkowe (nazwa, dzielnica, powierzchnia) | 78 / 44 | brak daty w zbiorze | warstwy `park`, `park_kieszonkowy` |
| Mieszkańcy zameldowani na pobyt stały i czasowy | wg dzielnic | 31.12.2025 | statystyki dzielnic |
| Cudzoziemcy zameldowani na pobyt stały i czasowy (wg obywatelstwa) | 793 + 971 | 31.12.2025 | statystyki dzielnic |

Dane pobrano 19–21.10.2026. Datę „stan danych na” każdego zbioru przenosimy do pola `source.updatedAt` każdego obiektu i do `index.json`, więc interfejs może ją pokazać przy każdym miejscu.

### Pozostałe źródła

| Źródło | Co bierzemy | Użycie |
|---|---|---|
| **MSIP Kraków**: punkty adresowe EMUiA (`msip.um.krakow.pl/Dane/Adresy_JSON.zip`) | 70 299 adresów z kodem pocztowym i dzielnicą, układ EPSG:2178 | współrzędne wszystkich miejsc, geokoder aplikacji |
| **MSIP Kraków**: dzielnice (`Dzielnice_JSON.zip`) | granice 18 dzielnic, EPSG:2178 | warstwa dzielnic, przypisanie miejsc do dzielnic |
| **ZTP Kraków**: GTFS KMK (`gtfs.ztp.krakow.pl`, pliki A, T, M) | rozkłady autobusów i tramwajów | numery linii na przystankach, dojazdy w „15 minut” |
| **ZTP Kraków**: warstwy ArcGIS | przystanki KMK (stan 01.10.2026), Park & Ride (02.10.2024), izochrony dojścia do przystanków (24.07.2026), granice parków kieszonkowych | warstwy `przystanek`, `park_and_ride`, warstwa izochron, lokalizacja parków |
| **BIP Kraków**: karty usług (`bip.krakow.pl/uslugi`) | urzędy przyjmujące dokumenty: adres, godziny, telefon, rezerwacja wizyty, lista procedur | warstwa `urzad` (karty pobiera i parsuje strumień AI, zob. [ai.md](ai.md)) |
| **OpenStreetMap**: wyciąg Małopolski (Geofabrik), Overpass, Nominatim | sieć dróg i chodników; obszary parków; nazwy i numery instytucji | trasy w „15 minut”, położenie parków, uzupełnianie brakujących numerów domów |
| **RSPO** (Rejestr Szkół i Placówek Oświatowych, `rspo.gov.pl`) | adres szkoły lub przedszkola wg numeru RSPO | uzupełnianie brakujących numerów domów |

Zapytania do usług zewnętrznych (RSPO, Nominatim, BIP) wysyłamy najwyżej raz na sekundę i zapisujemy odpowiedzi w pamięci podręcznej. Każde źródło jest odpytywane tylko raz.

## 3. Przetwarzanie

### Geokodowanie: zawsze punkt adresowy miasta

Współrzędne każdego miejsca to współrzędne **oficjalnego punktu adresowego EMUiA**, przeliczone z układu PL-2000 strefa 7 (EPSG:2178) do WGS 84 (EPSG:4326). Inne źródła służą tylko do odzyskania brakującego numeru domu. Nie zastępują punktu miasta.

Kolejność dopasowania:

1. **Dokładny klucz**: ulica i numer po normalizacji (małe litery, bez „ul.”, polskie znaki bez zmian).
2. **Część nazwy**: „Kutrzeby” → „Generała Tadeusza Kutrzeby”. Przy remisie decyduje rodzaj ulicy (osiedle, aleja, plac) i kod pocztowy.
3. **Dopasowanie przybliżone** (rapidfuzz ≥ 85) dla literówek.
4. **Brakujący numer domu.** Portal zapisuje „Nr domu” jako liczbę, więc „28A” przychodzi jako puste pole (179 rekordów). Numer odzyskujemy:
   - z rejestru **RSPO**, jeśli ulica w RSPO jest tą samą ulicą;
   - z **Nominatim**, jeśli zgadza się ulica i nazwa instytucji;
   - z obiektu **OSM** właściwego typu, leżącego najwyżej 60 m od punktu EMUiA tej ulicy.

   Punkt zawsze bierzemy z EMUiA.
5. **`manual_fixes.csv`**: ręczna poprawka jednego rekordu z obowiązkowym opisem źródła poprawki. Obecnie plik jest pusty: wszystkie rekordy obsłużyły reguły.

Metodę dopasowania przechowujemy w każdym miejscu (`attrs.location`: `address` albo `street`). Interfejs może więc odróżnić punkt budynku od punktu na ulicy.

### Warstwy miejsc

| Warstwa | Obiekty | Jak powstaje |
|---|---:|---|
| `zlobek` | 309 | 3 zbiory żłobków; duplikaty usunięte |
| `klub_dzieciecy` | 21 | |
| `przedszkole` | 486 | id według numeru RSPO (`przedszkole:rspo-…`) |
| `szkola_podstawowa` | 208 | id według numeru RSPO |
| `szkola_ponadpodstawowa` | 233 | id według numeru RSPO |
| `klub_rodzica` | 50 | |
| `biblioteka` | 62 | |
| `park` | 78 | zbiór ma tylko nazwę i powierzchnię; punkt leży wewnątrz obszaru parku z OSM (powierzchnia 1/3–3× wartości miasta) albo w punkcie OSM o tej samej nazwie |
| `park_kieszonkowy` | 41 | najpierw poligony parków kieszonkowych miasta (ArcGIS), potem OSM |
| `przystanek` | 814 | słupki ZTP zgrupowane w przystanki (np. słupki 642-01…04 → jeden przystanek); tylko przystanki KMK w granicach Krakowa; linie z GTFS |
| `park_and_ride` | 10 | warstwa ZTP |
| `urzad` | 56 | urzędy z kart BIP; adres z tekstu karty dopasowany do EMUiA; atrybut `procedures` wymienia wszystkie usługi przyjmowane w danym urzędzie |
| **Razem** | **2368** | |

Nazwy zapisane w źródle wielkimi literami są przepisywane do czytelnej postaci; skróty, numery rzymskie i „nr” zostają bez zmian. Adresy mają nazwę ulicy z EMUiA i kod pocztowy, np. „ul. Bolesława Limanowskiego 4, 30-534 Kraków”.

### Dzielnice

Granice MSIP są upraszczane wspólnie z tolerancją 5 m, więc sąsiednie dzielnice dzielą jedną granicę, bez szczelin i nakładek. Dla każdej dzielnicy liczymy:
- liczbę zameldowanych mieszkańców i cudzoziemców (pobyt stały + czasowy);
- pięć najczęstszych obywatelstw. Pozycje „INNE KRAJE”, „NIEUSTALONE” i „BEZPAŃSTWOWCY” nie są krajami i są pomijane;
- liczbę miejsc z każdej warstwy.

Łącznie Kraków ma 735 955 zameldowanych mieszkańców, w tym 20 774 cudzoziemców (31.12.2025).

### „15 minut” i Indeks 15 minut

- **Siatka:** 3217 heksagonów H3 (rozdzielczość 9, ok. 0,1 km² każdy) pokrywa granice miasta.
- **Trasy:** silnik r5py (R5, Conveyal) na sieci OSM i rozkładach GTFS KMK. Liczymy dwa tryby:
  - pieszo, 4,8 km/h;
  - pieszo + komunikacja miejska: wtorek 27.10.2026, odjazd 8:00, okno 30 minut, mediana czasu.

  Z każdego heksagonu zapisujemy miejsca i heksagony osiągalne w ciągu 15 minut.
- **Indeks 15 minut** (0–100) mówi, ile z 6 podstawowych grup usług jest w zasięgu 15 minut, przeliczone na skalę 0–100. Grupy:
  - żłobek lub klub dziecięcy;
  - przedszkole;
  - szkoła podstawowa;
  - park lub park kieszonkowy;
  - biblioteka;
  - przystanek.

  Indeks dla każdego heksagonu jest w pliku `access-index.json`, który zasila warstwę mapy.
- **Odpowiedź w aplikacji:** serwer przypisuje podany punkt do heksagonu i zwraca strefę, listę miejsc z czasem dojścia i indeks w czasie poniżej 1 ms. Nie odpytuje żadnej usługi zewnętrznej.
- **Wariant zapasowy (bez Javy):** `geo-access --engine osmnx` liczy dojścia piesze algorytmem Dijkstry na sieci chodników OSM.
- **Izochrony ZTP:** dodatkowa warstwa z oficjalnymi strefami dojścia do przystanków (100–500 m), przeniesiona na siatkę H3.

### Geokoder aplikacji

Pole adresu w aplikacji korzysta z tych samych 70 299 punktów EMUiA (`app/data/geo/addresses.json`, 2659 ulic). Geokoder:
- podpowiada od pierwszych liter („wiel” → ul. Wielicka);
- działa bez polskich znaków;
- wybacza jedną literówkę;
- rozumie numer mieszkania („Zakopiańska 105/12”) i numer przed ulicą („28 Wielicka”).

Działa w całości na serwerze aplikacji i nie odpytuje usług zewnętrznych.

## 4. Jakość

### Geokodowanie placówek (cel ≥ 95% z dokładnością do budynku)

| Zbiór | Rekordy | Budynek | Tylko ulica | Nie znaleziono |
|---|---:|---:|---:|---:|
| Przedszkola | 486 | 485 (99,8%) | 1 | 0 |
| Szkoły podstawowe | 208 | 208 (100%) | 0 | 0 |
| Szkoły ponadpodstawowe | 233 | 232 (99,6%) | 1 | 0 |
| Żłobki | 309 | 307 (99,4%) | 2 | 0 |
| Kluby dziecięce | 21 | 21 (100%) | 0 | 0 |
| Kluby rodziców | 50 | 23 (46%) | 27 | 0 |
| Biblioteki | 62 | 61 (98,4%) | 1 | 0 |
| **Razem** | **1369** | **1337 (97,7%)** | **32** | **0** |

Cel jest osiągnięty. W 7 przypadkach dokładnego numeru (np. „1A”) nie ma w EMUiA i użyto numeru podstawowego („1”); takie miejsca są oznaczone w raporcie.

Metody: dokładny klucz 1182, numer z RSPO 131, część nazwy 34, numer z Nominatim 17, numer z OSM 4, numer przybliżony 1 (pełny podział w `reports/geocoding.md`).

**Kontrola niezależnym źródłem.** 52 placówki znaleźliśmy także w OSM. W 40 przypadkach RSPO i OSM wskazują ten sam budynek, w 10 sąsiedni (≤ 125 m), w 2 różny. Dlatego RSPO ma pierwszeństwo przed OSM.

### Pozostałe warstwy

| Warstwa | Wynik | Cel |
|---|---|---|
| Parki | 119 z 122 zlokalizowanych (97,5%): parki miejskie 78/78, kieszonkowe 41/44 | ≥ 90% |
| Urzędy (BIP) | 56 z 57 na mapie, wszystkie z dokładnością do budynku; jedyny pominięty leży poza Krakowem (kod pocztowy spoza 30-/31-) | |
| Przystanki | 814 przystanków KMK; linie z GTFS; przystanki bez kursów mają `lines: null` | |
| Dzielnice | sumy z tabel dzielnicowych zgadzają się z tabelami szczegółowymi tej samej populacji; w razie rozbieżności potok kończy się błędem | zgodność 100% |

### „15 minut”

- **Adresy kontrolne:** wyniki dla 5 punktów są sprawdzane ręcznie w `reports/access.md`.

  | Punkt | Indeks pieszo | Czego brakuje |
  |---|---:|---|
  | ul. Wielicka 28 | 67 | park, biblioteka |
  | Rynek Główny | 100 | |
  | pl. Centralny | 100 | |
  | Kurdwanów | 100 | |
  | Tyniec | 50 | żłobek, park, biblioteka |

- **Dwa niezależne silniki.** Porównaliśmy r5py i osmnx (pieszo). Indeks jest taki sam we wszystkich 5 punktach kontrolnych i w 82% heksagonów. Zbiory osiągalnych miejsc pokrywają się w 89% (mediana Jaccarda). Czas dojścia różni się o najwyżej 1 minutę dla 84% miejsc.
- **Pokrycie:** 2936 z 3217 heksagonów ma w zasięgu co najmniej jedno miejsce. Pozostałe to obszary bez dróg i miejsc w pobliżu (np. lasy, pola). Punkt w takim heksagonie dostaje odpowiedź z najbliższego heksagonu z danymi (najwyżej 2 pierścienie dalej).

### Walidacja automatyczna (każdy pull request)

`npm run validate:data` (`app/scripts/validate-geo.ts`) sprawdza:
- każdą warstwę względem kontraktu `Place` (zod);
- czy współrzędne leżą w granicach Krakowa;
- unikalność identyfikatorów;
- zgodność liczby obiektów z `index.json`;
- 18 dzielnic i spójność ich statystyk;
- zgodność danych serwera z warstwami;
- zakresy indeksu i czasów dojścia.

Potok ma ponad 100 testów jednostkowych (pytest), a moduł serwera ma własne testy (Vitest).

## 5. Ograniczenia

- **Kluby rodziców:** 27 z 50 rekordów ma w źródle tylko ulicę bez numeru, a żadne inne źródło nie potwierdziło budynku. Leżą na swojej ulicy (`attrs.location: "street"`), nie w budynku.
- **Parki:** zbiór miasta nie ma geometrii. Park jest na mapie punktem wewnątrz jego obszaru z OSM. 3 parków kieszonkowych nie udało się jednoznacznie zlokalizować; pominęliśmy je zamiast zgadywać.
- **Placówki oświatowe** mają stan na 30.09.2025 (rok szkolny 2025/26), a statystyki mieszkańców na 31.12.2025. Dane z portalu nie mówią, czy placówka ma wolne miejsca.
- **Mieszkańcy** to osoby zameldowane. Liczba osób faktycznie mieszkających w dzielnicy może być inna, zwłaszcza wśród cudzoziemców.
- **Komunikacja miejska** jest liczona dla jednego typowego poranka dnia roboczego. Wieczorem i w weekend zasięg będzie mniejszy. Po zmianie rozkładów GTFS trzeba ponownie uruchomić `geo-access`.
- **„15 minut”** jest liczone z rozdzielczością heksagonu (ok. 175 m). To przybliżenie dla okolicy, nie nawigacja do drzwi.

## 6. Licencje i atrybucja

| Źródło | Warunki | Jak je spełniamy |
|---|---|---|
| Otwarte Dane Miasta Krakowa | „Warunki wykorzystania Danych udostępnianych w Portalu”: swobodne i bezpłatne ponowne wykorzystanie. Należy podać źródło (Gmina Miejska Kraków, otwartedane.um.krakow.pl) oraz czas wytworzenia i pozyskania danych. | Każdy obiekt ma `source` z linkiem do strony zbioru i datą „stan danych na”. Daty pobrania są w manifeście potoku i w tym dokumencie (pkt 2). |
| BIP Kraków | informacja publiczna | Każda odpowiedź asystenta o procedurze zawiera link do karty usługi. Warstwa urzędów wskazuje katalog usług BIP. |
| MSIP Kraków, ZTP Kraków | dane publikowane przez jednostki miasta | Źródło podane w sekcji „Skąd są dane” w aplikacji; przystanki i P+R mają link do warstwy ZTP w każdym obiekcie. |
| OpenStreetMap | © OpenStreetMap contributors, licencja ODbL 1.0 | Atrybucja na mapie. Dane OSM wspierają lokalizację parków, uzupełnianie numerów i sieć tras. |
| RSPO | rejestr publiczny | Używany tylko do odczytania numeru domu; współrzędne pochodzą z EMUiA. |

Zgodnie z pkt 6 warunków portalu miasto nie odpowiada za kompletność danych. Dlatego aplikacja pokazuje źródło i datę przy każdym miejscu, a przy procedurach odsyła do karty BIP.

## 7. Jak odtworzyć dane

Wymagania: Python 3.12 z `uv`, do obliczeń „15 minut” JDK 21+.

```bash
cd pipeline/geo
uv sync
uv run geo-fetch          # pobranie wszystkich źródeł (ok. 230 MB, w tym OSM Małopolski)
uv run geo-geocode        # geokodowanie + reports/geocoding.md
uv run geo-layers
uv run geo-districts
uv run geo-parks
uv run geo-stops
uv run geo-offices
uv run geo-districts      # ponownie: liczby parków, przystanków i urzędów
uv run geo-access         # „15 minut” (r5py, ok. 6 min na 8 rdzeniach)
uv run geo-isochrones
uv run geo-addresses      # dane geokodera aplikacji
cd ../../app && npm run validate:data
```

Szczegóły techniczne każdego kroku: [pipeline/geo/README.md](../../pipeline/geo/README.md).
