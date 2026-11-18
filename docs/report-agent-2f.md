# Report Agent 2, stage G7: a central bulge for the galaxy

Branch: `universe-v3` only (nothing on `main`). Andy chose option **C (large)** and asked that the bulge melt into the disc along a smooth curve; that is built in.

## 1. What was built
- A **bulge**: a second, separate set of systems on top of the disc. It has its own cells and its own system numbers, numbered AFTER every disc number, so no disc system, number, code, name, planet, dock, market or job can change anywhere.
- `src/universe/galaxy/bulge.ts` (new): the bulge cell table, slot maths, cell/number conversion, near-cell search.
- `density.ts`: `densityAt` = disc + bulge (so `lineIntegralDensity`, the sky and the map glow pick the bulge up with no change). New: `bulgeProfile`, `bulgeDistance`, `bulgeDensityXYZ`, `bulgeDensity`, `discDensityAt` (the old density, disc only), `expectedBulgeTotal`. `densityPolar` (used by the disc cells) is untouched.
- `systems.ts`: `findSystemById`, `systemsOfCell`, `countInCell`, `systemsWithin` (so `nearestSystems`) now also handle bulge numbers and cells; the cell budget (`TooManyCellsError`) is shared.
- `params.ts`: `BulgeShape`, `BULGE_OPTIONS` (A, B, C), `BULGE` (= C), cell-size settings.
- `src/galaxy-debug.ts` / `galaxy-debug.html`: new section "0. The central bulge: pictures A, B, C" (side view with no stretching, sky from five places, same colour scale as "Today"); the sky in section 6 now uses small steps near the viewer; the numbers table shows the bulge.

## 2. How it works (plain words)
- Bulge density = `peak x profile(s) x flare`. `s` is the distance from the centre in a slightly squashed space (height scale 0.9). The profile falls like 1 / distance^2.5 and is eased to exactly 0 at the radius. The flare factor thins the bulge out above and below the disc plane, and the height it reaches shrinks with distance from the axis, so the bulge rises out of the disc along a smooth curve (no ball on a plate).
- Cells: 7 nested zones (shells at 0, 5, 10, 20, 30, 45, 65, 100 % of the radius). Each zone has its own grid of cubes (edge 3 to 10 ly, picked from a fixed list, so no cube roots and every device builds the same table). A cube has 8 slots; a slot is a system if a hash coin toss says so (chance = density x volume / 8), and only if its position lies inside the zone of its level. Every point belongs to exactly one zone: no gaps, overlaps or double counting.
- System number = (bulge cell number x 8) + slot, starting at 46,599,825,056 (the first number after the disc).

## 3. The three options (shown to Andy)
| Option | Radius | Height | Core radius | Extra systems | Galaxy total |
|---|---|---|---|---|---|
| A small | 2,000 ly | 3,600 ly | 500 ly | 0.11 billion | 18.5 billion |
| B medium | 3,500 ly | 6,300 ly | 875 ly | 0.58 billion | 18.9 billion |
| **C large (chosen)** | **5,500 ly** | **9,900 ly** | **1,375 ly** | **2.24 billion** | **20.1 billion** |

## 4. Chosen constants (`params.ts`)
`BULGE = { radius: 5500, flatten: 0.9, scale: 1375, peak: 0.8 / 1.8^3 }`, flare height 0.35 and reach 0.5 (in `density.ts`), `BULGE_WANTED 6`, 14 allowed cell edges, zones `[0, .05, .1, .2, .3, .45, .65, 1]`.

## 5. What changed and what is proven unchanged
- Method: before any change I saved fingerprints (`tests/fixtures/galaxy-before-bulge.json`) of ALL systems (number + position to 1/1000 ly) inside 80 balls around random places (14 at the centre, 22 each at 600-6,000, 6,000-12,000 and 12,000-50,000 ly) from commit ac49483.
- **All 80 match exactly** when only disc numbers are looked at, even balls inside the bulge: no old system moved, vanished or changed number anywhere. The 38 balls that lie wholly beyond 8,000 ly from the centre match with nothing filtered.
- Start: checksum of the 2,000 nearest is still `d0019075`; the start system is still Bimvik Deep JR62R-MT37 (44776692551, dock 44776692551/2). Universe fingerprints (seeds 12345, 777, 4242) unchanged: `universe-v3.test.ts` passes untouched. `universe`, `universe-v2`, `universe-names` also pass untouched.
- Re-pinned: only the **centre** checksum (500 nearest to 0,0,0): `c01eb9ac` -> `2bfcbd0f` (the bulge adds systems there). Rim and seed-7 checksums unchanged.
- Tests edited (only where the bulge truly changes the answer, `galaxy2.test.ts`, `galaxy2-sky.test.ts`): density "above the disc is 0" now says disc-only for y = 1001 and checks 20,000 ly up; the "slow search" compares disc systems only; the random-cell total compares with disc total (total minus bulge); the sky "through the thick centre" test uses the disc alone; centre checksum re-pinned.
- New: `tests/galaxy2-bulge.test.ts` (17 tests): old systems unchanged (80 balls), start unchanged, bulge shape (peak, 0 at the radius, above the plane, flattened), the three option sizes and totals, tidy cell table, every bulge system inside its cube and zone and number matches its cell, slow search equals fast search (6 places incl. a zone border), no repeated number, determinism, random-cell total vs integral, code round trip (9 symbols), runaway query still stops, nearest N correct.

