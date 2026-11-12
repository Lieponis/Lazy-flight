# Report: Agent 3, stage 3h / G1 (galaxy map without range circles, map size follows fuel reach)

**Not run here:** `npm run check` and Three.js cannot run in my workspace. Proof = green Actions runs (both 3h runs green) + Andy's click-tests (all four checks "matches"). Offline: stand-in type check and `tests/starmapradius.test.ts` (11 tests, run in a stand-in runner; real Vitest ran on Actions).

## Built
- **Range circles removed** (the three crossing rings), with `FUEL_RANGE_LY` and `makeRing`. The star label is now name, star type and distance (`starLabelText`). The current system says "you are here" instead of a distance (no fuel words anywhere).
- **Map size follows reach.** `starmapRadius(reachLy)` (pure, `src/render/starmapradius.ts`): never below 35 ly, `ceil(reach + 3)` otherwise, never above the cap **`STARMAP_MAX_RADIUS_LY = 75`** (`settings.ts`). Camera zoom-out distance, the background stars and the far clip grow with the radius (`starmapCameraLimits`).
- **In-map note** when the ship reaches farther than the cap: the hint gets a third line "Farther stars are out of the map for now." (`starmapHint`, `reachBeyondMap`).
- **Redraw:** new `api.setReachLy(reachLy | null)`; the map is rebuilt only when its radius or the note changes (not on every fuel tick), also while the map is showing.
- **Testing aid** `?reach=NUMBER` (map size only; the game rules do not change).

## The cap: what I measured (seed 12345, from the start system, on a computer)
| radius | stars | triangles (8 per star) | time to list |
|---|---|---|---|
| 35 ly | 184 | about 1,500 | 8 ms |
| 60 ly | 998 | about 8,000 | 15 ms |
| **75 ly (cap)** | **1,970** | **about 15,800** | **16 ms** |
| 90 ly | 3,366 | about 26,900 | 20 ms |
| 110 ly | 6,102 | about 48,800 | 30 ms |
| 150 ly | 15,388 | about 123,000 | 83 ms |
Stars are ONE instanced draw call; a tap tests every star (2,000 at the cap is cheap). Full tanks reach: Hauler 30 ly, Liner 50, Scout 55 (2 fuel per ly); with upgrades a Scout can pass 100 ly, so 75 is a real cap there and the note appears. **Phone frame rate and phone listing time at 75 ly are NOT measured** (computer numbers above). Suggestion if a phone is slow: draw far stars with a cheaper 4-triangle shape or lower the cap to 60 (one number).

## Glue edited in `src/ui/index.ts` (smallest edit)
`reachNow()` = fuel divided by (`tripFuelCost(state, 100) / 100`), the real fuel one light year burns for the active ship (engine upgrades count); `api.setReachLy(reachNow())` is called once at start and in the existing `game.subscribe` callback next to `setCurrentSystem`. The comment about "starmap ring" was reworded. Nothing else. `src/game`, `src/universe`, `src/save` untouched; layer-rule tests pass (render imports no game or ui code).

## Free travel distance cap: checked
There is **none**. `checkFreeTravel` / `canFreeTravel` only refuse by fuel: "Too far for this ship's tank" (fuel needed above the tank), "Not enough fuel", and the strand reserve (fuel must remain for one hop to a dock). `MAX_JOB_DISTANCE` (25 ly) is used by jobs only. Trip time is capped at 4 h (`MAX_TRIP_SECONDS`), which is time, not distance (60 s per ly means about 240 ly).

## How to check
Live: https://lieponis.github.io/Lazy-flight/ . Map has no circles, labels have no fuel words. `?reach=60` shows a bigger map (`?reach=100` shows the "Farther stars" line, I did not see that line on a device). With the Scout and full fuel the map grows; FLY HERE on a planet there shows fuel needed and left; job boards stay within 25 ly. NOTE `?seed=` starts a NEW game.

## Phone checklist
Open the map with `?reach=75` on a phone: turn and pinch smoothly with about 2,000 stars; tap a far star and open it.

## Known issues / not verified
- Phone frame rate and rebuild time at 75 ly; the "Farther stars" line not seen on a device.
- The reach is fuel on board, so after a trip the map may shrink back (by design, rebuilds only when the radius changes). The map recentres on the current system when it rebuilds (selection is cleared).
- Suggestions (not built): a cheaper star shape for far stars; remember zoom between map visits.
