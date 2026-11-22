# Agent 3o brief: three visual annoyances (Andy 2026-11-22)

Build on CURRENT main. One step at a time with Andy (Step N of M / DO max 3 / LOOK FOR / REPLY WITH). Visual work: A/B/C options, Andy answers "matches / does not match". Lean, save Andy's usage. No new features; suggestions labelled "suggestion". Never touch save data. Tests stay green.

## 1. Outposts stand on the white ice pole (docked view and floating view)
Andy: many planets have white ice caps; docked at an outpost he sees mostly white.
Lead's finding: the outpost ground is a big ball whose TOP is under the pad (docked.ts buildOutpostScene, flight.ts ~949 floating ground, makePlanetMesh extras.outpostGround). Only Earth-likes are turned (coastSpot in planetlook.ts) so the top is a coast; every other planet keeps its pole at the top, and caps start at |ny| above 0.75 to 0.9 (CAP_TYPES, planetlook.ts ~215, ~285).
Wanted: for EVERY planet type, turn the ground pattern so the pad sits on a normal, non-ice spot (mid latitude, away from caps, ideally land and not sea where the planet has land). Same planet id gives the same spot on every device (pick from the planet's hash, no randomness). ICE-type planets stay icy but not pure-white-only if the planet has other colours. Planet seen from space and in the system view stay as they are (caps still show there).
Check: a test that for many planet ids the spot under the outpost is not a cap.

## 2. Stations should visibly orbit while docked
Andy: standing in a station you should see slow movement of the planet below (a station circles its planet).
Lead's finding: buildStationScene (docked.ts ~289) puts a still planet ball under the slot; nothing moves. The system view already circles stations.
Wanted: the planet seen through the slot and below the station turns slowly (a gentle, steady glide, clouds a touch faster if cheap), so it clearly feels like orbiting. Keep it calm and child friendly (about one full turn in several minutes is plenty; Agent decides, shows 2-3 speeds A/B/C). Stars/sky stay still. No motion sickness: no camera shake.
Also check that the planet is not always showing the pole at the slot (turn the pattern so the view is mostly the planet's body, not an ice cap).

## 3. Warp and flight sky must match the real direction
Andy: in warp and flight you always see the same angle of the universe. Flying toward the galactic centre should show the centre ahead; flying toward the rim should show the rim ahead. Today it makes no sense.
Lead's finding: the faint galaxy sky is drawn from the flight's sky system with a fixed orientation (systemsky.ts, skylayer setPosition) and the ship flies along a fixed in-scene line, so the two are not tied together. Warp (warp.ts, warpmath.ts) has the same problem.
Wanted: tie the scene's flight direction to the REAL galactic direction from the origin system to the destination system: rotate the sky layer (or the flight line) so what is ahead of the ship is what lies in that direction. Same for the warp tunnel/backdrop (it can stay simple: the sky ahead = destination side, behind = origin side). Same system/same trip gives the same picture. Docked and floating views keep their sky as now. Test: for a trip toward the centre vs toward the rim the sky "ahead" differs; for a short hop the direction is stable.
Check Andy's eye test with 2 trips: one towards the centre, one outward.

## DO / REPLY
Do the three in this order (1, 2, 3), push each to main when Andy says "matches", Build and publish green.
REPLY WITH (max 10 lines per item): what changed, live link, what Andy should look at.
