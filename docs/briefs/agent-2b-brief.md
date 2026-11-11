# Agent 2 brief, stage U1: fewer docks, bigger systems (universe v2)

You are Agent 2 (Universe Generator). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-fewer-docks.md (the plan and Andy's decisions: your source), docs/report-agent-2.md, docs/CONVENTIONS.md, src/universe/README.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-2b.md. Push to main if you have GitHub access. Free flight and combat are permanently out.

## Goal
Change the universe so not every planet has a dock, and systems can have up to 10 planets. Pure logic, no graphics.

## Do
1. `MAX_PLANETS` 10 (`MIN_PLANETS` 1). Planet generation must work for 1..10 planets (orbit fractions, names, types).
2. Dock rule from docs/plan-fewer-docks.md: `maxDocks = clamp(round(planetCount / 3.3), 1, 3)`; the number of docks in a system is a deterministic random integer from 1 to `maxDocks`; the planets that get docks are chosen deterministically (gas giants only as stations). Dock id stays equal to its planet id; `getDock` returns null for planets without a dock. Keep every other dock field and rule as today.
3. Add `docksOf(system)` (or similar) returning the system's docks, and make everything in `src/universe` that looped over planets as docks use it (job destinations, tours, lookups, `jobs.ts` candidate list, `lookup.ts`). A job can only start at and go to docks. Make sure a system with ONE dock still works (no destination in its own system) and that every dock can get a reasonable board.
4. Export `UNIVERSE_VERSION = 2` from `src/universe`. Do not change any random stream names beyond what the new rules need; same seed must stay deterministic.
5. Update `/debug.html` (src/debug.ts) so it shows planets with and without docks, dock counts per system, and a table over many seeds.
6. Report numbers over at least 50 seeds: distribution of planets per system and docks per system; average and minimum number of docks reachable within `MAX_JOB_DISTANCE` of a dock; average and minimum jobs per board (how many boards have fewer than 3 jobs); share of tours possible; outposts vs stations. If boards are too thin, tell the Lead with data; do not change `MAX_JOB_DISTANCE` yourself.
7. Tests: determinism, dock count within 1..maxDocks for every planetCount 1..10, gas giants only stations, dock ids unique and valid, `getDock` null for non-dock planets, a job never starts or ends at a non-dock, ids stable across calls. `npm run check` may fail in src/game/ui/render/save tests that assume one dock per planet or 8 planets: list each failure in the report with its reason, fix only tests inside `tests/universe*`, and tell the Lead the rest (Agent 4 fixes them in stage U2). Do NOT edit src/game, src/save, src/render, src/ui.

## Allowed / not allowed
Allowed: src/universe, src/debug.ts, debug.html, tests/universe*.test.ts, docs. Not allowed: everything else.

## Andy checks
`/debug.html`: planets with and without docks, dock counts, many seeds look sensible; boards still have jobs. Build/Actions may be red until U2 fixes game tests: if so, Andy must NOT worry; the Lead will say when to commit. (Agent 2: if the full check fails only because of other layers' tests, push to a branch `universe-v2` instead of main and tell the Lead.)
