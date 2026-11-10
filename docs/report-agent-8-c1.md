# Report to the Lead: Agent 8, stage C1 (base cockpit), 2026-11-10

## In short

The new cockpit is built and checked in the model viewer, made from your drawings in five approved steps:

1. the shell and the window;
2. the dashboard panels;
3. the seats;
4. the instruments and lights;
5. the screen jobs.

One cockpit is used for all three ships for now. The dog, the warm lamp and the window light are left for later, as
Andy asked. It is not inside the game yet. Technical notes for putting it in are in `docs/INTEGRATION-cockpit.md`;
who does that, and when, is the Lead's call.

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

## Changes against the C1 brief and roadmap (for the Lead to confirm)

- **One base cockpit for all three ships**, instead of three different ones (Andy's instruction at the restart).
  The Scout has no dog-free version yet, because the dog is deferred.
- **Triangle budget:** about 2,400. That is over the roadmap's 2,000, inside the 3,000 set for the restart.
- **New file `src/render/assets/lens.ts`** (the cockpit lens, Andy's choice). The game's cockpit view needs the same
  lens to look like the viewer.
- **Palette:** new colour `seatBlue` (Andy's choice).
- **Checker:** parts named "may cover window" may cover the window (the dashboard and seats, as Andy chose).
- **Viewer:** fields of view now count side to side, plus a lens button and reversed left/right drag (Andy's choices).
- **Not built:** the `windowLight` anchor, the dog and the lamp (Andy: not now). The cockpit therefore stays out of
  the registry. Before it goes in, the window light must be built or the rule dropped, with Andy's approval.

## Open items for the Lead to arrange (suggestions only)

1. **Cockpit into the game:** use the new model and the lens in the flight view's cockpit mode, replacing the flat
   overlay in `src/render/cockpit.ts`. Notes, part 1. Touches `src/render/flight.ts` and `src/render/index.ts`,
   which are outside Agent 8's allowed files.
2. **Trip information on the three screens:** information, map and fuel. Notes, part 2. This also needs fuel added to
   the flight information, and Andy should decide whether the HTML read-out stays.
3. **Andy decides on the deferred parts:** the window light, the dog (Hauler and Liner only), the lamp, and whether the
   ships later get their own cockpit differences.
4. **Phone check** of the cockpit view once it is in the game (frame rate, readability of the screens).
5. **Smaller polish** (for later):
   - the zigzag roof shading;
   - misplaced viewer labels when the lens is on.

## Andy's working method (worked well in this stage)

- One step per message.
- Options A/B/C before building.
- His reference next to the result, with a "matches / does not match" list.
- Never change decided things.
- Ask questions before reworking.
