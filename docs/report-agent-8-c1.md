# Report: Agent 8, stage C1 (base cockpit), 2026-11-10

## In short (for Andy)

The new cockpit is built and checked in the model viewer, made from your drawings in five approved steps:

1. the shell and the window;
2. the dashboard panels;
3. the seats;
4. the instruments and lights;
5. the screen jobs.

One cockpit is used for all three ships for now. The dog, the warm lamp and the window light are left for later, as
you asked. It is not inside the game yet: the next agent puts it in, following `docs/INTEGRATION-cockpit.md`.

- **See it:** https://lieponis.github.io/Lazy-flight/models.html, pick "Cockpit base (work in progress)", press "Sit inside".
- **Run it on a computer:** `npm install`, then `npm run dev`, then open the address it prints and add `/models.html`.
- **Checks:** `npm run check` (types, style, 333 tests, build). All pass.

## What was built (all decided by Andy)

| Step | Decided |
|---|---|
| 1 Shell and window | Six surfaces with no thickness: small front wall, back wall, floor, two side walls, and one curved roof with the window cut out. Shapes measured pixel by pixel from "Cockpit shell". Window from "Cockpit windows": the three views disagree, so the front view leads (option C) and the top and side views pull a little. Smooth window edge. |
| 2 Panels | Option B (as drawn, softened). Wrap-round dashboard (straight middle and two angled wings) at the drawing's height. Its flat light top runs forward to meet the shell with no gap. Light upright face and dark leg room at right angles. Side columns. Centre console joined to the dashboard, in the dashboard's colour. Overhead panel from the window's edge to the back wall. Exact left/right symmetry. Eye 1.45 crates high, closer to the dashboard. View: 70 degrees side to side through a light Panini lens (option C, no stretched edges). Viewer drag reversed left/right only. |
| 3 Seats | Option B: the drawn seats (pedestal, cushion with a leg cut-out, leaning backrest, headrest), moved forward and slightly inwards so the eye sits just in front of the headrest. They clear the console. Airbus flight-deck blue (new palette colour `seatBlue`). |
| 4 Instruments and lights | Five screens on the dashboard's upright face (smaller ones on the wings, all inside the face) and one on the console, with grey frames. About 90 lights, bigger, on dark surrounds, in random glow colours, each flashing at its own pace (fixed seed). The overhead panel is full of lights, with extra lights round the wing screens. Building fails if a dashboard light would stick out of its panel. Throttle with a cylinder grip, a small lever and two switches. |
| 5 Screen jobs | Option A 2: information straight ahead, route map in the middle, fuel in amber on the pilot's wing. Anchors `screenInfo`, `screenMap`, `screenFuel` (middle, facing, size). Made-up readouts (bars, a graph line, a header strip) on the other three screens. |

Numbers: about 2,400 triangles, 4 meshes, 1 material.

## Files changed in this stage

| File | Change |
|---|---|
| `src/render/assets/cockpitBase.ts` | The cockpit, all steps. |
| `src/render/assets/lens.ts` | The cockpit lens. |
| `tests/lens.test.ts` | Tests for the lens maths. |
| `src/render/assets/palette.ts` | `seatBlue`. |
| `src/render/assets/types.ts` | `eyeFov` on asset entries. |
| `src/render/assets/checker.ts` | Parts named "may cover window" are allowed over the window. |
| `src/models.ts` | Viewer: field of view side to side, lens on/off button, reversed left/right drag, the cockpit's own default view. |
| `docs/ASSET-CATALOG.md` | Step table. |
| `docs/INTEGRATION-cockpit.md` | How to put the cockpit into the game and draw on its screens. |
| `docs/GUIDE-visual-direction.md` | Added (it was only an upload before). |

## Known issues

- **Window light missing:** the `windowLight` anchor is not built (Andy deferred it). The viewer shows "Missing
  anchor windowLight", and the cockpit stays in the viewer's reference group as DRAFT, not in the registry.
- **Deferred by Andy:** the dog and the warm lamp.
- **Roof shading:** small zigzag shading steps on the curved roof.
- **Drawings that disagree:** the window views, and the dashboard lip against the low roof at the nose sides. One
  view leads; the others are matched as closely as the shapes allow.
- **Window covered on purpose:** the dashboard and the seats cover small parts of the window from the eye.
- **Overhead lights:** they sit above and just behind the pilot's head, so you mostly see them when you look up and back.
- **Viewer labels:** with the lens on, floating labels in the viewer (anchor names) are slightly misplaced.
  This affects the viewer only.

## For the next agent

- **Integration:** follow `docs/INTEGRATION-cockpit.md`, part 1 (cockpit in the flight view, through the lens) and
  part 2 (trip information on the three screens).
- **Andy's method:**
  - one step per message;
  - show options A/B/C before building;
  - show his reference next to the result with a "matches / does not match" list;
  - never change decided things;
  - ask before reworking.
- **Never change these:** the decided items above, the eye position, the lens choice, and the colours.
