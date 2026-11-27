# Passenger 1 — "Eggspress" (small)

Status: **APPROVED by Andy** (2026-11-28)

## Role & personality
A small passenger shuttle — short local hops, a couple of passengers at a time.
One-line personality: a cheerful little egg that waddles into orbit with barely a wobble.

Category: Passenger. Size class: Small (1 of 3).

## Model files
- Viewer: `docs/concepts/ship-architect/passenger-1/viewer.html`
  (self-contained Three.js page — open it directly in a browser, drag to
  rotate, pinch to zoom; each part below can be hidden or highlighted from
  the panel at the bottom).
- Built as separate, clearly named objects per part (see below), one plain
  grey flat-shaded material throughout — shape only, no colour/material
  decisions made here.

## Parts (name, rough shape & position)
All positions are local to the ship's own origin (ship nose points -Z, tail +Z, up is +Y).

- **hull** — egg-shaped body, a lathed profile (narrower/pointier nose at
  -Z, fuller/rounder tail at +Z). Object-space extent roughly z: -1.15 to
  +1.22, scaled (0.95, 0.92, 0.72) on (x, y, z) — i.e. slightly flattened
  front-to-back, egg (not perfectly round) end-to-end.
- **cockpitWindow** — one big round visor bulging from the nose. A sphere
  (radius 0.5, flattened ~0.82 on the depth axis), centred at roughly
  (0, 0.03, -0.52), mostly embedded in the hull with the front dome poking
  out. Has a thin raised ring right where it meets the hull.
- **wingL / wingR** — small simple tapered wings (flat-ish, thin, swept
  back, narrowing toward the tip), root near the hull at about z = 0.15,
  spanning out to about 0.8 units, each set at **25° from horizontal, tips
  angled down and outward** (an "A" shape seen from the front, not a V).
  The vertical stabiliser below is sized to match these.
- **topFin** — a single vertical fin on the centreline (x = 0), same size
  as the side wings, standing straight up with **no angle** — it's the
  same wing shape just rotated to point up instead of sideways.
- **engineL / engineR** — two nozzle-shaped thrusters near the tail
  (around z = 0.78, mirrored left/right). Each is a lathed profile: narrow
  where it meets the hull → bulging "combustion chamber" → necked throat →
  wide flared exhaust bell, plus two greeble ribs (at the neck and throat),
  four small radial vanes spaced evenly around the flare, and a raised rim
  at the exhaust face. Both ends of the lathe shape are capped (a lathe
  profile that never touches its own axis is hollow at both ends unless
  you close it — learned this the hard way when the exhaust looked
  invisible from behind).
- **legs** — three-point "tricycle" landing gear, like a small plane: one
  nose leg on the centreline well forward (~z = -0.58), two main gear
  mirrored left/right at the back (~z = 0.42). Each leg: upper strut +
  knee joint (sphere) + a thin side actuator rod + lower strut + a foot
  pad. The strut attachment points start **inside** the hull (not just
  touching its surface) so there's no gap at the join. All three foot pads
  are set to the exact same height (one common plane), so the ship sits
  level. Struts and pads were sized up (2x) from the first draft per
  Andy's feedback — they read as sturdy, not spindly.

## What to keep when Agent 8 rebuilds this in the game's style
- The egg proportions (narrower nose, fuller tail) and the overall size
  relationships between parts — don't re-balance these without checking
  with Andy first.
- The window's dominance of the nose (it's meant to be the ship's main
  visual "face") and its embedded-not-floating attachment.
- The wings' 25° tips-down angle and that the top fin matches their size
  but stays vertical/unangled — this combination was specifically chosen
  after two rounds of back-and-forth, not an arbitrary choice.
- The tricycle leg layout (one front + two back, mirrored, common foot
  height) — Andy was explicit that a 3-leg tripod at arbitrary angles
  "didn't make sense" next to the ship's left/right symmetry; this layout
  does.
- The engine nozzle's stepped profile (bulge/neck/throat/flare) and its
  greebles (ribs, vanes, rim) — this read as "sci-fi" to Andy versus the
  earlier plain tapered-cone version.
- Flat shading / faceted low-poly look is intentional, not a placeholder
  to be smoothed away.

## For Agent 8 specifically
- This concept model uses more separate meshes per part than the ship
  budget allows (style guide: 1000 triangles, 4 meshes, 2 materials per
  ship) — it was built this way so Andy could toggle/highlight individual
  pieces during review. You'll need to merge meshes (e.g. all the leg
  pieces, all the engine greebles) down to fit the mesh budget while
  keeping the silhouette.
- Add real materials/palette per `docs/STYLE-GUIDE.md` (paintWhite,
  paintGrey, metalDark, underside, dark glass for the cockpit window) —
  everything here is one flat grey on purpose, for silhouette review only.
- No anchors were set on this concept model (not this agent's job) —
  you'll need `parking`, `eye`, `nose`, `engineL`/`engineR` per the style
  guide's anchor list.

## Known issues / notes for later
- None outstanding — all of Andy's rounds of feedback on this ship were
  addressed and approved.

## Next
Moving on to **Passenger 2 (medium)** — first message to Andy asking for
references, per the brief.
