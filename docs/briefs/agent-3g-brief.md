# Agent 3 brief, stage F2a: the 3D views for free travel (render only)

You are Agent 3 (Rendering). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/proposal-free-travel.md (Andy's answers), docs/report-agent-4f.md (section 6), docs/report-agent-3f.md, docs/GUIDE-visual-direction.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). For anything visual, show options A/B/C first, then a "matches / does not match" list. Report: docs/report-agent-3g.md. Combat and weapons never; no steering. Agent 5 builds the buttons and texts AFTER you (stage F2b), so you also leave a clear small API for them.

## Situation
Free travel is in the game logic (Agent 4, live). A free trip goes from a dock or a floating spot to a dock OR to a planet WITHOUT a dock. Today the views only know dock-to-dock job trips: a free trip would wrongly show the docked view, and arriving at a scenery planet has no scene.

## Do
1. Travel (cockpit/flight, warp): a free trip uses the same departure, warp and arrival as a job trip. It must also work when the destination is a scenery planet (no station or outpost), and when leaving from one (no dock to undock from: start from a view of that planet).
2. Floating at a scenery planet (`state.spacePlanetId` set, no dock): show a calm "in space at this planet" scene: the planet large with its look (7c: rings, colours), the star lighting it, the starfield, a gentle slow drift or turn. No station, no landing. Cockpit or outside view: offer Andy options A/B/C. Nothing may overlap or cut through the planet (ring rule from 7c: no rings cutting a pad is not an issue here, but check rings with the camera). It must stay light for phones (triangle count, report it).
3. Arriving at a dock after a free trip uses the normal docked view.
4. Leave Agent 5 a tiny API in `src/render` (names yours, documented in the report): start a free trip view by target id, show the floating scene for a planet id, leave it. Keep the layer rule: render imports nothing from game or ui; ids go through the glue as strings. Only edit `src/ui/index.ts` / `src/main.ts` glue where a free trip would otherwise show the docked view or break (smallest possible, say exactly what you changed); Agent 5 does all menus and texts.
5. Tests for any pure helper; `npm run check` green; Actions green. Add a debug way to see the floating scene without playing (e.g. `?floatpreview=1` with a seed and planet step buttons), like `?systempreview=1`.

## Allowed / not allowed
Allowed: src/render, render tests, preview page code, the smallest glue in src/ui/index.ts and src/main.ts as above, docs. Not allowed: src/universe, src/game, src/save, menus and texts (Agent 5), new features, anything Andy decided.

## Andy checks
Use the preview: step through floating scenes of several planets (gas giant, ringed, rocky, ice); check nothing overlaps and it looks calm. On the debug page start a free trip to a scenery planet and see warp, arrival and the floating scene. Check a free trip to a dock still ends docked.
