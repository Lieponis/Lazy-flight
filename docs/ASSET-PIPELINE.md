# Asset pipeline: how ship, outpost and station designs reach the game

Owner: Project Lead. Designer: Agent 8 (Asset Design). Approver of looks: Andy.

## The rules
1. **Catalog is the truth.** Every ship, outpost and station design is one entry in `docs/ASSET-CATALOG.md` and one entry in the registry file `src/render/assets/registry.ts`. If it is not in both, the game does not use it.
2. **Stable IDs.** An asset ID never changes once integrated (saves and game data refer to it). Ship IDs match `src/game/ships.ts` (cargo_hauler first). New ships and variants get new IDs.
3. **Style guide first.** Every design follows `docs/STYLE-GUIDE.md` (palette, polygon budgets, scale, silhouette rules). Andy approves the style guide before any model is built.
4. **Agent 8 never edits existing game files.** Agent 8 writes only new files: `src/render/assets/`, `models.html` (viewer), `src/models.ts`, tests, docs, and the one-line viewer entry in `vite.config.ts`. Other agents put the finished designs into the game.
5. **Anchors are the contract.** Models expose named anchor points (examples: `parking` for where a ship rests on a pad or bay, `eye` for the cockpit camera, `engineL`/`engineR` for exhaust and warp effects, `dockEntrance`). Other agents use anchors and never hard-code positions.
6. **Looks are chosen by the seed.** Which outpost or station variant a dock gets is computed from the dock id (and planet type), so the same dock always looks the same. No variant is stored.
7. **Viewer and debug tool.** Agent 8 builds and keeps `/models.html`: rotate, wireframe, ruler, anchors, triangle counts with pass/fail, a "Check this asset" problem checker, a variant grid, compare with the old rough shape, game-resolution preview, shareable addresses and a "Copy problem report" button. Anything about how a model looks or is built is first reproduced there.
8. **Defects.** When something looks wrong in the game, Andy copies the problem report from the viewer (or sends a screenshot) to the Lead. The Lead sends it to Agent 8, who reproduces it, explains it in plain words and fixes it in its own files only. If the cause is in a scene (placement, scale, camera), the Lead sends it to the agent who owns that file.
9. **Change requests go through the Lead.** An agent who needs a new or changed asset sends the request to the Lead. The Lead adds it to the catalog as REQUESTED and briefs Agent 8.

## The stages (each ends in something Andy can click, and a gate)
| Stage | Owner | Input | Output | Gate |
|---|---|---|---|---|
| S0 Style guide | Agent 8 | design-doc.md, this file | STYLE-GUIDE.md, viewer page with palette and scale test | Andy approves the style |
| S1 Ships | Agent 8 | approved style | 3 ship designs (Cargo Hauler, Passenger Liner, Scout) in the viewer, with catalog entries | Andy: keep / change per ship (max 2 rounds) |
| S2 Outposts | Agent 8 | approved style | 4 outpost variants with surface tint by planet colour | Andy: keep / change per variant (max 2 rounds) |
| S3 Stations | Agent 8 | approved style | 4 station variants | Andy: keep / change per variant (max 2 rounds) |
| S4 Lead check | Lead | catalog, tests, viewer | assets marked APPROVED; budgets and layer rule checked | Actions green |
| S5 Integration | Agent 3 (part 3d) | APPROVED assets | docked, system, flight and starmap scenes use registry assets and anchors; old rough shapes removed | Andy click-test |
| S6 Game data | Agent 4 (part 4b) | ship asset IDs | ship definitions use the same IDs | tests, Andy click-test |
| S7 Screens | Agent 5 (part 5b) | catalog names and descriptions | Shipyard shows names, descriptions and optional preview | Andy click-test |
| S8 Checks | Agent 6 | polygon and performance budgets | frame-rate and regression checks | Agent 6 report |
| S9 Defects | Agent 8 | problem report from the viewer | fixed asset, updated tests | Andy re-checks in viewer and game |
| S10 More looks | Agent 7 | same pipeline | extra variants, liveries | same gates as S1 to S3 |

## Who needs what
- **Agent 3:** registry functions, anchors, the variant picker, animation hooks (spinning station ring, blinking lights), tint parameters. Replace `makeOutpost`, `makeStation` and `ship.ts` shapes only after Lead approval.
- **Agent 4:** ship IDs, display names and a one-line description per ship from the catalog. Stats stay with Agent 4.
- **Agent 5:** names, descriptions, an optional preview made from the same builder.
- **Agent 6:** polygon budgets and the list of tests that guard them.
- **Agent 7:** how to add a variant or livery (catalog entry, registry entry, viewer check, tests).

## Budgets (defaults, Agent 8 may propose changes in the style guide)
Ship up to 700 triangles. Outpost up to 1500. Station up to 2500. One merged mesh per part, flat vertex colours with four brightness steps, no textures required, no extra libraries.
