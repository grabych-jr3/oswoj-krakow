# AGENTS.md — Oswój Kraków

Веб-застосунок «Oswój Kraków» (конкурс Open Data App, Kraków): AI-асистент + карта для нових мешканців.
Єдине джерело правди — PLAN.md (§3 дані, §4 архітектура, §5 правила, §6 задачі).

## Зони (редагуй тільки свою; людина називає зону на старті сесії)
- A — Geo & Data: pipeline/geo/**, app/src/server/geo/**, app/src/app/api/geocode/**, app/src/app/api/nearby/**,
  app/public/data/layers/**, app/data/geo/**, app/scripts/validate-geo.ts, docs/tech/dane.md
- B — Knowledge & AI: pipeline/kb/**, content/scenarios/**, evals/**, app/src/server/agent/**, app/src/app/api/chat/**,
  app/data/kb/**, app/scripts/validate-kb.ts, docs/tech/ai.md
- C — App/UX & Delivery: усе інше в app/, root-конфіги, .github/**, docs/** (крім файлів A і B), README.md
- Спільне (тільки через PR з апрувом): app/src/contracts/**, PLAN.md, AGENTS.md, CLAUDE.md
Якщо задача вимагає змін поза зоною — НЕ змінюй: зупинись і опиши, що і чому треба змінити.

## Правила
1. app/src/contracts/** — тільки читати; типи імпортуй звідти, не дублюй.
2. Між зонами імпортуй лише публічні входи: "@/server/geo" і "@/server/agent/starters".
3. Не додавай залежностей в app/package.json — попроси власника C (PR "deps:").
4. Дані для користувача — тільки з app/data/** і app/public/data/**. Не вигадуй адрес, годин, документів, термінів.
5. Код, назви, коментарі — англійською. Тексти UI — тільки через i18n (app/messages/*.json).
6. Перед комітом: у app/ — `npm run check`; у pipeline/* — `uv run ruff check && uv run pytest`.
7. Маленькі коміти (Conventional Commits), гілка `<a|b|c>/<тема>`, PR у main.
8. Репо публічне: секрети — тільки в .env.local; ніколи не комітити ключі чи персональні дані.
