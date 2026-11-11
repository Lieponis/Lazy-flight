# Agent 2 report, stage U1: fewer docks, bigger systems (universe version 2)

**Status: BUILT, universe tests pass. Pushed to branch `universe-v2`, NOT to `main`**, because the full check fails in other layers' tests (13 failures, section 4). Not yet verified by a real `npm run check` or by Actions (the Actions workflow only runs on `main`).

## 1. What was built (all in `src/universe`, plus `debug.html`, `src/debug.ts`)
- Systems now have 1 to 10 planets (`MAX_PLANETS = 10`). `UNIVERSE_VERSION = 2` is exported (lives in `settings.ts`).
- Not every planet has a dock. A system gets a random 1 to `maxDocksFor(planets)` docks, where `maxDocksFor = clamp(round(planets / 3.3), 1, 3)` (1-4 planets: 1; 5-8: 1 or 2; 9-10: 1 to 3). Which planets get them is chosen by the seed. Gas giants only get stations (as before). Dock id still equals planet id. Everything else about a dock is unchanged.
- New functions: `docksOf(seed, system)`, `getDocksOfSystem(seed, systemId)`, `dockPlanetIndexes(seed, system)`, `hasDock(seed, id)`, `maxDocksFor(n)`, and a survey helper (`surveySeed`, `summarizeSurveys`). `getDock` and `distanceBetweenDocks` now return `null` for a planet without a dock. Job candidates, destinations and tours use docks only. Random stream names are unchanged except one new stream, `"docks"`.
- Debug page `/debug.html`: dock count per system, planets with and without docks (no-dock planets greyed), a message when you click a planet without a dock, and a new section 5 that runs the survey over many seeds.
- Tests: `tests/universe.test.ts` adapted (29), new `tests/universe-v2.test.ts` (19). They cover determinism, order independence, dock count within 1..max for every planet count 1..10, gas giants only stations, unique valid dock ids, `getDock` null for non-dock planets, and jobs never starting or ending at a non-dock. A deliberate bug (one dock too many) was caught by them.

## 2. How to check it (Andy)
After the Lead says to commit: open `/debug.html`. Table 1 shows a "Docks" column (never more than the number in brackets). Click a system, then table 2 shows which planets have a dock and which do not. Seed `12345` then `999` then `12345` must give the same first system (Kopipex, 5 planets, docks on planets 1 and 3). Section 5, button "Run survey", shows the numbers below.

## 3. Live link
`https://lieponis.github.io/Lazy-flight/debug.html` (only after the branch is merged and Actions is green).

## 4. Known issues and what is NOT verified
- **No npm in my workspace**, so no real `npm run check`. I ran strict TypeScript on `src/universe` and `src/debug.ts`, and ran every test file with a small stand-in runner (it agrees with the real result on `main`, except 1 audio test that also fails there with the stand-in). 4 files need Three.js and could not run here: `assets`, `lens`, `planetlook`, `title`.
- **13 test failures in other layers (Agent 4 fixes in U2).** Cause 1: the start dock is "planet 0 of the start system", but in seed 12345 Kopipex the docks are planets 1 and 3, so planet 0 has no dock and its board is empty. Cause 2: the same seed now gives a different universe, so tests that assume specific jobs break.
  - `balance-sim.test.ts` (5): smoke test earns 0 money; "one job then spending never leaves you stuck"; three BUG 6b-2 tests (no takeable job). Cause 1.
  - `game.test.ts` (3): same board for same seed/dock/slot (empty board); full loop and speed-120 test ("no takeable job"). Cause 1.
  - `game4b.test.ts` (4): isStuck/emergencyRefuel; no buying in flight; old APIs; same board for same seed. Cause 1.
  - `game4c.test.ts` (1): outposts perks test, "Cargo too large: 40 units, bay holds 30". Cause 2.
- Code outside `src/universe` that still treats every planet as a dock (for U2/U3): `src/ui/index.ts` (start dock, line 54), `src/render/index.ts` (92, 186), `systemview.ts` (243), `flight.ts` (638), `docked.ts` (200), `src/ui/titlescene.ts` (67-77), `src/models.ts` (980), `src/game-debug.ts` (43, 129). Warning: `generateDock(seed, planet)` still works for ANY planet and does not check; use `docksOf` or `getDock`.
- Old saves with dock ids on non-dock planets fall back to the start dock in `src/save/autosave.ts`; the real migration is U2.

## 5. Numbers over seeds (v2 against the old v1 rules; 60 seeds, 11,813 systems within 35 ly of the origin, boards for the 1,298 docks within 15 ly, time slot 0)
| | v1 (old) | v2 (new) |
|---|---|---|
| Planets per system | 1-8, even | 1-10, about 10% each |
| Docks per system | = planets (avg 4.5) | 1: 66.7%, 2: 27.0%, 3: 6.3% (avg 1.4) |
| Outposts / stations | 44% / 56% | 44% / 56% |
| Docks with passenger terminal | 67% | 67% |
| Other docks within 25 ly (average / smallest) | 323 / 223 | 101 / 68 |
| Jobs per board (average / smallest) | 6 / 6 | 6 / 6 |
| Boards under 3 jobs | 0 | 0 |
| Tours: share of jobs / boards with one | 14% / 50% | 13% / 48% |

Two far regions (50 other seeds each) gave the same picture: reachable docks average 100, smallest 68 and 75, every board 6 jobs. Boards are NOT too thin, so `MAX_JOB_DISTANCE` stays 25. About 1 system in 3 has more than one dock, so same-system jobs are rare; single-dock systems always send jobs to other systems.

## 6. For the next agents
- Agent 4 (U2): start dock = first of `docksOf(seed, startSystem)`; job lists must use docks only; fix the 13 tests above; old-save migration per the plan. Outposts are as common as before per dock (44%) but there are about 3 times fewer docks, so check outpost availability and first-outpost time.
- Agents 3 and 5 (U3): a system has up to 10 planets and 1 to 3 docks; planets without a dock are scenery and must not be selectable as destinations.

## 7. Suggestions (not built)
- A `startDockOf(seed)` helper in `src/universe` so every layer picks the same start dock.
- A planet "has dock" flag on the `Planet` type, if the render layer wants it without calling `getDock`.
