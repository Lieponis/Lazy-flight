# Agent 8 brief: ship liveries (paint jobs)

You are Agent 8 (asset designer, viewer and debugger). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/ASSET-CATALOG.md, docs/STYLE-GUIDE.md, docs/ASSET-PIPELINE.md, docs/GUIDE-visual-direction.md, docs/report-agent-8.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Options A/B/C before building, Andy's reference next to your result with a "matches / does not match" list, never change decided things. The only report is docs/report-agent-8-liveries.md. Push to main if you have GitHub access. Free flight and combat are permanently out.

## Goal
Each of the 3 ships (cargo-hauler, passenger-liner, scout) gets several paint jobs (liveries), cosmetic only. Still exactly 3 ships. (Andy approved "ship liveries" as part of polish, 2026-11-10.)

## Do
1. FIRST ask Andy: how many liveries per ship (suggest 3 plus the current look = 4), mood/colour ideas, any funny ones (stripes, rust patches, company logos as simple shapes, a "racing" look, a "clean new" and a "beaten old" look), and references.
2. Show THREE rough options A/B/C of the livery set for ONE ship (the Cargo Hauler), Andy picks; then do the same style for the other two ships.
3. Technique: a livery is a palette/colour-part swap on the existing model (same geometry, same triangle count, same anchors), via the `build({ tint })`-style option or a new `livery` option on `getAsset(id).build(...)`. Default (no option) must look exactly as today. Window/cockpit light colours and engine flames keep working. Respect the palette rules in the style guide and the checker (run "Check this asset" for every livery).
4. Viewer: a livery picker in `/models.html` for ships, so Andy can look at each. Add a catalog section "Liveries" with id, name (funny names welcome), description.
5. Tests in tests/assets.test.ts: every livery builds, same triangle count and anchors as the base, default unchanged, ids unique.
6. Give the Lead a short API note for Agent 5/4: livery ids per ship, default id, how to pass it to `build`, how the docked view / flight / Shipyard preview should use it.
7. `npm run check` must pass.

## Not allowed
src/render scenes, src/ui, src/game, src/universe, src/save (the choice-in-Shipyard and saving come in the next stage by Agent 4/5/3).

## Andy checks
Viewer: each livery per ship, "Check this asset" passes, default look unchanged. Reply keep / change what, per ship.
