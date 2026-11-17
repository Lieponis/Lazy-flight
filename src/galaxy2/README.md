# src/galaxy2: galaxy prototype (stage G1)

A spiral disc of about 18 billion systems, worked out from a seed, nothing stored. A PROTOTYPE on the branch `galaxy-proto`, never merged into main. It does not touch the existing `src/universe`; it only reuses its random numbers (`hashString`) and word lists.

- `params.ts` all the numbers (disc 50,000 ly radius, spacing 1.8 to 160 ly, thickness 2,000 to 500 ly, 4 arms).
- `density.ts` the density function, `densityAt`, `expectedCountIn`, `expectedTotal` and `lineIntegralDensity` (density added up along a line of sight; the sky is built from it).
- `cells.ts` the cells: thin rings, cut into sectors and layers, 8 slots per cell. `systems.ts` which slots hold systems and the queries (`nearestSystems`, `systemsWithin`, `findSystemById`).
- `code.ts` system number <-> short code. `names.ts` word + code names and pure names. `start.ts` the start point. `fingerprint.ts` a checksum for "is it the same on every device".
- `detmath.ts` exp, ln, sin, cos from + - * / only, so every device makes the same galaxy.
- Tests: `tests/galaxy2*.test.ts`. Numbers for the report: `npx tsx scripts/galaxy2-bench.ts`. Page: `galaxy-debug.html`.
