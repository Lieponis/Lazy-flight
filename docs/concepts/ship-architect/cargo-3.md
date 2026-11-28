# Cargo 3 — "Stacks McGee" (large)

Status: **APPROVED by Andy** (2026-11-28)

## Role & personality
The big container carrier. It does long-haul bulk freight, with its
containers out in the open and clamped into a heavy frame. The captain
sits up high at the back, watching the whole load.
One-line personality: a giant, unbothered space barge that stacks the
boxes, puts its feet up, and cruises.

Category: Cargo. Size class: Large (3 of 3).
Follows the cargo-line rules in `cargo-1.md`. Andy's extra rules for this
ship:
- Exposed cargo containers.
- A complex hull shape, not a simple rectangle.
- 2 front thrusters plus 6 rear thrusters, not round.
- Lots of structural detail.
- The cockpit at the back, lifted above the cargo for a good view, and
  connected to the hull.

## Model files
- Viewer: `docs/concepts/ship-architect/cargo-3/viewer.html`
  (self-contained Three.js page; drag to rotate, pinch to zoom. Each part
  can be hidden or highlighted).
- Each part is a separate named object, all in one plain grey flat-shaded
  material. Containers and frames are baked into fewer meshes, so the
  viewer stays fast.

## Parts (name, rough shape & position)
Local ship space: nose points -Z, tail +Z, up is +Y. Overall size is about
2.5 wide (including the rear thruster arms), about 2.2 tall (to the
bridge masts) and about 5.6 long.

- **hull** (C-frame spine, Kulgata style). All pieces are flat-faced
  octagon sections with 45° cut corners.
  - Top beam along the whole length (y ≈ 0.5–0.74).
  - It wraps down at the front into a heavy **front post** with an angled
    front face (z -2.42 to -2.02).
  - It runs back underneath as the **keel**.
  - A central web wall fills the space between beam and keel.
- **engineSection**: a heavy angular stern block that the beam and keel
  run into. It tapers to the rear and has a sponson on each side where
  the thruster arms attach.
- **containers**: **24 exposed containers**, stacked 2 wide by 2 high on
  each side of the spine and **6 long**. Each has corrugation ribs on the
  long sides, ribs on top, locking bars on the door end and corner
  castings.
- **frames** (structural), at every gap between containers on both sides:
  - A floor rib under the stack.
  - An outer upright post.
  - A clamp strap over the top, back to the beam.
  - A diagonal brace up from the keel.
  - Long top and bottom rails also join all the outer posts.
- **frontThrusters**: 2 rectangular grille pods.
  - They sit below container level and out to the sides, pointing
    forward. Andy moved them there himself.
  - Each hangs on **"two-cornered" structural arms**, one per clamp band:
    the arm comes straight out of the side of the front post, bends down
    and outward, then bends again and runs straight into the pod. There
    are joint blocks at both bends.
- **rearThrusters**: 6 rectangular grille pods, **3 per side**, stacked
  on a mounting rack.
  - Each rack is carried out from the sponson by an upper arm and a lower
    arm, with a diagonal brace and X-bracing.
  - Pod design, front and rear alike:
    - An angular octagon housing with a tapered intake.
    - A raised band and side vent slats.
    - A thick rim on the exhaust end, with a recessed plate, five grille
      slats and a centre divider.
- **neck**: a thick, angular, slightly forward-leaning pylon.
  - Its bottom is buried in the engine section and its top in the
    bridge, so it's **connected to the hull** (Andy's rule).
  - It has two side gusset braces, a rear brace and a conduit pipe.
- **bridge**: the raised cockpit at the back, about 1.3 above the
  container tops, overhanging forward for a view over the cargo. It has
  a roof equipment box and two antenna masts.
- **cockpitWindows**: angular panes all round the bridge's sloped front:
  - the front face, the sloped top and both top cut corners,
  - both sides of the front section,
  - plus three angled side windows each side.
  - All flush.
- **hullDetails**:
  - Panel outlines and small boxes along the top beam.
  - Conduit pipes down both sides of the beam.
  - A framed front plate with three lights and a bumper bar on the front
    post.
  - A big framed grille with slats on the stern.
- **legs**: 8 short, thick legs in four pairs (the last pair under the
  engine section).
  - The round upper strut and actuator angle out from the keel to a round
    knee joint.
  - The **lower strut is rectangular and drops straight down**, with its
    flat end sunk 0.01 into the pad so there's **no gap** (Andy's
    request).
  - All pads are level at y -0.405.

## What to keep when Agent 8 rebuilds this in the game's style
- **The C-frame spine with exposed container stacks on both sides.**
  It's the ship's identity.
- **The raised rear bridge on a thick neck that is visibly part of the
  hull.**
- **Front thrusters low and out on two-cornered arms** (Andy repositioned
  them himself).
- **Rectangular grille pods** (no round thrusters on this ship): 3 per
  side at the rear on arm-mounted racks.
- Bulkhead frames between containers. They're what make it read as
  "structural".
- **Leg spec from Andy:** short and thick, with only the lower strut
  rectangular, vertical and flush on the pad. The rest is round.

## For Agent 8 specifically
- The budget is far over (style guide: 1000 triangles, 4 meshes,
  2 materials). The concept has about 330 meshes and about 32k
  triangles. Suggestions:
  - Containers as plain boxes with a texture for the ribs and bars, and
    container colours done as a palette or vertex colours.
  - Frames merged into one mesh.
  - Simpler pods with the grilles done in texture.
- Add materials and palette per `docs/STYLE-GUIDE.md`. Containers are
  the obvious place for colour variety (the Kulgata reference).
- No anchors are set. You'll need `parking`, `eye` (on the bridge),
  `nose`, and engine anchors (rear pods; maybe `engineL`/`engineR` at
  each rack's centre).

## Known issues / notes for later
- None outstanding. Andy approved all rounds.

## Next
Cargo line complete (Crate Expectations, Haul Monty, Stacks McGee).
Moving on to **Explorer 1 (small)**.
