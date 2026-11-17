# src/universe/galaxy: the spiral galaxy (prototype G1, the real universe since G3)

A spiral disc of about 18 billion systems, worked out from a seed, nothing stored. Built as a prototype (stage G1, branch `galaxy-proto`), moved here in stage G3. It only knows where systems are and which system numbers exist; names, planets and docks are built on top of it (see `../README.md`). It only reuses the random-number helper `hashString` from `../random.ts`. Do NOT change `params.ts` or `density.ts` lightly: every system number would move (the pinned checksums in `tests/galaxy2.test.ts` catch that). The seed hash still starts with the text `galaxy2|` on purpose (changing it would move every system).

- `params.ts` all the numbers (disc 50,000 ly radius, spacing 1.8 to 160 ly, thickness 2,000 to 500 ly, 4 arms).
- `density.ts` the density function, `densityAt`, `expectedCountIn`, `expectedTotal` and `lineIntegralDensity` (density added up along a line of sight; the sky is built from it).
- `cells.ts` the cells: thin rings, cut into sectors and layers, 8 slots per cell. `systems.ts` which slots hold systems and the queries (`nearestSystems`, `systemsWithin`, `findSystemById`).
- `code.ts` system number <-> short code. `start.ts` the start point. `fingerprint.ts` a checksum for "is it the same on every device".
- `detmath.ts` exp, ln, sin, cos from + - * / only, so every device makes the same galaxy.
- Tests: `tests/galaxy2*.test.ts`. Numbers for the report: `npx tsx scripts/galaxy2-bench.ts`. Page: `galaxy-debug.html`.
