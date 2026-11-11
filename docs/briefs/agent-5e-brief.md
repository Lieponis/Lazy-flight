# Agent 5 brief, stage U3 (UI): wording and menus for fewer docks

You are Agent 5 (UI/UX). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-fewer-docks.md, docs/report-agent-4e.md, docs/report-agent-5d.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Visual change: options A/B/C first. Report: docs/report-agent-5e.md. Free flight and combat are permanently out. Do not edit src/universe, src/game, src/save, and do not edit the system-view drawing in src/render (Agent 3 works there in parallel); you only touch src/ui, CSS and ui tests.

## Do
1. The planet info panel (Agent 4 added it; it says "No dock here - nothing to visit"): make it clear and in the game's funny, relaxed voice, readable on a phone. Docks and scenery planets must be told apart in the panel.
2. Check every menu and text that said "planet" when it meant "dock" (Jobs, Map, Shipyard, hints, tutorial): use consistent words. A system with ONE dock must not show an empty destination list or a confusing message.
3. The "universe was rebuilt" message after an old save is migrated: make it nice, short, shown once, dismissible on a phone.
4. Tutorial hints still correct for the new universe.
5. All tests green (`npm run check`).

## Allowed / not allowed
Allowed: src/ui, CSS, ui tests, docs. Not allowed: anything else; no new features.

## Andy checks
Tap a planet with and without a dock; read the panel on a phone; check Jobs/Map in a one-dock system (try a few seeds); load an old save once to see the message.
