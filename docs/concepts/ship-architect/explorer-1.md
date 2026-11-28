# Explorer 1 — "Pocket Rocket" (small)

Status: **APPROVED by Andy** (2026-11-28)

## Role & personality
A small, agile scout for fast hops between systems: one pilot, a few
sensors, and a lot of enthusiasm.
One-line personality: a tiny, chunky arrowhead that zips off to look at
something new, then lazily drifts home to tell everyone about it.

Category: Explorer. Size class: Small (1 of 3).

## Andy's explorer-line rules (apply to all 3 explorer ships)
- **Explorer ships have wings.**
- **The body can act as a wing** (a lifting body).
- **Thrusters are part of the hull, as bulges**, not separate pods.
- **The cockpit is a canopy** or canopy-like.
- **Sci-fi as much as possible, with exotic shapes.** Don't rely only on
  basic shapes, and don't look like a real-life fighter. (Andy scrapped
  the first draft for looking too much like a real jet.)
- **Attention to detail, and no floating parts:** everything must attach
  to something.
- (Carried over:) not too low-poly, with windows and canopies flush.

Note on references: Andy's first reference set for this ship was a
protected film design (Pixar's XL-15 from *Lightyear*). That design was
**not** copied. This ship is an original design. The second reference
set was generic sci-fi fighter concept sheets.

## Model files
- Viewer: `docs/concepts/ship-architect/explorer-1/viewer.html`
  (self-contained Three.js page; drag to rotate, pinch to zoom. Each part
  can be hidden or highlighted).
- It's also in the all-ships gallery:
  `docs/concepts/ship-architect/gallery.html`.
- Each part is a separate named object, all in one plain grey flat-shaded
  material.

## Parts (name, rough shape & position)
Local ship space: nose points -Z, tail +Z, up is +Y.
- **Overall size:** about 2.4 wide × 0.8 tall × 2.6 long.
- **Body:** 1.24 wide × 0.45 thick × 2.2 long.
- **Length squash:** every part except the legs is built at full length
  and then squashed to **72% along Z** (`LEN` in the code). The legs are
  built afterwards at the squashed positions, so their round parts stay
  round.

- **hull**: a **faceted arrowhead lifting body**.
  - Each cross-section has 12 corners: a blunt, thick side edge, an upper
    chine, a flat raised spine, a lower chine and a keel. The faces
    between them are flat.
  - In plan view it's an arrowhead: a knife-sharp nose that widens to the
    wing roots and cuts in again at the rear.
  - Andy asked for it shorter, fatter and smaller than the first v2
    draft, so it's thick and chunky.
- **engines**: **hexagonal engine bulges** that are part of the hull:
  - Two on the upper body (x ±0.3) and one smaller bulge on the spine.
  - Each rises out of the body with its front buried, runs past the rear
    edge, and ends in a **stepped hexagonal nozzle**: outer flare, inner
    lip, recessed throat and centre core.
  - Each has a raised hex band. The side bulges also have a thin strake
    along their outer side.
- **wings**: **cranked and faceted**, with a **notched trailing edge** at
  the crank.
  - The outer panel sweeps back harder and starts with a shorter chord.
  - The inner panel's root follows the body edge.
  - **The wings are thick:** 0.18 at the root, 0.15 at the crank and 0.09
    at the tip. Andy asked twice for thicker wings. The body's side edge
    is made just as thick so the wings flow out of it with no step.
  - A raised strip runs behind each inner leading edge, sunk into the
    wing.
- **tipPlates**: tall vertical plates at the wing tips, reaching above
  and below the wing. These replace a tail (Andy's choice).
- **canopy**: a faceted, six-sided canopy on the spine with flush feet,
  frame bars along every facet edge, and two cross bows.
- **explorerKit**:
  - Forward sensor rods on the tip plates, each with a mount and a tip.
  - A long nose probe with two sensor collars.
  - A faceted chin sensor.
  - A six-sided belly camera pod with a lens, tucked close under the
    belly on a short pylon.
- **hullDetails**:
  - Raised trim lines along the upper chines and spine edges, which
    emphasise the facets.
  - Vent slats angled to the outer facets.
  - Two antennas on the dorsal bulge.
  - Hex plugs on the nose.
- **legs**: **short tricycle gear**: one nose leg and two main legs
  under the body sides.
  - Andy asked for shorter legs, then legs 1.5x thicker.
  - Each leg has round struts, a knee joint, an actuator and a hex pad.
  - All pads are level.

## What to keep when Agent 8 rebuilds this in the game's style
- **Faceted arrowhead lifting body, chunky.** It is not a jet-fighter
  fuselage.
- **Thick wings that flow out of an equally thick body edge.**
- **Hexagonal engine bulges and stepped hex nozzles.** No round
  jet-engine look.
- The cranked wing with the trailing-edge notch, and the vertical tip
  plates.
- **Short, thick legs.**
- **No floating parts.**

## For Agent 8 specifically
- The budget is over (style guide: 1000 triangles, 4 meshes,
  2 materials). The concept has 133 meshes and about 4.7k triangles.
  The body, wings and bulges are already low-poly (hexagons and facets).
  Merge the groups, and drop or texture the small trims and slats.
- Add materials and palette per `docs/STYLE-GUIDE.md`. Dark glass on the
  canopy.
- No anchors are set. You'll need `parking`, `eye` (canopy), `nose`,
  `engineL`/`engineR` (side bulge nozzles), plus the dorsal nozzle.

## Known issues / notes for later
- None outstanding. Andy approved all rounds.
- An automated **attachment check** now runs on every ship before it's
  shown. It tests every mesh and confirms it touches or sits inside
  another one. This ship passes for all 133 parts.

## Next
Moving on to **Explorer 2 (medium)**.
