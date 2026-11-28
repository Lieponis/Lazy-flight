# Explorer 2 — "Wanderwedge" (medium)

Status: **APPROVED by Andy** (2026-11-28), first draft accepted.

## Role & personality
A medium explorer for a small crew. It's a long-range surveyor with a
proper cockpit, a crew hatch and a sensor mast.
One-line personality: a broad, comfy wedge that wanders off the map for
weeks, takes a lot of pictures, and is never in a rush to come back.

Category: Explorer. Size class: Medium (2 of 3).
Follows the explorer-line rules in `explorer-1.md`: wings, lifting body,
thrusters as hull bulges, exotic sci-fi, details, no floating parts.
**Exception Andy set for this ship:** the cockpit is **angled windows,
not a canopy**.

Andy's specifics for this ship:
- Thick, tapered, five-cornered (pentagonal) wings.
- Five-cornered front canards.
- 4 thrusters.
- A cockpit made of angled windows.
- A sleek, angular nose.

He then chose:
- One wide lifting body.
- The 4 thrusters in a row.
- The canards beside the cockpit.
- No fins and 4 legs.

## Model files
- Viewer: `docs/concepts/ship-architect/explorer-2/viewer.html`
  (self-contained Three.js page; drag to rotate, pinch to zoom. Each part
  can be hidden or highlighted).
- It's also in the all-ships gallery:
  `docs/concepts/ship-architect/gallery.html`.
- Each part is a separate named object, all in one plain grey flat-shaded
  material.

## Parts (name, rough shape & position)
Local ship space: nose points -Z, tail +Z, up is +Y. Overall size is
about 3.4 wide × 1.1 tall × 4.05 long (including the nose probe and
nozzles). The body is 1.68 wide × 0.58 thick × 3.4 long.

- **hull**: a wide faceted lifting body, in the same 12-corner section
  family as Explorer 1.
  - Each section has a thick blunt side edge, upper chines, a flat raised
    spine, lower chines and a keel.
  - It has a long, sleek, angular nose.
  - **Over the cockpit stretch (z -1.3 to -0.3), the drop from spine to
    chine is kept exactly proportional to the width**, so the facets there
    are perfectly flat and the windows sit flush.
- **cockpitWindows**: angled flat windows set into those facets:
  - A sloped two-pane windshield on the spine (split by a centre post).
  - An angled pane on each upper chine facet beside it.
  - A second row of angled side panes behind.
  - Thick frames.
  - Measured against the hull, the frames are 0.007 proud and the glass is
    within 0.002 of the surface.
- **wings**: thick, tapered, **five-cornered slabs**. The five corners
  are:
  1. root front
  2. leading-edge kink
  3. outermost tip corner
  4. trailing-edge corner
  5. root rear
  - The root sits just inside the body edge.
  - **Thickness runs from 0.22 at the root to 0.08 at the tip.**
  - The edges are bevelled all round, and there are two raised panel
    strips on top.
- **canards**: smaller five-cornered slabs, low on the sides beside the
  cockpit (z -1.28 to -0.64), with their roots sunk into the body edge.
- **engines**: **4 hexagonal thruster bulges in a row**.
  - The inner pair (x ±0.22) sits higher, following the spine. The outer
    pair (x ±0.6) sits lower, on the shoulders. All four stand clearly
    out of the body.
  - Each ends in a stepped hex nozzle with a raised band, the same family
    as Explorer 1.
- **hullDetails**:
  - Raised trims along the chines and spine edges.
  - A crew hatch outline on the spine.
  - Framed shoulder vent grilles with slats.
  - A dorsal sensor mast with a small dish.
  - A six-sided ventral sensor blister.
  - A nose probe with two collars.
- **legs**: 4 short, thick legs (a front pair and a rear pair) with round
  struts, knee joints, actuators and hex pads. All pads are level.

## What to keep when Agent 8 rebuilds this in the game's style
- Five-cornered thick wings and five-cornered canards. These are Andy's
  signature for this ship.
- The angled-window cockpit set flush into flat nose facets. Not a
  canopy.
- 4 hex bulges in a row, inner pair high and outer pair low.
- The wide, thick faceted lifting body and sleek angular nose (a family
  resemblance with Explorer 1).

## For Agent 8 specifically
- The budget is over (style guide: 1000 triangles, 4 meshes,
  2 materials). The concept has 104 meshes and about 3.5k triangles.
  Merge the groups, and texture the trims and slats.
- Add materials and palette per `docs/STYLE-GUIDE.md`.
- No anchors are set. You'll need `parking`, `eye` (behind the
  windshield), `nose`, and engine anchors (the outer bulges as
  `engineL`/`engineR`).

## Known issues / notes for later
- None. Approved at first draft. Every part passes the attachment check
  (104/104).

## Next
Moving on to **Explorer 3 (large)**, the last of the nine.
