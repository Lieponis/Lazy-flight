# Passenger 3 — "Snoozemarine" (large)

Status: **APPROVED by Andy** (2026-11-28)

## Role & personality
The big interplanetary cruise liner: two decks of passengers, long routes,
nobody in a hurry.
One-line personality: a giant space submarine that drifts between planets
like a whale having a nap, with hundreds of passengers dozing at the
windows.

Category: Passenger. Size class: Large (3 of 3).

## Model files
- Viewer: `docs/concepts/ship-architect/passenger-3/viewer.html`
  (self-contained Three.js page; drag to rotate, pinch to zoom. Each part
  can be hidden or highlighted from the panel).
- Each part is a separate named object, all in one plain grey flat-shaded
  material. This model is for judging shape only.

## Parts (name, rough shape & position)
Local ship space: nose points -Z, tail +Z, up is +Y. The hull runs from
z -3.0 to +3.3 and is 1.0 wide and 0.8 tall, a long ratio of about 6:1.
Overall, including the pods and blades, the ship is about 6.8 long.

- **hull**: a "pure submarine" body. Every cross-section is a rounded
  rectangle (superellipse, exponent 4) with 64 segments, so it's smooth.
  - The **top deck is flat and level all the way to the stern**
    (y = 0.40).
  - Toward the tail **the belly rises** instead, like the tanker
    reference, so the tail end sits higher. The engine ring mounts on the
    blunt stern at z 3.3.
  - **Nose (shaped from Andy's own side-view sketch):** a long, sleek
    taper over z -3.0 to -1.15. Seen from the side, the top line curves
    gently down from the sail to a **low, rounded tip at y -0.2**, and the
    belly line rises more gently still. Seen from above, the nose stays
    broad. Each of the three lines (top, bottom, width) follows its own
    superellipse curve, with stations packed toward the tip. The exact
    numbers are in `NOSE` in the viewer code.
- **cockpitWindows**: a slim A350-style mask with 4 panes, set low on the
  sloping nose face (y ≈ 0 to 0.14, z ≈ -2.8 to -2.2). Its lower edge dips
  at the centre and curves up toward the sides. The glass is **flush**:
  at most 0.002 off the skin. A very slim frame tube (radius 0.006) is
  centred on the skin, and every glass edge is tucked under it.
- **windowRowsUpper**: the upper deck, a long row of **28 small rounded
  windows per side** (y ≈ 0.165, z -1.95 to +1.56).
- **windowRowsLower**: the lower deck, **7 large panoramic windows per
  side** (y ≈ -0.075, z -1.65 to +1.35, each about 0.38 long).
  - All passenger windows are wrapped flush onto the hull skin: glass
    about 0.004 off, with a thin frame tube centred on the skin.
- **xBlades**: 4 long, curved "scimitar" stabiliser blades in an **X**,
  taken from the dark-ship reference.
  - The leading edge curves back, and each blade tapers to a thin point
    behind the stern (root z 1.85–2.8, tip at about z 3.4). The
    cross-section is a lens shape.
  - **The X is centred 0.26 above the hull's middle** (Andy's choice), so
    the lower blades clear the landing pads by 0.085.
  - The roots are sunk just under the skin.
- **topFin**: one swept, curved fin on the top deck at the stern
  (root z 1.55–2.45, about 0.55 tall).
- **midFins**: two small swept fins low on the sides, halfway along
  (z ≈ -0.1 to 0.6), angled 15° down.
- **engines**: **8 hexagonal engine pods** in a ring around the stern.
  - They sit between the X blades, at 22.5° plus every 45°, and their
    fronts are buried in the stern.
  - Each pod has a hex housing, two raised hex bands, a hex intake cap at
    the front, a stepped hex exhaust nozzle and a round core.
  - A small tail cone fills the middle of the ring.
- **hullDetails**:
  - Transverse seams across the top deck.
  - A trim line between the two decks.
  - A keel strip under the belly.
  - Bow vent slats.
  - A boarding-door outline each side, behind the lower windows.
  - A small dorsal sail plus antenna mast (a nod to the submarine).
  - All the trim lines sit on the skin, half buried.
- **legs**: four short corner legs at z -1.9 and +1.5. Each is a main
  strut plus a brace, ending in a flat pad. All pads sit at y -0.66.

## What to keep when Agent 8 rebuilds this in the game's style
- **The side-view nose profile.** Andy drew it himself: a long taper from
  the sail to a low, rounded tip. Don't shorten it or make it blunt.
- The flat top deck running level to the stern, with the belly rising
  toward the tail.
- **All windows flush and wrapped onto the hull.** Andy asked for this
  explicitly, again, on this ship.
- Two decks: many small windows on the upper deck, a few big panoramic
  ones on the lower deck.
- The raised X of curved scimitar blades (Andy liked these on the dark
  ship), plus the top fin and the mid fins.
- 8 hexagonal pods in a ring, placed between the blades.

## For Agent 8 specifically
- **The budget is far over** (style guide: 1000 triangles, 4 meshes,
  2 materials). The concept has about 240 meshes and about 73k triangles,
  mostly from window frame tubes and the smooth hull. Suggestions:
  - Use dark-glass material on the hull instead of separate glass and
    frames.
  - Use a far coarser hull (about 16–20 ring segments, with fewer
    stations except at the nose).
  - Use simple 6-sided pods without separate bands.
  - Merge each part group.
- Add materials and palette per `docs/STYLE-GUIDE.md`. Everything here is
  plain grey on purpose.
- No anchors are set. You'll need `parking`, `eye`, `nose`, and engine
  anchors (maybe one shared `engine` at the ring's centre, about
  (0, 0.18, 3.6), since there are 8 pods).

## Known issues / notes for later
- None outstanding. Andy approved all rounds.
- The blades are about 15% shorter than first planned, to keep the
  raised X clear of the ground on short legs. Make them longer only if
  the legs get taller too.

## Next
Passenger line complete (Eggspress, Droopliner, Snoozemarine). Moving on to
**Cargo 1 (small)**.
