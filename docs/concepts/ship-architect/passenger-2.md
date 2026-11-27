# Passenger 2 — "Droopliner" (medium)

Status: **APPROVED by Andy** (2026-11-28)

## Role & personality
A medium passenger shuttle: a proper little space bus for regular routes
between stations, with a cabin full of people looking out the windows.
One-line personality: a sleepy airliner that always looks like it's
nodding off, with its nose drooping and eyes half closed, yet it still gets
everyone there on time.

Category: Passenger. Size class: Medium (2 of 3).

## Model files
- Viewer: `docs/concepts/ship-architect/passenger-2/viewer.html`
  (self-contained Three.js page; open it in a browser, drag to rotate and
  pinch to zoom. Every part below can be hidden or highlighted from the
  panel).
- Each part is a separate named object, all in one plain grey flat-shaded
  material. This model is for judging shape only, so no colour or material
  decisions were made.

## Parts (name, rough shape & position)
Local ship space: nose points -Z, tail +Z, up is +Y. Overall length is
about 2.65 (z -1.40 to +1.25 for the hull, with nacelles reaching +1.65),
cabin width about 1.2, and cabin height about 0.88.

- **hull**: a sleek "bus" fuselage lofted from cross-sections. Each
  section is a rounded rectangle (superellipse, exponent 4): flat-ish
  sides with properly rounded corners, not an oval. The cabin runs at full
  width from z≈-0.15 to +0.30 and narrows to a blunt tail at +1.25.
  - **Nose (A350-style):** rounded and drooping. The first 0.40 of the
    nose (z -1.40 to -1.00) is a dome whose radius grows on a
    quarter-circle (sine) curve, not a straight taper. A straight taper
    reads as a cone; this curve reads as rounded. The tip droops 0.18
    below the cabin centreline, and the droop eases out over the same
    curve.
- **cockpitWindows**: a modern A350-style "mask" with **4 slim panes**:
  two front panes either side of a thin centre post, and two side panes
  that sweep back around the nose's cheeks. The lower edge dips at the
  centre and sweeps up toward the sides. Pane height tapers from about
  0.095 at the centre to about 0.06 at the outer edge (a narrow slit, as
  Andy chose). The glass bends to follow the nose. The thin frame bars
  run around every pane, centred **on** the hull skin (half buried), and
  each glass edge is tucked under them.
- **windowRows**: passenger windows, two large rounded-rectangle windows
  per side (centred at z = 0.05 and 0.48, about 0.32 long × 0.17 tall).
  They sit above the side trim line, wrap onto the cabin wall, and each has
  a thin raised frame.
- **hullDetails**: a small nose probe on the drooped tip, a blade antenna
  on top at the front of the cabin, and a raised trim strip ("cheat line")
  along each side at mid-height.
- **tailFins**: a V-tail of two medium, swept-back stabilisers on top of
  the rear hull. Each leans **55° out from straight up**, so the V is wide
  and low. They sit **slightly forward, over the rear cabin**, with the
  root running from z 0.58 to 1.04, just ahead of the nacelles. Root chord
  is 0.46 and tip chord 0.20, with the tip set 0.26 further back and a
  span of 0.42. The cross-section is a lens shape, thicker at the root.
  The roots are buried just below the hull skin, so the fins grow out of
  the hull.
- **engineL / engineR**: one nacelle per side at the tail (centre about
  x ±0.54, z 1.35), each joined to the hull by a pylon. Each nacelle holds
  **2 stacked slotted rectangular engines** on its back face, so the ship
  has 4 engines in total. It also has two raised ribs around the housing.
- **legs**: four corner legs (front corners at z = -0.55, rear corners at
  z = 0.95). Each leg is a main strut plus a diagonal brace, forming a
  triangle, and ends in a flat foot pad with a ring detail. The struts
  start inside the hull. All four pads sit at exactly the same height
  (y = -0.49), so the ship sits level. The legs are **short**: Andy asked
  for half the first draft's length.

## What to keep when Agent 8 rebuilds this in the game's style
- **The drooping, rounded A350 nose.** Andy pushed for this over three
  rounds: rounder and lower each time. Don't sharpen the tip or straighten
  the droop.
- **The slim 4-pane A350 mask windscreen,** with its curved, dipping lower
  edge, thin frames and narrow slit height. It must sit **flush** on the
  hull. Andy rejected both "sunk inside the hull" and "floating with a gap"
  versions.
- **Every window wraps tightly onto the hull surface.** Flat panes pushed
  through the hull or hovering off it were rejected. Andy's words were
  "wrap it along hull".
- The wide, low 55° V-tail, set forward of the engines (Andy chose all four
  of its settings himself).
- 4 engines in 2 side nacelles, with slotted rectangular exhausts.
- Short four-corner legs with level pads.
- The bus-like flat-sided cabin with exactly two large windows per side.
  Andy chose "a couple of larger windows" over a row of small ones.

## For Agent 8 specifically
- This concept uses many more separate meshes than the ship budget allows
  (style guide: 1000 triangles, 4 meshes, 2 materials). In particular, the
  window frame bars are lots of small cylinders. Merge parts to fit the
  budget and keep the silhouette. A cheaper way to keep the windows
  readable is to make the glass a dark material instead of framing it in
  geometry, as long as it still sits flush on the hull.
- Add real materials and palette per `docs/STYLE-GUIDE.md`. Everything
  here is plain grey on purpose.
- No anchors are set (not this agent's job). You'll need `parking`, `eye`,
  `nose`, and `engineL`/`engineR` (one per nacelle) per the style guide.
- Useful technique in the viewer code: `hullNorm`, `onNose` and `onSide`
  snap any point exactly onto the hull skin. That's how all the windows
  are placed, and it keeps them correct if the hull shape changes.

## Known issues / notes for later
- None outstanding. Andy approved all rounds of feedback.

## Next
Moving on to **Passenger 3 (large)**.
