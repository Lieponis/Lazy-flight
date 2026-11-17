# Agent 2, stage G3: universe version 3 (the spiral galaxy is the real universe)

Branch `universe-v3` (from `main` at 6ad2bb5 plus `galaxy-proto`). **Nothing is merged into main.** Written for the Lead, Agent 3, Agent 4 and Agent 5.

## 1. What was built
- The old 10 ly cube grid is gone. `src/universe` now builds the spiral galaxy (about 17.9 billion systems, nothing stored). The galaxy code moved from `src/galaxy2` to `src/universe/galaxy/` (same maths, same pinned checksums: `d0019075` for the 2,000 nearest systems at the start, unchanged; the galaxy did not change at all).
- Removed: `galaxy.ts` (sectors, `getSite` by cube, `listSitesNear`, `systemIdOf`, old `parseSystemId`), old `syscode.ts`, `SECTOR_SIZE`, `MAX_JOB_DISTANCE`, `PURE_NAME_REGION`, `listSystemsNear`.
- New or changed: `sites.ts` (layer 1: address of a system), `system.ts`, `planet.ts`, `dock.ts` (ids and names on the new numbers), `purenames.ts` (owner rule inside a box of about 150 ly around the start), `lookup.ts` (find by id, nearest systems and docks, start system and dock, find by name), `near.ts` (`NearCache`), `jobs.ts` (destinations by count), `survey.ts`, `namestats.ts`, `settings.ts` (`UNIVERSE_VERSION = 3`, new constants), `index.ts`, `README.md` (calls and costs), `/debug.html` (+ `src/debug.ts`), `/galaxy-debug.html` (+ `src/galaxy-debug.ts`, checksum banner kept; `galaxy-debug.html` is already in the offline app's developer-pages list).
- Economy is unchanged and never depended on the grid or on a "home" point (prices come from the dock id, good id and time slot only). Docks per system: rule kept (1 to 3, see section 6).
- Tests: `tests/universe.test.ts` (29), `universe-v2.test.ts` (22), `universe-names.test.ts` (26), **new `universe-v3.test.ts` (34)**, `galaxy2.test.ts` (25), `galaxy2-sky.test.ts` (6). All 142 are green (stand-in runner, see 9). The whole universe and galaxy test set runs in about 8 s here.

## 2. The public API (`import … from "../universe"`)
Costs are on the cloud machine (one core). Andy's iPhone did the nearest 10,000 systems at the start in 5 ms against 26 ms on the cloud machine in the prototype (factor about 0.2), so a modern iPhone should be **at or below** these numbers (nearest 10,000 sites about 2 to 5 ms, full systems about 5 to 11 ms); an older phone may be slower. The page `/galaxy-debug.html` times the real device.

| Call | Returns | Cost (cloud) |
|---|---|---|
| `startSystem(seed)` / `startDockOf(seed)` | the system nearest to `START_POINT` (first dock of it) | 40 to 65 ms the first call (builds the pure-name table for the seed), then 0.07 ms |
| `findSystemById(seed, id)` (= `getSystem`) | `StarSystem \| null`; touches one slot | 0.02 ms |
| `findPlanetById` (= `getPlanet`), `findDockById` (= `getDock`), `hasDock` | one planet / dock / boolean by id | 0.02 to 0.1 ms |
| `getPlanets(seed, systemId)` (= `getPlanetsOfSystem`), `getDocks(seed, systemId)` (= `getDocksOfSystem`) | all planets / docks of a system | 0.01 to 0.04 ms |
| `nearestSites(seed, centre, count)` | `{id, position, distance}[]`, nearest first (equal distance: smaller number first) | 10,000: 9 ms (centre), 15 ms (start), 11 ms (middle), 23 ms (rim). 100: under 1 ms |
| `nearestSystems(seed, centre, count)` | `{system: StarSystem, distance}[]` | 10,000: 27 / 37 / 44 / 55 ms |
| `nearestDocks(seed, centre, count)` | `NearDock {dockId, systemId, planetIndex, position, distance}[]`, nearest first | 100 docks: 0.5 to 1 ms |
| `systemsWithin(seed, centre, radius)`, `sitesWithin` | everything within a radius, nearest first | **only small radii**: 25 ly at the start about 20 ms; 80 ly at the centre holds 363,000 systems and takes 0.24 s; never use a big radius in the middle |
| `generateJobBoard(seed, dock, slot)`, `getJobBoard(seed, dockId, slot)` | 6 jobs | 0.5 to 2 ms the first time for a dock, then 0.1 to 0.2 ms |
| `new NearCache(seed, maxPositions = 4)` with `.sites / .systems / .docks(centre, count)`, `.clear()` | the same lists, asked once per position; a smaller count is the start of the remembered list; a bigger count works out again | the same position again: under 0.01 ms |
| `distanceBetweenSystems`, `distanceBetweenDocks` | light years, `null` if either does not exist | 0.05 ms |
| `findSystemByName(seed, text)` | full name, code (hyphen and capitals optional) or pure name | 0.05 ms |
| `parseSystemId`, `parsePlanetId` (= `parseDockId`), `planetIdOf`, `isLegacyId` | id helpers | trivial |

Also exported: `START_POINT`, `START_ANGLE`, `DISC_RADIUS`, `densityAt`, `lineIntegralDensity`, `expectedTotal`, `galaxyChecksum`, `encodeSystemNumber`, `decodeSystemNumber`, `JOB_DESTINATION_COUNT`, `UNIVERSE_VERSION`, and the raw generators `generateSystem`, `generatePlanet(s)`, `generateDock`, `docksOf`, `dockPlanetIndexes`, `getMarket`, `getPrice`.

**Start rule:** the nearest system to `START_POINT` (-16559, 0, 1892, the inner edge of an arm, spacing 8.0 ly) with at least one dock (every system has 1 to 3, so it is simply the nearest system; an exact tie would be settled by the smaller system number). Its first dock (smallest planet number) is the start dock. For the world seed: system **Bimvik Deep JR62R-MT37**, number 44776692551, dock `44776692551/2` ("Breezy Hill Outpost, Bimvik Deep JR62R-MT37 III"). The same point and rule apply to every other seed.

## 3. Id formats
- **System id** = the system number, a plain whole number (0 up to about 4.66e10, safe in JSON). `StarSystem.id`, `Planet.systemId`, `Dock.systemId` are **numbers now** (they were strings).
- **Planet id** = `"<system number>/<planet number>"`, e.g. `"44776692551/2"`. **Dock id** = the id of its planet. **Job id** = `"<dock id>#<period>#<offer>"`.
- `parseSystemId(x)`: a safe whole number or digit-only text gives the number; anything else `null`. `parsePlanetId("a/b")` gives `{systemId, planetIndex}` or `null`. No searching, no lookups.
- `findSystemById / findPlanetById / findDockById` accept `unknown` (so old saves cannot crash them) and touch one slot only.
- **Old ids** (`"3:-2:5:0"`, `"3:-2:5:0/2"`): every lookup returns `null`, `false`, `[]` (tested for all of `getSystem, getSite, getPlanet, getDock, hasDock, getJobBoard, getDocks, getPlanets, distanceBetween*, findSystemByName`). `isLegacyId(id)` is `true` for exactly that old shape (so Agent 4 can tell "old save" from "garbage").

## 4. What each function returns at the rim and outside
Rim (49,000 ly out, in the plane): nearest system 71 ly away; the nearest 10,000 systems reach 4,300 ly; 100 docks reach 438 ly. Tests cover all of this.
- `nearestSites / nearestSystems / nearestDocks`: always fill up (never fewer than asked unless the galaxy is empty around). They never return `null`.
- `systemsWithin / sitesWithin` with a small radius: `[]`. No error.
- `startSystem / startDockOf`: not affected (the start point is inside the disc).
- `getJobBoard` for a dock near the rim: full board (6 jobs); trips are long (see table); never empty, never `NaN`.
- A point outside the disc (60,000 ly from the centre): works, the nearest system is 10,000 ly away. More than 200,000 ly from every system: `[]` from every nearest call, no endless loop.
- `null` start dock cannot happen.

## 5. Job boards (the rule and the table)
**Rule:** an origin dock's destinations (and every tour stop) are chosen from the **12 nearest other docks** (`JOB_DESTINATION_COUNT`) of its position, sorted by distance. Docks in the same system count (distance 0). No distance limit; `MAX_JOB_DISTANCE` (25 ly) is gone and replaced by this count. 6 jobs per board (`JOBS_PER_BOARD`), refresh every 6 hours (unchanged). Candidates are remembered per dock. **Reward** grows with trip length exactly as before (trade: `amount x price x 0.25 + distance x amount x 0.6 + 30`; passengers: `amount x (15 + distance x 6) + 20`, tours x1.3 per extra stop). **Time limit** (40 % of jobs have one): random 12 to 48 hours **plus 1 hour per 10 ly of the whole trip** (`JOB_LIMIT_HOURS_PER_10_LY`; tours +24). Same funny blurbs.

Boards of the 24 nearest docks of each place, at slots 0 and 6 (48 boards each):

| place | jobs per board | nearest destination (ly) | farthest of the 12 (ly) | trip length (ly) | reward (credits) | time limits (h) |
|---|---|---|---|---|---|---|
| centre | 6 (min 6) | 0.0 to 1.6 | 1.8 to 2.9 | 0.0 to 9.5 | 45 to 2,353 | 13 to 73 |
| start | 6 (min 6) | 0.0 to 5.3 | 8.4 to 12.2 | 0.0 to 34.8 | 62 to 4,306 | 13 to 73 |
| middle (30,000 ly) | 6 (min 6) | 0.0 to 23.4 | 23.2 to 34.4 | 0.0 to 135.6 | 44 to 12,059 | 15 to 79 |
| rim (49,000 ly) | 6 (min 6) | 0.0 to 132.7 | 163.3 to 242.6 | 0.0 to 646.5 | 90 to 68,566 | 25 to 132 |

A trip length of 0 means a destination dock in the same system. At the start the 12 nearest other docks are 5 to 12 ly away (the start dock's system has only one dock).
**Note for Agent 4 (balance):** reward is linear in distance, so rim jobs pay up to 15 times what the same job pays at the start, and a 646 ly tour needs fuel and a ship that do not exist yet. The game must decide the reach (fuel, 4 hour cap) and probably cap or flatten the reward at long range. The universe does not.

## 6. Docks per system (rule kept: 1 to 3, average 1.4, `maxDocksFor`)
Measured on the nearest 3,000 systems of each place:

| place | docks per system | systems with 1 / 2 / 3 docks | docks within 25 ly | nearest dock | 100th nearest dock |
|---|---|---|---|---|---|
| centre | 1.401 | 67 / 27 / 7 % | 15,553 | 0.8 ly | 4.7 ly |
| start | 1.397 | 67 / 26 / 7 % | 172 | 3.0 ly | 21.3 ly |
| middle | 1.392 | 67 / 27 / 6 % | 8 | 17.1 ly | 60.0 ly |
| rim | 1.402 | 66 / 27 / 6 % | 0 | 71.3 ly | 437.7 ly |

No problem found, so the rule is unchanged. At the start there are 172 docks within 25 ly, in the middle only 8, at the centre 15,553 (absurdly many; this is why the game must only ask "nearest N" there).

## 7. Names and lengths
- System `"<word> <code>"` e.g. "Bimvik Deep JR62R-MT37" (code 4 to 9 symbols, 85 % have 9, hyphen in the middle), or a pure name e.g. "Lazy Harbour", "Cheery Burrow", "Bouncy Compass". Planets `"<system> II"`. Docks short name + `fullName`.
- Pure names: 4,200 curated names, all found an owner; all owners within 300 ly of the start; **6.0 % of the nearest 5,000 systems and 6.6 % of the nearest 20,000** carry one. Pure-name region is `PURE_REGION = 150` in `galaxy/params.ts`. The owner assignment uses the stream `purename` (so pure names moved compared to the G1 prototype; not pinned anywhere).
- Longest names (constants, enforced by a test): system **29**, planet **34**, dock full name **62** letters. Longest seen in 20,000 systems near the start: system 29 ("Snugaploo Junction HH8H3-2526"), planet 33 ("Wibfugus Junction 5RJ68-4TV8 VIII"), dock 59 ("Rattling Biscuit Station, Bimlithus Junction N2M5P-9RJ6 III").
- Uniqueness: **0 repeated names** in 20,000 systems near the start (and their planets and docks, 3 seeds, in tests); 10,130,925 systems from random cells: 10,130,925 different numbers and codes, 0 codes that do not decode (`scripts/galaxy2-bench.ts`, 65 s; the script was updated only to import names from `src/universe`); 60,000 nearest systems: 0 repeated full names.

## 8. Fingerprints (UNIVERSE_VERSION 3)
`tests/universe-v3.test.ts` pins one number per seed for the 60 nearest systems to the start, **including names**, planets, docks, markets (slot 3) and job boards (slot 3): seed 12345 `a8bc7ccf:483603`, seed 777 `feb0754:516159`, seed 4242 `de7480c9:496937`. (The old names-stripped fingerprint in `tests/planetlook.test.ts` is superseded; see section 9.) Not stripped of names because in v3 everything is new anyway.

## 9. What fails now, outside the universe layer (the work list for Agent 4, 3 and 5)
Status of tests run with the stand-in runner here (Vitest and Three.js are not installed in my workspace, so test files that need `three` cannot run here **on either branch**: `assets, earthlike, floatpick, lens, planetlook, title` plus half of `release`; `audio-session` needs Vitest `afterEach`; `audio` has 1 failure and `save-transfer` 1 failure that main also had). Actions on the branch will show the real list. Errors seen by the type checker (new compared with main) and by running the tests:

| File | Reason |
|---|---|
| `src/game/game.ts` (5 type errors) | uses `listSystemsNear`; ids are strings in `GameState`, `OwnedOutpost`, jobs; system ids now numbers |
| `src/game-debug.ts`, `src/models.ts`, `src/planets.ts` | import `listSystemsNear` (planets.html uses it to build the wall: radius 40 ly around the origin would now be 11,000 systems; use `nearestSystems(seed, START_POINT, 40)`) |
| `src/render/index.ts` (6), `starmap.ts` (3), `start.ts`, `systemview.ts`, `flight.ts` | `listSystemsNear`; `system.id` is a number; the starmap asks "within a radius" |
| `src/save/*`, `src/ui/*` | no compile errors from my change (ids are strings there), but every stored id is now invalid (section 10) |
| tests that import `listSystemsNear` and so stop at import time | `agent6c, audio, balance-sim (and tests/sim/*), game, game4b, game4c, game4d, game4e, game4f, game4g, pwa, release, render-helpers, save, save-transfer, ui, ui-names, ui-savefile, world-seed, planetlook` (the last also holds the old names-stripped fingerprint block, which cannot hold in v3: replace it with the one in `universe-v3.test.ts`) |
| `tests/balance-sim.test.ts` | uses the old universe API; it timed out before, do not rely on it; it needs Agent 4's new rules (reach, fuel) |

I did not touch any of these (not on my allowed list). `tests/layer-rule.test.ts` is green (`src/universe` imports nothing from other layers). `/planets.html` **breaks** (it calls `listSystemsNear`); the fix is one line on the render side (Agent 3, G5) and the look hash needs nothing else: planet ids are `"<number>/<index>"`, still plain strings, every look changes.

**Actions on the branch (run 44068807130, "Check a branch"): red as expected.** `npm run check` stops at the type check with 26 errors, ALL outside the universe layer (`src/game-debug.ts` 3, `src/game/game.ts` 5, `src/models.ts` 1, `src/planets.ts` 1, `src/render/flight.ts` 1, `src/render/index.ts` 11, `src/render/starmap.ts` 3, `src/render/start.ts` 1, `src/render/systemview.ts` 1; reasons in the table above). There is no error in `src/universe`, `src/debug.ts`, `src/galaxy-debug.ts` or my tests. Because the build stops first, the real Vitest run of my tests did not happen on Actions; I ran all six test files with the stand-in runner (142 tests, green) and they are written for Vitest the same way as the old ones. The first green Actions run will come when Agent 4 and Agent 3 have fixed the files above.

## 10. Migration facts for Agent 4 (UNIVERSE_VERSION 3)
An old save (version 1 or 2) holds ids that no longer exist. `isLegacyId` is true for each of these shapes:
- `currentDockId` (`"3:-2:5:0/2"`) and `spacePlanetId`: invalid. Move the player to `startDockOf(WORLD_SEED).id`.
- `currentJob`: its `originDockId`, `destinationDockId`, `stops`, and `id` are old ids; the job has to be cancelled (it cannot be delivered). Decide a refund rule (the earlier "move + refund" rule: credits, ranks, ships, upgrades, liveries kept).
- `freeTrip` (`fromId`, `toId`): invalid, cancel.
- `ownedOutposts`, `outpostPrices` (keys are dock ids), `outpostCount`: invalid; refund what was paid (`outpostPrices`) and clear. Passive income stops.
- `explored` (keys are system ids): invalid, clear.
- `deliveredJobIds`: harmless but useless, clear.
- Discoveries: the same as `explored`.
- Kept as they are: `credits`, `fuel`, `shipId`, `ownedShips`, `shipUpgrades`, `shipLiveries`, `completedJobs`, ranks, times.
- Store `UNIVERSE_VERSION` (3) in the save so the next change can be recognised. System ids are now numbers: `explored` keys will be strings of digits in JSON (`"44776692551"`), `parseSystemId` accepts both.
- The "tripSeconds" cap (4 hours) and `TRAVEL_SECONDS_PER_LY` are untouched; trips of 100 to 600 ly exist now.

## 11. Speed (cloud machine; the iPhone should be at or below, see section 2)
| place | startSystem (first) | nearest 10,000 sites | nearest 10,000 full systems | nearest 100 docks | planets of a system | job board (first / next) | NearCache, same position |
|---|---|---|---|---|---|---|---|
| centre | 65 ms (one time) | 9 ms | 27 ms | 0.8 ms | 0.034 ms | 2.0 / 0.2 ms | 0.001 ms |
| start | (same) | 15 ms | 37 ms | 1.0 ms | 0.015 ms | 0.6 / 0.1 ms | 0.000 ms |
| middle | (same) | 11 ms | 44 ms | 1.0 ms | 0.035 ms | 0.5 / 0.1 ms | 0.000 ms |
| rim | (same) | 23 ms | 55 ms | 0.5 ms | 0.024 ms | 0.9 / 0.1 ms | 0.000 ms |

Estimate for Andy's iPhone with the prototype's factor (0.2 of the cloud time): `startSystem` about 15 ms once, nearest 10,000 sites 2 to 5 ms, full systems 6 to 11 ms, nearest 100 docks under 1 ms, a job board under 1 ms. Unverified on the phone for the new code; the pages' own numbers can be read on the phone. `tests/balance-sim.test.ts`: cannot run on this branch (old API); it timed out before (5.7 s against a 5 s limit), the limit was raised to 30 s in N1; do not rely on it.

## 12. Debug pages
- `/debug.html` rebuilt: a place chooser (start, centre, middle, rim) and "how many nearest systems" instead of a radius; tables for systems, one system, one dock, one job board (with the nearest and farthest possible destination), find by code or name (also pure names), name statistics (pure share, longest names, collisions counter must be 0), a many-seeds survey (10 seeds in 1.4 s; docks per system, nearest and farthest destination distance, boards under 3 jobs). Checked in a real browser (desktop and phone width): no errors at start, centre, middle and rim.
- `/galaxy-debug.html`: the checksum banner is green on the moved code (`d0019075`).
- Private copies for Andy: universe debug page https://claude.ai/artifact/5GVVtbEHgNkaaQeDiYmLAM, galaxy page https://claude.ai/artifact/2UVw93qVL85Chg3uWumeui (the branch is not published, so these are artifacts).

## 13. Open risks
- **Rim policy is still open** (view-only edge or a late long-range ship). Nothing crashes there; but jobs there pay up to 68,566 credits and need 600 ly trips (section 5).
- **Trips at the start are short** (12 destinations within 5 to 12 ly, trips of 5 to 35 ly) and rewards small compared with the rim: the economy needs a balance pass (Agent 4 and Agent 6).
- **Only the V8 engine tested** (Chrome, Node). Andy's iPhone gave the same checksum for the galaxy, so the positions are identical; names and jobs use ordinary integer maths and `Math.sqrt`, they were not compared on a phone. Suggest: Andy opens the debug page on the iPhone and reads the name of the start system ("Bimvik Deep JR62R-MT37") and the first job's reward on the start dock board (230 credits for "33 x Moon Biscuits to Polite Sprocket Station").
- **A word list cap:** system words come from the old lists; pure names are 4,200. Nothing has been extended.
- Changing any number in `galaxy/params.ts` or `density.ts` moves every system number (the pinned checksums catch it). Changing `settings.ts` dock or planet rules, or any random stream name, changes everything above it (the new fingerprints catch it).
- The pure-name table costs 40 ms once per seed; it is created at the first name lookup (usually `startSystem`). On a slow phone that is the first "hiccup".

## 14. Suggestions (labelled, not done)
- **suggestion:** cap or flatten the job reward with distance in the game layer (for example reward grows with the square root of the distance beyond 50 ly).
- **suggestion:** the starmap should call `NearCache.sites(position, 10000)` once per move and tap-pick on its own array; only call `nearestSystems` for the tapped system (names are the expensive part).
- **suggestion:** show the code only (`JR62R-MT37`) in tight UI places; the 29 letter name is long for a phone strip.
- **suggestion:** make a distance-aware "closest system with a dock" for the rim player (the nearest docks can be 71 ly away): `nearestDocks(seed, position, 1)` already does it.
