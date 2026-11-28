# Report: Agent 9, Space Ship Architect (9 ship concepts)

**Status:** DONE. **All 9 ships were approved by Andy** (2026-11-27 to 2026-11-28).
**Gallery** (all 9 ships on one page, with a ship switcher, rotate/zoom and part highlight/hide): `docs/concepts/ship-architect/gallery.html`.
**Work area:** `docs/concepts/ship-architect/` only. No game files (`src/`, etc.) were touched.

## What was built
One plain-grey, flat-shaded 3D concept model per ship, built from separate named parts. Each comes with a viewer Andy could open on his phone, a hand-over note for Agent 8, and a place in the gallery. All designs come only from Andy's references and answers.

| # | Ship | Class | Note | Viewer |
|---|------|-------|------|--------|
| P1 | **Eggspress** | Passenger, small | `passenger-1.md` | `passenger-1/viewer.html` |
| P2 | **Droopliner** | Passenger, medium | `passenger-2.md` | `passenger-2/viewer.html` |
| P3 | **Snoozemarine** | Passenger, large | `passenger-3.md` | `passenger-3/viewer.html` |
| C1 | **Crate Expectations** | Cargo, small | `cargo-1.md` | `cargo-1/viewer.html` |
| C2 | **Haul Monty** | Cargo, medium | `cargo-2.md` | `cargo-2/viewer.html` |
| C3 | **Stacks McGee** | Cargo, large | `cargo-3.md` | `cargo-3/viewer.html` |
| E1 | **Pocket Rocket** | Explorer, small | `explorer-1.md` | `explorer-1/viewer.html` |
| E2 | **Wanderwedge** | Explorer, medium | `explorer-2.md` | `explorer-2/viewer.html` |
| E3 | **Halo There** | Explorer, large | `explorer-3.md` | `explorer-3/viewer.html` |

## Andy's rules per line (recorded in the first note of each line)
- **Passenger** (`passenger-*.md`):
  - Windows and windscreens flush and wrapped onto the hull.
  - Not low-poly, plenty of detail.
- **Cargo** (`cargo-1.md`):
  - Industrial and more angular.
  - Angular windshields.
  - No passenger windows.
  - Cargo and pilot door outlines.
  - Everything flush.
- **Explorer** (`explorer-1.md`):
  - Wings.
  - The body can be a lifting body.
  - Thrusters are hull bulges (on E3, the halo ring is the thruster).
  - A canopy (E2 and E3 use angled windows at Andy's request).
  - Exotic sci-fi, not a real-world jet.
  - Details.
  - **No floating parts.**
- **Andy's general preferences that came up repeatedly:**
  - Short, thick landing legs.
  - Level pads.
  - Struts that visibly go into the hull.
  - Windows that sit flush.

## How the models were checked
No screenshot tool was available in this environment, so every model was checked numerically before Andy saw it:
- **Build check:** each model was built with the real three.js library (0.170, the same version the viewer loads).
- **Integrity:** no errors, no broken numbers.
- **Flush check:** ray tests confirmed that windows, doors and panels sit on the hull skin.
- **Ground check:** pads level, nothing lower than the pads.
- **Attachment check (added during the explorers):** every mesh must touch or sit inside another mesh, tested in both directions. All three explorers pass 100%.

## For Agent 8 (rebuilding these in the game's style)
- Each note has a **"What to keep"** list (Andy's non-negotiables) and a **"For Agent 8"** section covering the mesh/triangle budget, palette and anchors.
- **Every concept is well over the style guide's ship budget** (1000 triangles, 4 meshes, 2 materials), deliberately, so Andy could judge shape and detail. The rebuild must merge parts and simplify. Each note suggests how.
- **No anchors are set** on any concept. Agent 8 must add `parking`, `eye`, `nose` and engine anchors per the style guide.
- E3 is built level and tilted nose-down only for its parked pose (`PARK_PITCH`). Use rotation 0 for flight.

## Gallery tool
- `docs/concepts/ship-architect/gallery-tools/build_gallery.py` regenerates `gallery.html` from the approved viewers.
- To add a ship, add one line to its `SHIPS` list and run it.

## Notes
- Several references Andy sent were protected film or franchise designs (Pixar's XL-15, Marvel's Excelsior) or copyrighted concept art. None was copied. The ships are original designs that take only general ideas from them.
- Out of scope, and not done: colours and palette, game integration, anchors, LOD and budget fitting. All of that is Agent 8's job.
