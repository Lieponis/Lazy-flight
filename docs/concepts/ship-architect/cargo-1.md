# Cargo 1 — "Crate Expectations" (small)

Status: **APPROVED by Andy** (2026-11-28), first draft accepted as-is.

## Role & personality
A small cargo hauler: the space delivery van. It runs short trips with a
few crates and backs up to the dock to drop its ramp.
One-line personality: a stubby, dependable little box that has never been
in a hurry and has never lost a parcel.

Category: Cargo. Size class: Small (1 of 3).

## Andy's cargo-line rules (apply to all 3 cargo ships)
- **More industrial** than the passenger ships.
- **A little more angular** than the passenger ships.
- **Angular windshields.**
- **No passenger windows.**
- **Cargo door and pilot door outlines.**
- (Carried over from the passenger line:) not too low-poly, plenty of
  detail, and everything set into the hull sits **flush**.

## Model files
- Viewer: `docs/concepts/ship-architect/cargo-1/viewer.html`
  (self-contained Three.js page; drag to rotate, pinch to zoom. Each part
  can be hidden or highlighted).
- Each part is a separate named object, all in one plain grey flat-shaded
  material.

## Parts (name, rough shape & position)
Local ship space: nose points -Z, tail +Z, up is +Y. The hull is 1.0 wide,
0.8 tall and 2.15 long (z -1.10 to +1.05), about 2.2:1 ("van-like"). With
the engine block and nozzles, the ship is about 2.6 long.

- **hull**: a chamfered box pod (escape-pod style). Every cross-section is
  an **octagon**, a rectangle with **45° cut corners**. Because every cut
  is exactly 45°, the matching edges of neighbouring sections are
  parallel, so **every hull face is perfectly flat**. That's what lets
  panels sit truly flush.
  - The five sections (`ST` in the code) run:
    - Small front face (S0).
    - Windshield slope (S1 to S2).
    - Full box (S2 to S3).
    - Belly sloping up to the stern (S3 to S4).
- **cockpitWindows**: TNL-style angular panes set into the flat sloped
  faces between S1 and S2.
  - A big trapezoid on the top slope.
  - One pane on each top cut-corner face.
  - A triangular pane high on each side.
  - Thick angular frames sit centred on the face, flush, with the glass a
    hair off the face inside them.
- **frontFrame**: a raised hexagonal frame on the front face (TNL), with a
  grille plate and three horizontal bars.
- **bands**: two thick raised octagonal bands around the box (escape-pod
  style), at z ≈ -0.05 and 0.50. They are offset evenly on every face.
- **pilotDoors**: a door outline on each side behind the cockpit
  (z -0.45 to -0.14), with a handle and a fold-out step.
- **vents**: a framed, slatted grille on each side between the bands.
- **pipes**: two conduits per side that leave the hull, run along the
  lower side between the bands, and dive back in.
- **cargoRamp**: the rear loading ramp outline on the sloped belly face
  (x ±0.30, z 0.60–1.01), with four grip ribs and a hinge bar along the
  back edge.
- **engineBlock**: a chamfered octagonal block bolted onto the upper rear
  face, carrying **4 round thrusters in a 2x2 square** (Mababibop style).
  Each thruster is a closed lathe profile with a flared bell and recessed
  core, plus a ring band. The block's rear face has a raised rim.
- **bellyThrusters**: two round thruster pods slung under the belly
  (x ±0.24), pointing back. Each has a nose cone, two bands and a flared
  nozzle, and its top is sunk into the belly.
- **roofDetails**: a low equipment housing with a lid, and an antenna.
- **legs**: tricycle landing gear, **symmetric to the hull** (Andy's
  request).
  - One nose leg on the centreline and two main legs mirrored at the
    back.
  - The main legs sit outside the ramp, so cargo can roll out.
  - Each leg has an upper strut, knee joint, actuator rod, lower strut
    and a flat pad.
  - All pads are at y -0.70.
- No fins (Andy's choice).

## What to keep when Agent 8 rebuilds this in the game's style
- The flat-faced octagonal "chamfered box" language. It's the cargo
  line's angular, industrial signature compared with the smooth passenger
  ships.
- The TNL-style angular windshield panes with thick frames, flush.
- The hex front frame, the two raised bands, and the 2x2 thruster block.
- The ramp on the sloped rear belly, with the main legs placed outside it.

## For Agent 8 specifically
- The budget is over (style guide: 1000 triangles, 4 meshes,
  2 materials). The concept has 89 meshes and about 8k triangles. It's
  much closer than the passenger ships, because the hull is only
  64 triangles. To fit:
  - Merge the groups.
  - Use 10–12 segments for the round thrusters.
  - Use dark glass instead of separate glass panels.
- Add materials and palette per `docs/STYLE-GUIDE.md`.
- No anchors are set. You'll need `parking`, `eye`, `nose`, and engine
  anchors (`engineL`/`engineR` could map to the left and right thruster
  columns).

## Known issues / notes for later
- None. Approved at first draft.

## Next
Moving on to **Cargo 2 (medium)**.
