# src/universe

Pure game logic that builds the galaxy from a seed (systems, planets, docks, goods, prices, jobs, names). For Agent 2.

**Hard rule:** nothing in this folder may import Three.js or anything from `render`, `ui`, `game` or `save`. A test (`tests/layer-rule.test.ts`) checks this automatically.

## Names (stage N1, unique names)
- `WORLD_SEED = 12345` is the one shared universe. Do not change it.
- A system's full name is `"<word> <code>"` ("Kopipex 4F-92"), or a pure name ("Lazy Harbour") for about 7 % of the systems within about 190 ly of the origin. Codes come from `syscode.ts` (one-to-one with the system id, `decodeSystemCode` goes back). Pure names come from `purenames.ts` (each curated name has exactly one owner system, a fixed rule). Word lists for pure names: `data/purenames.ts`.
- Planets are `"<system name> II"`. The old nickname ("Big Marge") is the optional `nickname` field. Docks have a short `name` (unique in the system) and a universe-unique `fullName`.
- `findSystemByName(seed, text)` finds by full name, code or pure name. `nameStats` counts name lengths and collisions.
- Names use their own random streams ("purename", "dockname"); the old streams are untouched, so nothing but names changed.
