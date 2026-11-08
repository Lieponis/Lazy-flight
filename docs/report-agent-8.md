# Agent 8 report: asset design, model viewer and debug tools

## 1. What was built
Style guide (docs/STYLE-GUIDE.md) and 11 designs, all built in code and kept by Andy: 3 ships (cargo-hauler, passenger-liner, scout), 4 outposts (outpost-depot, -domes, -comms, -hub) and 4 stations (station-ring, -starport, -cargo, -refinery). Catalog in docs/ASSET-CATALOG.md, registry in src/render/assets/registry.ts. The viewer /models.html has the debug tools: view modes, backgrounds, game-resolution preview (desktop and phone), ruler and box, anchors, size buddy, compare with the old shape, "Park a ship", counts with pass/fail, problem checker (one or all), variant grid with a sample of real docks, "Copy problem report", and an address that records every control. 19 new tests in tests/assets.test.ts (123 in total).

## 2. How to look at it
Open /models.html. Style guide tab = palette, sizes, budgets. Model tab = pick an asset, drag to turn, Tools panel for everything else. All variants tab = every design at game resolution plus what real docks get. When something looks wrong: "Copy problem report" and paste it to the Lead.

## 3. Live link
The usual address ending in /lazy-freight/, plus models.html.

## 4. Known issues and NOT verified
- Verified here: `npm run check` (build and 123 tests) after every batch; screenshots in a headless Chrome (software graphics). Andy approved every batch from the viewer after a green Actions run.
- Not verified: frame rate on a real phone; the viewer on a real phone (layout tested only in a narrow window).
- Changes from the brief, decided by Andy: no funny touches on ships or stations (outposts have subtle ones); ship budget raised to 1000; station bay enlarged to 11 x 6.5 x 13 because the docked camera goes inside the bay.
- Ship ids use hyphens (`cargo-hauler`) because the code in src/game/ships.ts does; the brief's example used underscores.
- A shared link does not keep the inside-the-bay camera (it reopens from outside).

## 5. For Agent 3 (part 3d integration)
`getAsset(id).build({ tint })` returns `{ group, anchors, animation, update(t) }`. Call `update(seconds)` every frame (blinking lights, ring spin). Flames: `animation.flames[*].scale.z` (0.15 parked, 1 flying, 3 warp). Tint = planet primary colour as a number (outposts only, ground and dust). Pickers: `pickOutpostVariant(dockId, planetType)`, `pickStationVariant(dockId)` in src/render/assets/pickers.ts. Anchors: ships parking, eye, nose, engineL/R or engineMain; outposts parking, beacon, entrance; stations parking, dockEntrance, bayCamera, spinAxis (ring). Swap list: (1) ship.ts `buildCargoHauler` in docked.ts and flight.ts -> registry ship by the player's ship id, flames from `animation.flames`, cockpit camera at `eye`; (2) docked.ts outpost pad, building, mast and crates -> outpost model with its parking anchor at the ship's spot (it has its own pad); (3) docked.ts station platform and corridor -> station model, ship at `parking`, camera inside the bay (start from `bayCamera`); (4) systemview.ts `makeOutpost` / `makeStation` -> picked models scaled down; flight.ts reuses them. Size: 1 unit = 1 crate; the models are about 1x the old ship scale, so drop the 3.2x and 3.5x scaling in docked.ts.

## 6. For Agent 4
cargo-hauler "Cargo Hauler": wide, flat hauler, cargo hidden inside. passenger-liner "Passenger Liner": long, grand white liner with lit windows. scout "Scout": small angular explorer with two side pods.

## 7. For Agent 5
Names and one-line descriptions are in the registry and catalog. Preview: build the model, render it once to a small canvas (see `thumbnail()` in src/models.ts).

## 8. For Agent 6
Budgets: ship 1000, outpost 1500, station 2500 triangles; 4-6 meshes, 1 material each. Tests: tests/assets.test.ts (anchors, budgets, unique ids, pickers deterministic and spread, layer rule, checker catches a broken model). Phone check: frame rate in the docked view with a station, viewer buttons and pinch.

## 9. For Agent 7
New variant or livery: write a builder with ModelKit (src/render/assets), add a registry entry and a catalog line, add the id to the picker list (only before integration: it changes which dock gets which look), open it in the viewer, press "Check this asset", run the tests.

## 10. Suggestions (not built)
- Suggestion: liveries (paint jobs) per ship as variants.
- Suggestion: the subtle funny props for stations, kept for later.
- Suggestion: a slow spin for the Coriolis starport, Elite-style.
