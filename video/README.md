# Wideo „Oswój Kraków” (Remotion)

Film promocyjny dla jury: ~80 s, 1920×1080, polski lektor (ElevenLabs), napisy zsynchronizowane z głosem, nagrania prawdziwej aplikacji. Scenariusz: [SCENARIUSZ.md](SCENARIUSZ.md).

```bash
cd video
npm ci
npm run studio   # podgląd i edycja w przeglądarce
npm run render   # → out/oswoj-krakow.mp4
```

Pliki w repozytorium wystarczą do podglądu i renderu. Jak odtworzyć materiały:

1. **Makiety aplikacji:** sceny z aplikacją to animowane makiety rysowane na prawdziwych podkładach mapy. Podkłady i dane (pozycje urzędów, strefy „15 minut”, treść karty SA-34) pobiera `npm run capture` z działającej aplikacji: w `app/` `NEXT_PUBLIC_EXPOSE_MAP=1 npm run build && npm start`, potem tutaj `APP_URL=http://localhost:3000 npm run capture` → `public/mock/`, `src/mock.json`.
2. **Lektor:** tekst scen w `src/scenes.json`; `npm run voice` (klucz `ELEVENLABS_API_KEY` w `video/.env`) nagrywa cały tekst jednym podejściem, tnie go na sceny w środku pauz, z łagodnym wyciszeniem, i zapisuje czasy słów w `src/voice.json`. Nagranie jest zapamiętane w `voice-cache.json`, więc ponowne cięcie nie zużywa limitu. Długość każdej sceny wynika z długości jej nagrania.
3. **Muzyka:** `npm run music` syntezuje spokojny podkład (`public/music/bed.mp3`) – bez licencji zewnętrznych.
4. **Postacie:** rysowane od zera w `src/characters.tsx`; arkusz postaci w studiu: kompozycja „Characters”.

Remotion jest bezpłatny dla osób prywatnych i zespołów do 3 osób.
