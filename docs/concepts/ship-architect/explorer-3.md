# Explorer 3 — "Halo There" (large)

Status: **APPROVED by Andy** (2026-11-28)

## Role & personality
The flagship explorer: long-range, deep-space, with a big halo ring
humming away behind the cockpit.
One-line personality: a serene arrow inside a giant halo that drifts out
to the edge of the map, says "oh, hello there" to whatever it finds, and
cruises on.

Category: Explorer. Size class: Large (3 of 3).
Follows the explorer-line rules in `explorer-1.md`: wings, lifting body,
exotic sci-fi, details, no floating parts. Here the **halo ring is the
main thruster.** It's part of the hull structure, not a separate pod.

Andy's choices for this ship:
- An arrowhead lifting body with angled flush windows.
- A **tri-star wing layout**: three arrowhead blades, one up and two down
  and out.
- A **huge halo-thruster ring around the body** on the wing tips.
- It **parks nose-down**, resting on the ring stands plus a short nose
  leg.

Note on references: Andy's references included protected film designs
and copyrighted concept art. **None of them was copied.** Only general
ideas (three wings, a ring, arrow-like wings) were used, in an original
design.

## Model files
- Viewer: `docs/concepts/ship-architect/explorer-3/viewer.html`
  (self-contained Three.js page; drag to rotate, pinch to zoom. Each part
  can be hidden or highlighted).
- It's also in the all-ships gallery:
  `docs/concepts/ship-architect/gallery.html`.
- Each part is a separate named object, all in one plain grey flat-shaded
  material.

## Parts (name, rough shape & position)
Local ship space, built **level** (the flight pose): nose -Z, tail +Z,
up +Y. The body runs from z -2.6 to 1.8. **Overall size is about
2.9 × 2.9 × 4.6** (ring diameter × length).
At the end of the code the whole ship is tilted **20° nose-down**
(`PARK_PITCH`) into its parked pose, and then stood on the ground.
**For flight, use rotation 0.**

- **hull**: an arrowhead lifting body in the same 12-corner faceted
  family as Explorers 1–2. It's flatter, with a long, sharp nose. Over the
  cockpit stretch, the drop from spine to chine is kept proportional to
  the width, so the window facets are flat.
- **haloRing**: a **huge ring around the body**, centred on the body's
  axis.
  - Inner radius 1.25, outer radius 1.44. It spans z 0.82 to 1.62.
  - Its 8-corner faceted section has an intake lip at the front and a
    wide exhaust face at the back.
  - Thruster detail:
    - A raised intake rim at the front.
    - Inner and outer exhaust rims, with **48 exhaust vanes** on the rear
      face.
    - **18 raised ribs** segmenting the outer skin.
- **wings**: **tri-star arrowhead blades** at 90°, 210° and 330°.
  - Each root is sunk into the body skin along its chord.
  - The leading edge sweeps hard back, and each blade tapers to a point
    that runs **into the ring**.
  - There's a clamp collar at the ring and a raised spar strip along each
    blade.
- **cockpitWindows**: flush angled windows in the nose facets: a two-pane
  windshield on the spine plus an angled pane each side.
- **hullDetails**:
  - Raised chine trims.
  - A crew hatch.
  - Two framed vent grilles.
  - Three small hex attitude nozzles set into the stern.
  - A nose sensor plug and two antennas.
- **landing**, in the parked pose:
  - **Two rear stands** (from Andy's sketch). Each is a **flat pad lying
    level on the ground**, with a **triangle of two struts** from the
    pad's front and back ends up to an anchor block on the ring, plus a
    cross brace.
  - The stands are **short, so the ring almost touches the ground**
    (0.035 above it). This was Andy's request.
  - A **short, thick nose leg** (0.43 tall), with its top inside the belly
    under the nose.
  - All three pads are exactly flat on the ground.
  - The nose tip stays 0.09 clear.

## What to keep when Agent 8 rebuilds this in the game's style
- **The huge halo ring around the body is the identity**, and it's the
  ship's thruster.
- Tri-star arrowhead blades whose points run into the ring.
- The arrowhead lifting body with flush angled windows.
- **The parked pose is nose-down** on two short triangle stands at the
  ring and a short nose leg. In flight it is level. Andy specifically
  wanted short stands and short legs.

## For Agent 8 specifically
- The budget is over (style guide: 1000 triangles, 4 meshes,
  2 materials). The concept has 138 meshes and about 5.6k triangles.
  - The ring can drop to about 24–32 segments.
  - Vanes and ribs can go into texture, or into a few merged meshes.
  - Merge the groups.
- Add materials and palette per `docs/STYLE-GUIDE.md`. The ring's exhaust
  face is the obvious place for an emissive glow.
- No anchors are set. You'll need `parking`, `eye`, `nose`, and engine
  anchors, for example a single `engine` at the ring centre (0, 0, 1.6),
  or several around the rear face.
- **The parked tilt and landing gear are built in code** from
  `PARK_PITCH`, so flight and parked poses come from the same model.

## Known issues / notes for later
- None outstanding. Andy approved after rounds that shortened the rear
  stands and gave them flat pads.
- Every part passes the attachment check (138/138).

## Next
All 9 ships are done. See `docs/report-agent-9.md`.
