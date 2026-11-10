# Agent 7 brief, part 7a: sound effects and music

You are Agent 7 (polish). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/design-doc.md (mood: relaxing, funny, PS1-era), docs/GUIDE-visual-direction.md (the options A/B/C method applies to sound too), docs/report-agent-3e.md, docs/report-agent-5c.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-7a.md. Free flight and combat are permanently out. Push to main if you have GitHub access.

## Goal
Add sound effects and relaxing music that fit a funny, PS1-style space trading game.

## Do
1. FIRST ask Andy what he imagines (style references: a few songs or game soundtracks, mood words, what must NOT be there). Do not build before you have them. Then offer THREE short sound samples A/B/C of the music style and of the effect style (chunky, lo-fi, PS1-era) and let Andy choose.
2. Sources: prefer sound made in the browser from code (Web Audio, no files, no licences) or CC0 / public-domain files with the licence written in the report and in `docs/CREDITS.md`. No copyrighted music. Keep total added download small (phones, free hosting).
3. Effects (suggested list, Andy confirms): button click and menu open/close, accept job, take-off, warp start, warp loop hum (very quiet), arrival, payment/cash, refuel, buy ship/outpost, rank-up, error/blocked, funny small blips for funny messages.
4. Music: calm, loops without a hard seam, different calm mood for docked and flight (or one track, Andy chooses), quiet by default.
5. Rules: browsers block sound until the first tap or click, so audio starts after the first user action (no errors, no console warnings). A visible mute button for music and effects separately in the MENU (ask Andy where), the choice is saved with the game settings (small new field with a default; coordinate with Agent 6's save rules: add the field with a default in `normalizeState`-style so old saves load). Volume changes are smooth (no clicks). Sound pauses when the tab is hidden.
6. Layers: sound code in its own folder `src/audio/`. The audio layer imports nothing from render or ui; glue lives in `src/ui/index.ts` (events from the game: accept, arrival, etc.). Add a test that enforces the layer rule if the existing test does not cover the new folder.
7. Tests for the pure parts (volume maths, mute state, event-to-sound mapping). `npm run check` must pass.

## Allowed / not allowed
Allowed: `src/audio/` (new), small glue in `src/ui/index.ts` and the MENU file in `src/ui`, tests, docs. Not allowed: `src/render`, `src/game`, `src/universe`, `src/render/assets`; ask the Lead.

## Andy checks (after a green Actions run)
Desktop and phone (iPhone Safari too): first tap starts sound, mute works and is remembered after reload, no sound while the tab is hidden, effects fit the moments, music calm and not annoying over 10 minutes. Andy answers per item: keep / change what.
