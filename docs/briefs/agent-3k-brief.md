# Agent 3 brief, stage G5a: render layer and the real map on universe v3

You are Agent 3 (Rendering). Andy said "Go galaxy". The universe (G3, Agent 2) and the game and save layers (G4, Agent 4) are done on branch `universe-v3` (never main). Work ONLY on branch `universe-v3`, on its CURRENT head. Nothing merges into main in this stage. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Visual work: options A/B/C and "matches / does not match". Explain technical words in one sentence. Combat never. Report: docs/report-agent-3k.md.

## Read first
docs/WHERE-TO-LOOK.md, docs/status.md, **docs/universe-v3-game-api.md** (Agent 4's short API), docs/report-agent-4i.md (section 9 = work list), docs/report-agent-2e.md (sections 2, 3, 9), **your own docs/report-agent-3j.md (sections "What must change in the real map code", "The game's own starfield and the sky function", formulas, caps)**, docs/report-agent-3i.md.

## Rules
- Render never imports `src/game`, `src/ui` or `src/universe` (the layer test checks this). Data reaches render as plain arrays through the glue in `src/ui/index.ts` / `src/main.ts`. The glue MAY import `src/universe` directly (for example `NearCache.sites(...)`) because ui is above universe; keep it small.
- Agent 5 works on the same branch at the same time on the screens (reach states, messages). To avoid clashes: do **Step 1 first** (get everything compiling with the smallest glue edits, push, tell Andy so he can start Agent 5), then continue. In `src/ui/index.ts` touch only the glue lines you need and list them in your report. Other ui files are Agent 5's.
- Keep: layer rules, the pixel look (320x180 game picture), phone speed, all earlier decisions (cockpit, names fit, "Sharp" text, liveries, free-trip scenery).

## Do
1. **Step 1, compile fix (small, push at once):** replace every `listSystemsNear` in `src/render/index.ts`, `starmap.ts`, `start.ts`, `systemview.ts`, `src/models.ts`, `src/planets.ts` (system ids are numbers now; planet/dock ids are `"<number>/<index>"` text). Use the nearest-N lists (`game.nearbySystems(count)` via the glue, or `NearCache`). `/planets.html` (look wall): rebuild its list with `nearestSystems(seed, START_POINT, 40)` and make sure every planet look still draws (the looks change because the planet ids changed). Goal of step 1: `npm run check` has NO type error in render, models, planets, game-debug. Ui type errors may remain (Agent 5).
2. **The real galaxy map** (from report-agent-3j): nearest 60,000 stars as pixels (closer = brighter, fade at the edge of the ball), diamonds for stars inside the ship's REAL reach (`game.getPlaceInfo().rangeLy` / `fuelRangeLy`; the preview's AUTO reach is NOT used; cap 5,000 diamonds on phones, 10,000 maximum), tappable = nearest 10,000, tap picks the NEAREST star inside the finger tolerance (your tap fix), camera closest zoom 2.5 ly, farthest zoom from the local star spacing (as in the preview), tap flies to the star, one label for the tapped star plus the "5 nearest" line, never a label per star. The near stars take the galaxy's thin-disc shape (as your shaping step in G2, if finished; if that step is not done, do it here and say so). The map asks the universe for the stars **once per move**, never per frame, and keeps the nearest-N list in a cache. Keep `?reach=NUMBER` as a test aid if it still makes sense (say what it does now).
3. **The sky from where you stand** (Andy approved): glow plus 60,000 dots behind the map as in the preview, rebuilt only when you cross a sky cell, in slices per frame, old sky stays until the new one is ready. Use Agent 2's `densityAt`/`lineIntegralDensity` through plain functions passed by the glue (render still imports no universe code): replace your stand-in `GalaxyField` by a field the glue builds from the universe functions.
4. **Per-system sky in the other views** (Andy approved "per system sky"): `starfieldPositions` gets an optional seed argument (default = today's number so old calls stay identical); system view, flight, docked, floating and the models page pass a number made from the system number. Decoration only. A test proves: default call identical to before, two systems give different patterns, the same system always the same.
5. **Names and 3D screens:** the long names (system 29, planet 34, dock 62 letters) must still fit the cockpit screens, the flat HUD, the planets wall and the map label. Re-run your name-fit checks with the v3 worst cases (`namesamples.ts`), and check the real start names ("Bimvik Deep JR62R-MT37", dock "Breezy Hill Outpost, Bimvik Deep JR62R-MT37 III").
6. **Rim and centre:** the map must work at the dense centre (do not draw or process more than your caps), at the start, in the middle and at the rim (thin disc, 71+ ly to the nearest star; no empty or broken screen). Test pages: `?namepreview=1`, `?floatpreview=1`, `?systempreview=1` keep working; the preview page `/galaxy-map-preview.html` may stay as a developer page or be removed (say which).
7. **Phone speed:** measure on the real page (FRAME line) at the four places on Andy's iPhone; if a number is slow, use the fallbacks of your report (30,000 near pixels, sky size 32, fewer diamonds). Report numbers, not feelings.
8. **Tests:** fix the render tests that fail (`render-helpers`, `planetlook`, `floatpick`, `earthlike`, `title` ...; see the lists in report-agent-2e section 9 and report-agent-4i section 9). `tests/agent6c.test.ts` counts literals in `flight.ts`; do not add more `launchSeconds:` / `this.phases = `.

## Report must contain
What was built; the glue lines touched in `src/ui/index.ts` / `src/main.ts`; map numbers (stars, diamonds, tappable, sky build time, FRAME at four places on the iPhone); what was left to Agent 5; test status; known issues; suggestions labelled "suggestion".

## Allowed / not allowed
Allowed: `src/render`, `src/models.ts`, `src/planets.ts`, their html and test pages, `tests/` for render and the starfield, the small glue edits named above, docs. Not allowed: `src/universe`, `src/game`, `src/save`, `src/audio`, the other ui files (Agent 5), existing workflows, any decision above.

## Andy checks
1. `/planets.html` works again on the branch preview.
2. The map at the start: stars, diamonds, taps, 5 nearest, sky; then centre and rim.
3. Fly (or float) in two different systems: the sky pattern differs.
