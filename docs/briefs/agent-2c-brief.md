# Agent 2 brief, stage N1: world seed and globally unique names

You are Agent 2 (Universe Generator). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-unique-names-world-seed.md (Andy's decisions: source of truth), docs/report-agent-2b.md, docs/report-agent-2.md, src/universe/README.md, src/universe/names.ts, src/universe/data/words.ts, src/universe/galaxy.ts, src/universe/system.ts, src/universe/planet.ts, src/universe/dock.ts. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Explain technical words in one sentence. Report: docs/report-agent-2c.md. Combat never. Pure logic, no graphics.

## Goal
1. A single constant `WORLD_SEED` (value 12345, today's default) exported from `src/universe`, documented as "the one shared universe; not to be changed".
2. Names that NEVER repeat in the whole (endless) universe: systems, planets and docks.

## Rules (from Andy)
- System full name = a word part + a position code, style B, like "Kopipex 4F-92". The code is a unique, reversible encoding of the system id (sector coordinates sx, sy, sz and index 0..2, which can be negative and unbounded): short near the origin (aim for 4 to 6 characters within about 1,000 ly), longer far away, always unique. No look-alike characters (avoid O/0 and I/1 confusion). Provide `decodeSystemCode(code)` so a name can be turned back into the system id (useful for search and tests).
- Some systems (a small share, you propose: e.g. 5 to 10 %) may instead have a PURE word/name/nickname name with no code ("Kopipex", "Lazy Harbour"). Pure names must still be globally unique in an endless universe: do it by giving each curated name exactly ONE owner system through a fixed deterministic rule (the name decides its system, not the other way round; resolve clashes deterministically, for example by probing), and a system gets a pure name only if it is the owner. Grow the curated word lists enough (thousands of names; reuse the existing word lists and funny style: relaxed, child-friendly, no violence), say how many.
- Planets: "<system full name> II" style (Roman numerals; planets are numbered by orbit; Roman numerals up to X). The standalone planet nicknames ("Big Marge") stop being NAMES; keep the old nickname list available as a separate optional field `nickname` (or similar) for flavour text, not unique, not used as a name.
- Docks: each dock needs a short flavour name unique within its system ("Lazy Anchor Outpost"), and a `fullName` unique in the whole universe (short name + the planet's or system's full name, your choice of the shortest unambiguous form, e.g. "Lazy Anchor Outpost, Kopipex 4F-92 II"). Give the UI both.
- NOTHING else in the universe may change: use separate random streams for every name decision (new stream names) so planets, docks, goods, prices, jobs and the planet-look fingerprints stay identical. Prove it: the existing fingerprint test for src/universe (tests/planetlook.test.ts fingerprints, and the universe tests) must be updated ONLY for names, and a new test must prove that everything except names is byte-identical to the commit before this work (record a fingerprint of ids, positions, planet types/sizes/orbits, dock ids/kinds, markets, job boards from the previous main, compare after).
- No two names equal ever: tests (below). A name is never empty and never too long (propose a maximum, say how long names can get far from the origin).

## Do
1. Implement the above. Add to the id/lookup layer: find a system by its code or full name (`findSystemByName`) for at least the codes and pure names.
2. Uniqueness proof in tests: (a) by construction (the code encoding is a bijection: round trip decode(encode(id)) over a large random sample including far and negative coordinates); (b) a big scan: every system, planet and dock within, say, 300 ly of the origin for 3 seeds has a unique full name; (c) pure-name owner rule: no name owned twice; (d) other seeds still produce valid unique names (the generator works for any seed; only WORLD_SEED is "the" universe).
3. Update `/debug.html` (src/debug.ts): show full names, the code, pure vs coded, a search box ("find a system by name"), and a small table: share of pure names, longest name in the sample, collisions found (must be 0).
4. `npm run check` may fail in other layers' tests that print or compare names: list each failure; fix only tests inside `tests/universe*` and the planetlook fingerprint (names only), tell the Lead the rest (Agent 4/5 fix them in N2/N3). Push to a branch `universe-names` if the full check fails only for other layers (the branch check runs on Actions), otherwise to main.
5. Report the numbers: share of pure names, name length distribution, code length vs distance.

## Allowed / not allowed
Allowed: src/universe, src/debug.ts, debug.html, tests/universe*.test.ts, the names-only part of the planetlook fingerprint, docs. Not allowed: src/game, src/save, src/render, src/ui, anything that changes non-name universe content, adding the dev flag logic (Agent 4).

## Andy checks
`/debug.html`: see names like "Kopipex 4F-92" and some pure names; every planet "<system> II"; docks with unique full names; search a system by its code; the collision counter says 0; the planet looks wall (`/planets.html`) and the star map look the same as before except for the names.
