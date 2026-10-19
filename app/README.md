# app — Next.js

Aplikacja webowa „Oswój Kraków” (mapa + czat). Plan i podział na strefy: [../PLAN.md](../PLAN.md).

```bash
npm ci
cp .env.example .env.local   # klucze API; LLM_MOCK=1 działa bez kluczy
npm run dev                  # http://localhost:3000 → /pl
npm run check                # lint + typecheck + testy + walidacja danych
```

Języki: `pl` (domyślny), `uk`, `en` — teksty w `messages/*.json`. Kontrakty danych: `src/contracts/` (tylko do odczytu).
