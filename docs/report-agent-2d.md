# Agent 2 report, stage G1: galaxy generator PROTOTYPE (spiral disc, about 18 billion systems)

**Status: BUILT, tested, measured. Branch `galaxy-proto` (never merged into main).** Recommendation at the end: **GO** for the generator, with conditions. Not verified: speed on a real phone, and other browsers than Chrome's engine (section 7).

## 1. The scheme in plain words
- **Shape.** Flat disc in the x-z plane, radius 50,000 ly, centre (0,0,0). Average spacing between neighbours in the disc plane: `s(r) = 1.8 ly x (160/1.8)^(r/50,000)`, so 1.8 ly at the centre and 160 ly at the rim. Thickness 2,000 ly at the centre falling smoothly to 500 ly at the rim; full density in the middle of the thickness, smooth fall to zero at the top and bottom. **4 log-spiral arms** (pitch about 15 degrees): density = average x (1 + 0.75 x cos(...)), so 1.75 times the average inside an arm and 0.25 times between arms; the average over a full circle is exactly 1, so the spacing curve stays true. Arms fade in between 1,500 and 5,000 ly (the middle is a round bulge).
- **Cells (hard issue 1).** Polar cells. The disc is cut into **3,829 thin rings**; a ring is as wide as a cell is, and a cell is about 1.6 times the local spacing (so rings are 3 ly wide in the centre and 150 to 250 ly wide at the rim). Each ring is cut into equal **sectors** (pizza slices) and equal **layers** (bottom to top), so cells are roughly cubes. Every point of the disc is in exactly one cell: no gaps, no overlaps, no double counting, also at ring edges and at the angle 0 / 2 pi seam (tested). 5.8 billion cells, nothing stored (the ring table is computed in 14 ms).
- **What is in a cell.** Each cell has 2 x 2 x 2 = 8 **slots**. A slot MAY hold one system: a hash of (seed, system number) gives its place inside the slot's little box (a "jittered grid", so no visible grid, see the picture in section 5 of the page) and a coin toss with chance `density x cell volume / 8`. So the expected number of systems anywhere equals the integral of the density, and no cell ever needs counting first. 3% of systems are "odd" (decided by their hash): half are **twins** (placed 0.1 to 0.3 of a slot from where the next slot would put its system, so very close pairs; closest pair seen 0.7 ly), half are **wanderers** (anywhere in the cell). Odd ones always stay inside their own cell, which keeps ids and queries exact.
- **Ids (hard issue 2).** System number = `cell number x 8 + slot`. Cell numbers run ring by ring from the centre, so the number turns back into (ring, sector, layer, slot) by one binary search over 3,829 numbers: `findSystemById` touches one slot, never searches cells. Numbers go up to 4.66e10 (safe in a JavaScript number and in a save file).
- **Codes.** The number is scrambled one-to-one into letters from the 17-symbol alphabet of today (`2-9 D H J M N P R T V`: no vowels, no look-alikes). Length grows with the number (4 symbols for the first 83,521 numbers, then +1 symbol per 17 times more). `decodeSystemNumber(code)` goes back. Names are as today: "Word CODE" (word from today's generator, code makes it unique), and a few **pure names** (today's 4,200 curated names) each with ONE owner system chosen by the name (tries inside a box of 150 ly around the start); a system has a pure name only if it owns one.
- **Exact repeat everywhere.** `Math.exp/log/sin/cos` can differ in the last digit between devices; anything that decides where a system is or whether it exists uses only + - * / and sqrt (`detmath.ts`, agrees with Math.* to 1e-12 in a test). A pinned checksum test and a checksum line on the debug page let you compare devices.

## 2. Queries (all in `src/galaxy2`, signatures as in the brief)
`nearestSystems(seed, center, count)` (up to 60,000 tested), `systemsWithin(seed, center, radius)`, `findSystemById(seed, id)`, `densityAt(point)`, `expectedCountIn(min, max, samples)`, `expectedTotal()`, **`lineIntegralDensity(origin, direction, maxDistance, steps)`**, `systemsOfCell`, `countInCell`, `encodeSystemNumber/decodeSystemNumber`, `systemName`, `START_POINT`. A runaway query (huge radius at the centre) stops with `TooManyCellsError` (default 20 million cells) instead of freezing.