## 6. Totals, centre density, speed
- Total systems: **2.0123e10** by integration (disc 1.7878e10 + bulge 2.2443e9); by sampling 300,000 random cells each: disc 1.7868e10 + bulge 2.2432e9 = 2.011e10.
- Density at the very centre: 0.3086 systems per cubic ly (spacing **1.48 ly**; was 0.1715 = 1.8 ly). **This misses the brief's "keep about 1.8 ly"**: with the centre at 1.8 ly the bulge was too faint to read in the sky. Andy was told and chose C. If he wants 1.8 back, set `peak` lower (suggestion: 0.25 x 1/1.8^3 gives about 1.67 ly and a fainter bulge).
- Systems within 80 ly of the centre: **656,000** (was 363,000), about 0.86 s on the dev machine. The game never asks for that; it asks for the nearest N.
- Speed, nearest 10,000 systems (best of 9, same machine, before -> after): centre 9 -> 10 ms, start 17 -> 17, middle (30,000 ly out) 15 -> 14, rim 30 -> 25. Inside the bulge, 2,000 ly above the centre: about 22 ms. No slowdown anywhere.
- Cells: 5.82 billion disc cells + 4.51 billion bulge cells (many empty, they are only numbers, nothing is stored). Bulge system numbers run 46.60 billion to 82.69 billion.

## 7. Code lengths
Codes depend only on the number. Disc numbers (and so every old code) are unchanged. Bulge numbers are all above 17^8 and below 17^9 (the table checks the top number is under 17^9 = 118 billion), so **every bulge system has a 9-symbol code**. In the whole galaxy 9-symbol codes now share about 87 % (was 85 %); 4-8 symbols only come from disc systems near the centre. Round trip tested on 2,000 random bulge numbers.

## 8. List for Agent 3 (render), NOT touched by me
- The map and sky in `src/render` call `densityAt` / `thicknessAt` / `spacingAt` / `armFactor`. `densityAt` now includes the bulge, so the sky glow should appear, BUT any sky or map code that (a) sums only to the disc height (`thicknessAt`), (b) has its own copy of the arm numbers, or (c) assumes systems exist only within the disc's vertical range will miss the bulge above 1,000 ly. Please check `docs/report-agent-3k.md` section 3 / decision 4 spots.
- Sky step count: with few steps over 70,000 ly (about 700 ly per step) the 5,500 ly bulge gets only a handful of samples. Suggestion: three pieces with small steps near the viewer (see `skyValue` in `src/galaxy-debug.ts`).
- Cell shape: bulge cells are cubes (not the disc's polar cells). Anything in `src/render` that draws cell boxes must use `bulgeTable()` for numbers >= `cellTable().idSpace`.
- Anything that assumes system numbers stay below 4.66e10 (`cellTable().idSpace`): the new top is `bulgeTable().idEnd` (8.27e10); still safe integers.

## 9. List for Agent 6 (QA)
- Open `/galaxy-debug.html` on a phone: section 0 draws 20 small pictures one by one (about 2 s on a desktop, slower on phones); the banner must stay green with `d0019075`.
- Test around the centre (inside 5,500 ly): jobs, docks and names near the bulge now exist for bulge systems; spot check that `getSystem` works for numbers above 46.6 billion.
- Check that two very close systems (a disc and a bulge system can sit nearly on top of each other, like the 3 % odd systems) do not break planets or docks.

## 10. Risks
- Disc and bulge systems are placed independently, so a bulge system can land very close to a disc system (rare, like the existing "twins").
- Zone borders: a bulge system whose twin/odd position falls outside its zone is dropped (only odd systems, 3 % of all, and only those at zone borders; not measured). Deterministic, harmless.
- The centre is about 1.7 times denser than before; per-system work near the centre (lists of thousands of systems) costs more.

## 11. Suggestions (labelled, not built)
- suggestion: show the sky with 3 pieces of steps in the game's sky shader as in the debug page.
- suggestion: a "bulge" colour tint (older, redder stars) in the render layer for bulge numbers (`id >= idSpace`).
- suggestion: if QA finds the bulge too dense, lower `peak` only; cells and numbers adapt by themselves.
