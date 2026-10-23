# Wideo „Oswój Kraków” (Remotion)

Film promocyjny dla jury: ~80 s, 1920×1080, polski lektor (ElevenLabs), napisy zsynchronizowane z głosem, nagrania prawdziwej aplikacji. Scenariusz: [SCENARIUSZ.md](SCENARIUSZ.md).

```bash
cd video
npm ci
npm run studio   # podgląd i edycja w przeglądarce
npm run render   # → out/oswoj-krakow.mp4
```

Pliki w repozytorium wystarczą do podglądu i renderu, poza nagraniami ekranu (`public/rec/`, nie są w git – duże). Jak je odtworzyć:

1. **Nagrania aplikacji:** w `app/` `NEXT_PUBLIC_EXPOSE_MAP=1 npm run build && npm start` (z kluczem modelu w `app/.env.local`), potem tutaj `APP_URL=http://localhost:3000 npm run record`. Długości klipów trafiają do `src/clips.json`.
2. **Lektor:** tekst scen w `src/scenes.json`; `npm run voice` (klucz `ELEVENLABS_API_KEY` w `video/.env`) zapisuje `public/voice/*.mp3` i czasy słów w `src/voice.json`. Długość każdej sceny wynika z długości jej nagrania, więc obraz i głos zawsze się zgadzają. Po zmianie jednego zdania: `npm run voice -- s3-reveal`.
3. **Muzyka:** `npm run music` syntezuje spokojny podkład (`public/music/bed.mp3`) – bez licencji zewnętrznych.

Remotion jest bezpłatny dla osób prywatnych i zespołów do 3 osób.
