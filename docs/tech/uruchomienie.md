# Uruchomienie

## 1. Online

Aplikacja działa pod adresem [oswoj-krakow.vercel.app](https://oswoj-krakow.vercel.app) – strona główna `/pl`, mapa i asystent `/pl/mapa`. Nie wymaga instalacji ani konta.

## 2. Lokalnie

Wymaga Node.js 24 LTS i npm.

```bash
git clone https://github.com/grabych-jr3/oswoj-krakow.git
cd oswoj-krakow/app
npm ci
cp .env.example .env.local   # tu wpisz klucz API modelu (np. INFERCOM_API_KEY lub GOOGLE_GENERATIVE_AI_API_KEY)
npm run dev                  # http://localhost:3000 → /pl
```

- **Bez kluczy API:** ustaw w `.env.local` wartość `LLM_MOCK=1`. Czat odpowiada wtedy testowymi odpowiedziami, a mapa, warstwy i „Kraków w 15 minut” działają w pełni (nie korzystają z modelu).
- **Wersja produkcyjna lokalnie:** `npm run build && npm start`.
- **Testy i kontrola jakości:** `npm run check` (lint, typy, testy jednostkowe, walidacja plików danych).

## 3. Aktualizacja danych

Wymaga Pythona 3.12 z [uv](https://docs.astral.sh/uv/); do „15 minut” także JDK 21+. Gotowe dane są w repozytorium, więc do uruchomienia aplikacji ten krok nie jest potrzebny.

- dane przestrzenne: `pipeline/geo` – kolejność poleceń w [dane.md, pkt 7](dane.md#7-jak-odtworzyć-dane);
- baza wiedzy BIP: `pipeline/kb` – polecenia w [pipeline/kb/README.md](../../pipeline/kb/README.md);
- na koniec `cd app && npm run validate:data` sprawdza, czy nowe pliki zgadzają się z kontraktami.
