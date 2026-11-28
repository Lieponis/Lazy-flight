# Cargo 2 — "Haul Monty" (medium)

Status: **APPROVED by Andy** (2026-11-28)

## Role & personality
A medium cargo hauler. It's a proper space lorry for regular freight
runs: side doors for forklifts, roof hatches for cranes, and a rear ramp
for anything on wheels.
One-line personality: a big, patient freight truck that hauls the whole
lot, never rushes, and parks perfectly every time.

Category: Cargo. Size class: Medium (2 of 3).
Follows the cargo-line rules in `cargo-1.md`: industrial, more angular,
angular windshield, no passenger windows, cargo and pilot door outlines,
and everything flush.

## Model files
- Viewer: `docs/concepts/ship-architect/cargo-2/viewer.html`
  (self-contained Three.js page; drag to rotate, pinch to zoom. Each part
  can be hidden or highlighted).
- Each part is a separate named object, all in one plain grey flat-shaded
  material.

## Parts (name, rough shape & position)
Local ship space: nose points -Z, tail +Z, up is +Y. The cargo box is
1.3 wide and 1.0 tall, and runs from z -1.25 to 1.90. With the cab, the
box is 3.85 long, about 3:1. Including the engines, the ship is about
4.4 long.

- **hull**: the cargo box. It's the same flat-faced octagon language as
  Cargo 1: every section is a rectangle with 45° cut corners, so every
  face is flat. The belly slopes up over the last 0.55 to the stern (the
  ramp sits there).
- **cab**: a separate, lower and narrower cab module bolted onto the
  front of the box. Its back end is buried inside the box, so there's no
  gap. It has a small front face and a sloped windshield section.
- **cockpitWindows**: angular TNL-style panes in the cab's flat sloped
  faces.
  - A big trapezoid on the top slope.
  - One pane on each top cut-corner face.
  - A triangular pane high on each side.
  - Thick frames are flush with the face.
- **cabDetails**: a framed, slatted grille and two headlight boxes on the
  cab front, plus a raised collar band around the cab where it meets the
  box.
- **pilotDoors**: a door outline on each side of the box just behind the
  cab, with a handle and a step.
- **cargoDoorsSide**: a big double cargo door on each side
  (z -0.25 to 0.55). It has a centre seam, hinge blocks at both outer
  edges, two handles and a guide rail underneath.
- **armour**: shield panels. Four thick, bevelled armour plates are
  bolted to the box sides, two per side, one before and one after the
  cargo doors. Each has rows of bolt heads along its top and bottom
  edges, and its back is sunk into the side.
- **roof**:
  - Two cargo hatch outlines, each with a seam and handles.
  - **Two long roof rails on posts** (structural members).
  - A small sensor housing and an antenna.
- **cargoRamp**: the rear loading ramp outline on the sloped rear belly,
  with grip ribs and a hinge bar.
- **engines**:
  - **5 large round thrusters**: two at the top, one low in the centre
    and one in each lower corner (added from Andy's sketch).
  - They sit on a **wide mounting plate** covering nearly the whole rear
    face. The plate has big cut corners at the top, nearly square bottom
    corners, and a raised rim.
  - The plate is held **off** the rear face by an **exposed mount frame**
    (8 struts plus 4 diagonal braces). This is the structural member Andy
    chose.
  - Everything sits above the ramp.
- **stabilisers**: two angular fins (from Andy's sketch) on the **lower
  rear cut corners**.
  - They point straight out of those 45° faces, so from behind they angle
    down and outward.
  - From the side they're swept back, with the tip at the stern.
  - They have flat sides with bevelled edges, plus a stiffening rib on
    each face.
  - Each root goes through a bolted mounting plate on its cut corner.
  - They're mirror images, clear of the rear legs, with their tips above
    the pads.
- **legs**: 6 legs in three pairs along the belly (z -0.85, 0.15, 1.15),
  on the lower cut corners. Each has an upper strut, knee joint, actuator
  rod, lower strut and a flat pad. All pads are at y -0.80.

## What to keep when Agent 8 rebuilds this in the game's style
- The box + separate lower cab silhouette, with the collar where they
  join.
- Flat octagonal faces with everything flush: windows, doors, hatches,
  ramp.
- Bolted armour plates either side of the side cargo doors.
- **The 5-thruster wide plate on an exposed strut frame.** Andy redrew
  this himself.
- **The two rear chamfer stabilisers.** Also Andy's own addition, for
  extra detail.
- Roof rails, 6 legs.

## For Agent 8 specifically
- The budget is over (style guide: 1000 triangles, 4 meshes,
  2 materials). The concept has about 206 meshes and about 11k
  triangles. To fit:
  - Merge each group.
  - Use 12-segment thrusters.
  - Show the bolts and hinges as texture/normal detail, or drop them.
  - Use dark glass instead of separate panes.
- Add materials and palette per `docs/STYLE-GUIDE.md`.
- No anchors are set. You'll need `parking`, `eye`, `nose`, and engine
  anchors (for example, `engineL`/`engineR` on the lower corner
  thrusters).

## Known issues / notes for later
- None outstanding. Andy approved all rounds.

## Next
Moving on to **Cargo 3 (large)**.
