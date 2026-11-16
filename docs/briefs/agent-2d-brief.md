# Agent 2 brief, stage G1: galaxy generator PROTOTYPE (spiral disc, about 20 billion systems)

You are Agent 2 (Universe Generator). Work on the CURRENT `main` (never an old zip), on a NEW BRANCH `galaxy-proto` that is NEVER merged into main (the branch check on Actions runs your tests). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/feasibility-galaxy.md (the whole file: Andy's spec, decisions in section 6, risks), docs/plan-unique-names-world-seed.md, docs/report-agent-2c.md, src/universe/README.md, src/universe/galaxy.ts, random.ts, settings.ts, syscode.ts. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Explain technical words in one sentence. Report: docs/report-agent-2d.md (put it on the branch AND tell Andy where). Combat never. Pure logic, no graphics.

## Goal
Prove (or disprove) that a deterministic, nothing-stored generator can produce Andy's galaxy fast enough for a phone, with unique ids and short names, before anyone rebuilds the game on it. A go/no-go report with real numbers.

## Spec (Andy)
- A flat spiral disc ("pancake"), 100,000 ly across (radius 50,000 ly), centre at (0,0,0), disc in the x-z plane (y is up).
- Total about 20 billion systems (anything from about 15 to 25 billion is fine; report the real figure).
- Spacing between neighbouring systems: about 2 ly (some centres up to 8 ly) in the centre, growing smoothly to 150 to 170 ly at the rim. Start with an exponential curve s(r) from about 2 ly to about 160 ly; fit it (and the thickness) so the total is about 20 billion. Thickness: 2,000 ly at the centre tapering to about 500 ly at the rim (propose better if you know better). Spiral arms: 2 to 4 log-spiral arms that make the density higher inside the arms and lower between them (choose the strength, the arms must be visible in a density picture, but the average spacing curve above stays true).
- A few percent of systems (propose, e.g. 2 to 4 %) are placed randomly closer to or farther from their neighbours than the local spacing says (own offset or small clusters), decided by their hash, independent of position.
- Same seed = same galaxy (WORLD_SEED 12345); nothing stored; any region can be generated alone, in any order.
- The player starts one third of the way from the centre to the rim (about 16,700 ly from the centre, on a spiral arm if possible: say where you put the start system; local spacing there should be about 8 to 9 ly).

## Hard design issues you must solve and document
1. **Variable cells.** A fixed 10 ly cube grid cannot work (millions of empty cells at the rim, billions of stars in the centre). Propose and implement ONE scheme: for example concentric zones with cell size growing with the local spacing, or an octree-like hierarchy. Every point of space must belong to exactly one cell; cell contents decided by hash(seed, cell id) only; expected number of systems per cell follows the density function; cells near zone boundaries must not double count or lose systems.
2. **Unique ids and short codes.** Every system has a unique, reversible id (cell id + index), and the existing name style (word + code, pure names for a few) must still work: report code lengths versus position (centre, start, rim) for the new id scheme (about 20 billion systems should give codes of about 7 to 9 characters). Decide where the pure-name owner region sits (near the start).
3. **Queries the game and map need:**
   - `nearestSystems(center, count)`: the nearest N real systems (N up to 10,000; also test 60,000), sorted by distance, with positions.
   - `systemsWithin(center, radius)` for radius up to about 80 ly.
   - `findSystemById(id)` and position of a system by id (no search over cells).
   - `densityAt(point)` and `expectedCountIn(box)` for the map's far glow and for tests.
   - `startSystem()` and `startDock` rules are NOT part of this prototype, only the start region.
4. **Speed.** Measure on the cloud machine (and say how much slower a phone typically is, factor 3 to 6): `nearestSystems` for 1,000 / 10,000 / 60,000 at the centre, at the start region, in a middle region and at the rim; `systemsWithin(80 ly)` at the same places; per-system cost. Targets: nearest 10,000 in under 100 ms on the cloud machine at the start region; no query allocates huge arrays; results cached or chunked if needed.
5. **Determinism and uniqueness proofs:** same seed same results (two runs, two query orders); ids unique and reversible over a large random sample incl. cell and zone boundaries; no system listed twice or missing when the same area is queried from two different centres (compare overlapping queries); total count by integration vs by sampling counts of many cells (report both and the error).

## Deliver
- Code in a new folder (for example `src/universe/galaxy2/` or `src/galaxy/`), NOT touching the existing universe files, saves, game, render or ui. Tests in `tests/galaxy2*.test.ts`.
- A developer page `/galaxy-debug.html` (online only, like `/debug.html`): a top-down density picture of the whole disc (canvas, spiral arms visible), a side view, the start position marked, a table of local spacing at radii 0 / 1,000 / 5,000 / 16,700 / 30,000 / 50,000, a "stars near the start" picture, the timing table (run in the browser), counts and the total. Plain language labels for Andy.
- Report `docs/report-agent-2d.md`: the scheme in plain words, the numbers (total, spacing table, thickness, code lengths, timings, uniqueness results), what is NOT verified (phone speed), risks, and an honest GO / NO-GO / GO-WITH-CHANGES recommendation with options. Include what must change in the existing game when this becomes universe v3 (a short list by layer).

## Allowed / not allowed
Allowed: new files for the prototype, tests, the debug page and its vite entry, docs. Not allowed: changing existing `src/universe` behaviour, saves, game, render, ui, or merging to main.

## Andy checks
Opens the branch's `/galaxy-debug.html` if it is published (otherwise Agent 2 gives screenshots) and looks at the spiral picture, the table of spacing, the total and the timings; decides GO / NO-GO with the Lead.
