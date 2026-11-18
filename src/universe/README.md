# src/universe

Pure game logic that builds the galaxy from a seed (systems, planets, docks, goods, prices, jobs, names). For Agent 2.

**Hard rule:** nothing in this folder may import Three.js or anything from `render`, `ui`, `game` or `save`. A test (`tests/layer-rule.test.ts`) checks this automatically.

**Universe version 3 (stage G3):** the old 10 ly cube grid is gone. The universe is the spiral galaxy: a flat disc, 100,000 light years across, about 18 billion systems, none stored. `WORLD_SEED = 12345` is the one shared universe.

## The layers
| File | What |
|---|---|
| `galaxy/` | where systems are: the density of the disc, the cells, which system numbers exist, the 9-symbol codes, the start point. Uses only `+ - * /` and `sqrt` to decide positions (`detmath.ts`), so every phone and browser makes the same galaxy. See `galaxy/README.md`. |
| `sites.ts` | LAYER 1: the address of a system (`id`, `position`), `getSite`, `nearestSites`, `sitesWithin`, `distance`, `parseSystemId`, `isLegacyId`. |
| `system.ts` | LAYER 2: name, code, star, number of planets (1 to 10). |
| `planet.ts` | LAYER 3: planets (type, colours, orbit, name `"<system> II"`). |
| `dock.ts` | LAYER 4: docks (1 to 3 per system): outposts and stations, goods made and wanted. |
| `economy.ts` | prices by time slot. Nothing in it depends on the place or on a "home" point. |
| `jobs.ts` | LAYER 5: job boards. Destinations are the **12 nearest other docks** (by count). |
| `lookup.ts` | find by id, nearest systems and docks, the start system and dock, find by name. |
| `near.ts` | `NearCache`: one answer per position, reused. |
| `purenames.ts`, `names.ts`, `data/` | pure names ("Lazy Harbour"), word lists, joke texts. |
| `survey.ts`, `namestats.ts` | counts for the debug page and the tests. |

## Ids (never search to turn an id back into its parts)
- **System id** = the system number: a plain whole number from 0 up to about 4.66e10 (safe in JSON and saves). Example `44776692551`.
- **Planet id** = `"<system number>/<planet number>"`, planet number 0 = closest to the star. Example `"44776692551/2"`.
- **Dock id** = the id of the planet it sits on (only planets that have a dock).
- **Job id** = `"<origin dock id>#<board period>#<offer number>"`.
- `parseSystemId`, `parsePlanetId` (= `parseDockId`), `planetIdOf`; `findSystemById`, `findPlanetById`, `findDockById` touch one slot only.
- **Old ids** (`"3:-2:5:0"`, `"3:-2:5:0/2"`, universe 1 and 2) never exist: every lookup answers `null`, `false` or `[]`, never an exception. `isLegacyId(id)` tells an old id from garbage (for the save migration).

## Names
- A system's full name is `"<word> <code>"` ("Bimvik Deep JR62R-MT37"), or a pure name ("Lazy Harbour") for about 6 % of the systems nearest to the start (all within about 200 ly of it). The code is 4 to 9 symbols (85 % have 9) from `galaxy/code.ts`, one-to-one with the system number. Each curated pure name has exactly ONE owner system (the name picks its system by a fixed rule in `purenames.ts`), so no name ever repeats.
- Planets: `"<system name> II"`, optional `nickname`. Docks: short `name` (unique in the system) and a universe-unique `fullName`.
- Longest names (tests): system 29, planet 34, dock full name 62 letters.

## The calls the game needs, and what they cost
Measured on the cloud machine (one core). The phone factor measured in the prototype: Andy's iPhone did the nearest 10,000 systems at the start in 5 ms against 26 ms on this machine (about 0.2 times), so these numbers are an upper bound for a modern iPhone; an older or low-end phone can be slower. Full table: `docs/report-agent-2e.md`.

| Call | Returns | Cost |
|---|---|---|
| `startSystem(seed)`, `startDockOf(seed)` | the system / first dock nearest to `START_POINT` | 40 ms the first time (builds the pure-name table), then under 1 ms |
| `findSystemById`, `findPlanetById`, `findDockById`, `getPlanets`, `getDocks` | one thing by id | about 0.01 to 0.1 ms |
| `nearestSites(seed, centre, count)` | ids, positions, distances, nearest first | 10,000 systems: 12 to 30 ms (centre to rim). 100: under 1 ms |
| `nearestSystems(seed, centre, count)` | the same as full systems (names, stars) | 10,000: 30 to 60 ms |
| `nearestDocks(seed, centre, count)` | dock ids, positions, distances, nearest first | 100 docks: 1 to 9 ms |
| `systemsWithin(seed, centre, radius)` | everything within a radius | **only for small radii** (a few ly at the centre: 25 ly there holds about 15,000 docks) |
| `getJobBoard(seed, dockId, slot)` | 6 jobs | about 0.5 ms, plus about 1 ms the first time for a dock (candidates are remembered) |
| `new NearCache(seed)` then `.sites / .systems / .docks(centre, count)` | the same lists, asked once per position | first call as above, the same position again: under 0.01 ms; a smaller count is the start of the remembered list |

Use `NearCache` for the map and the jobs: ask once per move, reuse until the player moves. `nearestSites` is much cheaper than `nearestSystems` (no names); the map needs only ids and positions until a system is tapped.

## Where it ends: the rim and outside the disc
Near the rim the nearest system is 70 to 270 ly away; `systemsWithin(…, 10)` there is simply `[]`. `nearestSites`/`nearestDocks` still fill up (the 100th dock can be 440 ly away). A point outside the disc works up to 200,000 ly from the nearest system; further away the lists are `[]`. `startSystem` always exists (its point is inside the disc).

## Jobs
`generateJobBoard(seed, dock, slot)` picks every destination (and every tour stop) from the `JOB_DESTINATION_COUNT` (12) nearest other docks of the origin dock's position (docks in the same system count, distance 0). There is no distance limit. Reward grows with the trip length (as before), the time limit gets `+1 hour per 10 ly` of the whole trip (`JOB_LIMIT_HOURS_PER_10_LY`). The game decides what it can reach (fuel, ship, 4 hour trip cap).

## Layer rules and style
Everything is computed from the seed plus the system number; nothing is stored. Each decision uses its own random stream (`rngFor(seed, "stream", …)`), so adding one never changes another. Names use their own streams. Tests: `tests/universe*.test.ts`, `tests/galaxy2*.test.ts`. Pages: `/debug.html` (universe), `/galaxy-debug.html` (the galaxy, with the checksum banner).
