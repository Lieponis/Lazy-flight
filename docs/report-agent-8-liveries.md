# Report: Agent 8, ship liveries (paint jobs), 2026-11-11

## 1. What was built

Every ship has 4 paint jobs: the standard look plus 3 new ones. They are cosmetic only: same shapes, triangles,
anchors, glass, lights and flames, only the paint colours change. Andy approved all of them in the viewer.

| Ship | Livery ids (first = default) | Style (Andy's choice) |
|---|---|---|
| cargo-hauler | `standard`, `hazard-yellow`, `teal-line`, `orange-express` | Option C: bright company colours, the whole hull in one bold colour (work colours). |
| passenger-liner | `standard`, `sky-blue`, `spring-green`, `rose-line` | Option B of its own round: a pale body with a bold top deck and tail (airline colours). Andy changed purple and coral to green and pink. |
| scout | `standard`, `survey-lime`, `rescue-red`, `electric-blue` | Option C: bold hull, the side pods in the second colour (explorer colours). |

Andy's answers:
- 3 new paint jobs plus the standard one per ship;
- smart company-fleet colours;
- nothing jokey;
- a different set for each ship's job;
- colours only, no new markings.

Names and descriptions for each are in docs/ASSET-CATALOG.md, section "Liveries".

How it works:
- `src/render/assets/liveries.ts` lists the liveries per ship.
- A livery repaints up to six paint "roles": hull, trim, panels, dark parts, underside and company marks. Each ship maps
  these roles to its palette colours, because the Scout's body is the grey paint.
- The model kit swaps those colours while building (`new ModelKit({ recolour })`).
- Glow colours (windows, lights, engines, flames) are never in the list.

Files changed:

| File | Change |
|---|---|
| `src/render/assets/liveries.ts` | New. |
| `src/render/assets/kit.ts` | Colour override. |
| `src/render/assets/ships.ts` | `livery` option on the three ship builders. The Liner's top deck and tail now use `paintTrim`. |
| `src/render/assets/palette.ts` | New slot `paintTrim`, the same white as `paintWhite`, so the standard Liner is unchanged. |
| `src/render/assets/types.ts` | `BuildOptions.livery`. |
| `src/render/assets/index.ts` | Exports the livery list. |
| `src/models.ts` | Viewer: a "Paint job (livery)" row for ships, and the address parameter `livery=`. |
| `tests/assets.test.ts` | Livery tests (see below). |
| `docs/ASSET-CATALOG.md` | Liveries section. |

## 2. How to check

- **Tests:** `npm run check` passes (565 tests), and the Actions run is green. The new tests check that:
  - every livery builds, with the same triangle counts and anchors as the standard look;
  - lights and flames keep their colours;
  - the checker results match the standard look;
  - no livery, `standard`, or an unknown id all give exactly the standard look;
  - ids are unique and `standard` comes first.
- **Model checker:** 0 problems for all 12 liveries.
- **Viewer:** https://lieponis.github.io/Lazy-flight/models.html. Pick a ship, then use the "Paint job (livery)" row.
  The address keeps the choice, for example `?asset=scout&livery=rescue-red`.
- **Andy's check:** Hauler and Scout kept; Liner changed once, then kept.

## 3. API note for the Lead (for Agents 3, 4 and 5; not done by Agent 8)

- **Imports:** `import { liveriesFor, DEFAULT_LIVERY } from "./assets"` (render layer) or from
  `src/render/assets/liveries.ts`.
  - `liveriesFor(shipId)` returns `[{ id, name, description }, ...]`, with `standard` first. Use it for the Shipyard
    list.
  - `DEFAULT_LIVERY = "standard"`.
- **Building a ship in a livery:** `getAsset(shipId).build({ livery: liveryId })`.
  - A missing or unknown id gives the standard look, which is safe for old saves.
- **Where the game builds ships today:** `buildShipModel(shipId)` in `src/render/models3d.ts`. It is used by
  `docked.ts` (docked view), `flight.ts` (orbit view of the ship) and `src/ui/shippreview.ts` (Shipyard preview).
  - Suggested change: add a parameter, `buildShipModel(shipId, liveryId?)`, that passes `{ livery: liveryId }` to
    `build`.
  - The docked view and the flight view pass the livery of the ship being flown.
  - The Shipyard preview shows the livery being browsed or chosen.
- **Game and saving (Agent 4/6):**
  - each owned ship keeps a `livery` field, default `"standard"`;
  - choosing one in the Shipyard is free or priced, which is Andy's decision;
  - old saves without the field use `"standard"`.
- **The cockpit is not affected:** liveries are outside paint only.
- **Layer rule:** the render layer still never imports `src/game`. The livery id travels as a plain string through
  the glue (`src/ui`), like the ship id.

## 4. Known issues / not verified

- **Not in the game yet:** liveries can't be chosen in the game until Agents 3, 4 and 5 wire them in (next stage).
  They are only in the viewer.
- **Not tested on a phone:** this costs no extra speed, because the shapes are the same and only the colours differ.
- **Glass frames repainted:** the canopy frame bars use the hull paint, so they take the livery's hull colour (for
  example yellow bars on Hazard Yellow). This is visible in the pictures Andy approved; he did not
  ask for a change.

## 5. Suggestions (not built)

- Show a small colour swatch next to each livery name in the Shipyard.
- A paint job could cost a few credits as a credit sink (Andy decides).