### lineIntegralDensity (the one Andy added)
It adds up the density along a straight line of sight: from `origin`, along `direction` (any length), for `maxDistance` ly, at `steps` evenly spaced points; result = systems per square light year ("column density"). It never lists a star. Why it is the right thing for the sky: a star's light falls with distance squared and the number of stars in a narrow cone grows with distance squared, so the unresolved starlight in a direction is proportional to this sum. Tests: through the middle of the centre it equals density x 0.75 x thickness (1 % tolerance); direction length does not matter; two halves of a ray add up to the whole; zero for no line / outside the disc; looking along the disc is more than 5 times brighter than looking up out of it, and from the rim looking inward is more than 10 times brighter than looking outward; and it agrees within 10 % with really counting systems in a thin tube (`tests/galaxy2-sky.test.ts`, 6 tests). Cost: a 6 x 32 x 32 sky cube (6,144 rays x 128 steps) takes about 60 ms here (10 microseconds per ray); once per arrival is fine, even on a phone. Page section 6 draws an all-round sky from five places so you can see it change.
- **Advice on the faint fake stars (`skyStarsInDirection`).** Do them on the render side (Agent 3): they are not real systems, so they need no galaxy data; seed them from the hash of the position (rounded to a coarse cell) so each place has its own pattern, and scale how many appear per direction from the column density above. The generator only provides the density.
- Limits: uniform steps. Use about 1 step per 100 ly near the centre; a ray from outside through the 3,000 ly bulge with 96 steps over 70,000 ly gets only 4 samples across it (the page's sky view does this and still looks fine). If Agent 3 needs more precision, split a ray in 2 or 3 pieces with different step sizes (the side view on the page does that).

## 3. The numbers (cloud machine, Node 22; a phone is usually 3 to 6 times slower)
| | value |
|---|---|
| **Total systems, by integration** | **17.88 billion** (17,878,315,439) |
| Total by sampling 400,000 random cells | 17.86 billion; difference -0.11 %, one standard error 0.12 % |
| Average systems per cell | 3.07 (cells: 5.83 billion; slots: 46.6 billion numbers) |
| Cell table build | 14 ms (once); pure-name owners: 60 ms (once) |
| Cost per system | 1.4 microseconds (radius 150 around the start), 3.9 microseconds per cell |

**Spacing (ly).** Formula = average in the disc plane. Measured = mean distance from a system to its nearest neighbour (stratified placement makes this about 0.7 of the spacing instead of 0.55 for pure random).
| Distance from centre | formula s(r) | arm centre | between arms | measured nearest neighbour | thickness |
|---|---|---|---|---|---|
| 0 | 1.80 | 1.80 | 1.80 | 1.07 | 2,000 |
| 1,000 | 1.97 | 1.97 | 1.97 | 1.22 | 1,941 |
| 5,000 | 2.82 | 2.34 | 4.48 | 1.48 | 1,715 |
| 16,667 (start) | 8.03 | 6.67 | 12.75 | 4.08 | 1,167 |
| 30,000 | 26.6 | 22.1 | 42.2 | 14.1 | 740 |
| 50,000 | 160 | 127 | 243 | 81.6 | 500 |

**Start.** One third out (16,667 ly), **on the inner edge of a spiral arm** (arm factor exactly 1.0, so spacing is the plain curve value, **8.0 ly**; the brief asked for 8 to 9). In the very middle of the arm, 6,500 ly further round the circle, the spacing would be 6.7 ly; I kept the edge because it matches today's 9.7 ly best. Point (-16,559, 0, 1,892). Nearest system: id 44776692551, "Tukboo JR62R-MT37". Systems within 25 ly: 126; within 75 ly: 3,349; the nearest 10,000 reach 107.7 ly.

**Timings** (ms, median of five; first run is within 10 % to 2 times of it):
| Where | nearest 1,000 | nearest 10,000 | nearest 60,000 | within 80 ly |
|---|---|---|---|---|
| centre | 1.7 | 10.8 | 105 | 276 (363,193 systems) |
| start region | 2.4 | **26** | 151 | 5.8 (4,085) |
| middle, 30,000 ly | 1.5 | 13 | 152 | 0.3 (181) |
| rim, 49,000 ly | 3.5 | 28 | 206 | 0.1 (1) |
Target (nearest 10,000 at the start under 100 ms): **met, 26 ms** (about 80 to 160 ms on a phone if the factor is 3 to 6). 60,000 is possible (150 ms here, 0.5 to 0.9 s on a phone) but should be chunked or avoided; 10,000 is the real need. Memory: results are plain objects (about 100 bytes each), 10,000 is 1 MB; no query builds big arrays beyond its result. "Everything within 80 ly" at the centre is 363,000 systems: the game must ask by count (nearest N), never by radius there.

**Code lengths** (symbols, without the hyphen): centre 4; 1,000 ly 8; 5,000 ly and everywhere further 9. Share of all systems: 6 symbols 0.1 %, 7: 0.8 %, 8: 14 %, **9: 85 %**. The brief expected 7 to 9: yes. Full names are "Word CODE": at most 18 + 1 + 10 = 29 letters (today: 24 near the start). A planet name adds " VIII" (5), a dock full name about 26 + 2 + 34 = 62 at most.
**Pure names** (hard issue 2): all 4,200 names found an owner within 150 ly of the start; 6.4 % of the nearest 5,000 systems carry one (the share falls quickly further out; none beyond about 200 ly). Region size is a setting (`PURE_REGION`).

## 4. Uniqueness and determinism (tests and bench)
- **10,130,925 systems** from 3.3 million random cells (all rings): **10,130,925 different ids, 10,130,925 different codes, 0 codes that do not decode back.** 60,000 nearest systems at the start: 0 repeated full names. Codes: 80,000 random numbers incl. 0, 83,520, 83,521 and the largest: round trip OK, all unique.
- Every system lies inside its own cell (checked for random cells and for the first and last sector and layer of many rings). `findSystemById(id)` returns the same system as the cell listing. Free slots and bad numbers give null.
- `systemsWithin` equals a slow search over every cell of every ring in range (centre, start, rim, on the angle 0 line, near the top of the disc). Two overlapping queries from different centres agree exactly on the overlap; no system is ever listed twice. `nearestSystems` equals the nearest of a bigger radius query.
- Same seed twice and in a different query order: identical. A different seed: different systems, same structure, same count within 35 % in a small sphere (random variation).
- Checksums of the nearest systems are pinned (`d0019075` for the 2,000 nearest to the start). Open the page on a phone and in another browser and compare (page, "The numbers").

## 5. Tests (31, about 3 seconds)
`tests/galaxy2.test.ts` (25) and `tests/galaxy2-sky.test.ts` (6). Also `scripts/galaxy2-bench.ts` prints the numbers above (about 2 minutes).

## 6. The page
`/galaxy-debug.html` (online only, in the vite build and in the offline app's "developer pages" list; one word added to `scripts/pwa/lib.mjs`). It has: the facts, the whole disc from above (the arms and bulge are clear), the side view (height stretched 12 times), the spacing table, the systems near the start (adjustable radius), the sky from five places (via `lineIntegralDensity`), find-by-code, and a timing table that runs on the device that opens it. **Because the branch is never merged, the page is not published on the live site.** A self-contained copy (same code) is attached to this task as a private artifact; screenshots are in the reply to Andy.

## 7. NOT verified, risks
- **Phone speed is an estimate** (factor 3 to 6 on the cloud numbers). The page's timing button measures it on the real device; please press it on a phone.
- **Other JavaScript engines (Safari, Firefox):** the maths is built to be identical everywhere and tested against Math.* here, but I could only run the engine used here. The checksum on the page is the proof to run on an iPhone.
- **Pure-name and word lists are today's**; they were not extended.
- **The game-side problems are not touched** (Lead's list in docs/feasibility-galaxy.md section 3): at the rim the nearest system is 80 to 250 ly away (no ship reaches it); "within a radius" queries are useless there and explode at the centre; the 20,000-system explored cap; docks per system; fuel and range.
- Arms are a single simple model (4 equal log spirals, same strength at every radius beyond the bulge). More arm detail (branches, a bar) is possible later; it only changes `density.ts` (and then the cell table).
- Any change to a setting in `params.ts` or to `density.ts` changes the galaxy (all ids). The pinned checksums will catch it.

## 8. Recommendation: GO (generator), with these conditions
1. Press the timing button on a real phone and compare the checksum on an iPhone (5 minutes), together with the map prototype G2.
2. Keep all game queries "nearest N by count" (N up to 10,000) and cache the result; never "within radius" in the crowded centre.
3. Andy's choice, not mine: start on the edge of an arm (8.0 ly, as built) or in the arm middle (6.7 ly, 3,300 vs about 6,000 systems within 75 ly); the rim (reachable or view-only).
Options if the phone is too slow: lower the map count to 5,000; or make cells bigger (setting `CELL_SCALE`, fewer cells but more candidates per cell); or move the query to a Web Worker.

## 9. What must change in the existing game when this becomes universe v3 (short list by layer)
- **universe:** ids become numbers (`"sx:sy:sz:i"` goes away; planet id `"<number>/<index>"`, dock id the same); `galaxy.ts` (sectors, `getSite`, `listSitesNear`, `systemIdOf`, `parseSystemId`) and `syscode.ts` are replaced by `galaxy2`; names use the 9-symbol code and a pure-name region near the start; `listSystemsNear` becomes `nearestSystems`/`systemsWithin`; `jobs.ts` picks destinations by count (nearest docks) not by 25 ly; planet generation per system (types, docks, markets) keeps working with the new id as its random key but every value changes (UNIVERSE_VERSION 3, fingerprints re-recorded); `startDockOf` becomes the start system; `survey` and `debug.html` rebuilt.
- **game / save:** every saved id is invalid, so the "move + refund" rule again (credits, ranks, ships, upgrades kept); explored list cap (20,000) and the discoveries rules; job destination and fuel/range rules; travel time by distance (galaxy-scale distances).
- **render / ui:** starmap with 10,000 real systems, diamonds for reachable, points for the rest, far glow from `densityAt`/`lineIntegralDensity`, sky from position; longer names everywhere (29 + 5 letters for a planet); the map must not ask for thousands of systems more than once per move; `planets.html` looks hash the new planet id (every planet look changes).
