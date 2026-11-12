# Agent 3 brief, stage G1: galaxy map without range circles; free travel reach = fuel on board

You are Agent 3 (Rendering). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/proposal-free-travel.md, docs/report-agent-3f.md, docs/report-agent-3g.md, docs/report-agent-4f.md (canFreeTravel), `src/render/starmap.ts` and `src/render/settings.ts`. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Anything visual: tell Andy before/after. Explain technical words in one sentence. Report: docs/report-agent-3h.md. Combat never. This is a SMALL change.

## Andy's decisions (2026-11-12)
- JOBS stay capped at 25 light years (MAX_JOB_DISTANCE in src/universe): do NOT change it.
- FREE TRAVEL (free flight) is limited only by the fuel on board. (The game rules already work that way: `canFreeTravel` uses fuel only; no 25 ly cap. Check and tell the Lead if you find any distance cap there.)
- Remove ALL range circles from the galaxy map (the three crossing "fuel range" rings drawn at `FUEL_RANGE_LY` in starmap.ts).

## Do
1. **Remove the rings** and the now-unused `FUEL_RANGE_LY` constant (and its comment) from the starmap. Remove the wrong text "in fuel range / out of fuel range" from the star label (it used the fixed 25): the label becomes name, star type and distance only. Real fuel numbers stay where they are (the planet card's FLY HERE button shows fuel needed and fuel left).
2. **Map reach:** the map shows only systems within `STARMAP_RADIUS_LY` (35) of the current system, so with a bigger tank some reachable stars could not be picked. Make the map radius follow what the current ship can really reach with the fuel it carries: the UI glue (`src/ui/index.ts`, smallest edit, say exactly what) passes a number `reachLy` = current fuel divided by the ship's fuel use per light year (the game has the real numbers, `tripFuelCost` or `canFreeTravel`; Agent 5/4 know), render stays free of game/ui imports (the layer rule test must keep passing). Use something like `max(35, reachLy + a little)` but with a hard cap you choose after measuring (stars on screen, triangles/points, time to list the systems on a phone), and tell the Lead the cap and the numbers. If a ship can reach farther than the cap, say so in a short in-map text ("farther stars are out of the map for now") rather than hiding silently.
3. The map must redraw its radius when fuel or ship changes (refuel, switch ship, after a trip).
4. Mark visually which stars you could actually reach? NO: Andy removed the circles; do not add a new range indicator. (Suggestion for later only, if Andy asks.)
5. Tests: the radius helper (pure function: fuel, ship, cap), the label text. `npm run check` green; Actions green.

## Allowed / not allowed
Allowed: src/render (starmap, settings, tests), the smallest glue in src/ui/index.ts / src/main.ts, docs. Not allowed: src/universe (jobs stay 25), src/game, src/save, menus, new features.

## Andy checks
1. Open the galaxy map: no circles anywhere.
2. Tap stars: the label shows name, star type, distance, no "fuel range" words.
3. Switch to the Scout (bigger tank) with full fuel: stars farther than before are on the map and you can open one and press FLY HERE on a planet; the button says whether you have the fuel.
4. Jobs still only offer destinations within 25 ly.
