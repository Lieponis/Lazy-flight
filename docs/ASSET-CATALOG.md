# Asset catalog

The list of every ship, outpost and station design. Rule: an asset the game uses is here AND in `src/render/assets/registry.ts`.
Statuses: REQUESTED, DRAFT, APPROVED, INTEGRATED. Sizes are in crate units (see docs/STYLE-GUIDE.md).

## Ships (stage S1)
All ships: nose to -Z, up +Y, origin = `parking` (ground point between the feet). Anchors: `parking` (ground contact), `eye` (cockpit camera, looks forward -Z), `nose` (front tip), engine anchors at the exhaust, pointing backwards (+Z). Flames grow backwards from the exhaust.

| ID | Name | Role | Description | Funny detail | Triangles | Size W x H x L | Engine anchors | Status |
|---|---|---|---|---|---|---|---|---|
| cargo-hauler | Cargo Hauler | Goods | Wide, flat hauler with a big multi-pane cockpit, cargo hidden inside, two engine pods, orange company marks (Asp Explorer feel) | none (Andy: no funny touches on ships) | 568 | 6.4 x 1.9 x 6.5 | engineL, engineR | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy, revision 1) |
| passenger-liner | Passenger Liner | Passengers and tours | Long, grand white liner with a raised top deck, eight lit windows each side, blue company stripe, swept tail fin, wide engine bank (Dolphin + Orca feel) | none | 684 | 5.2 x 2.8 x 7.0 | engineL, engineR | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy, revision 1) |
| scout | Scout | Scanning and exploring | Small, angular grey explorer with two dark side pods, short swept fins, teal company marks and one big engine (Diamondback Explorer feel) | none | 540 | 4.5 x 1.4 x 4.1 | engineMain | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy, revision 1) |

## Outposts (stage S2)
All outposts: origin = landing pad centre on the ground, up +Y, buildings on the +X side, doors face the pad (-X). Pad 9 wide, pad top at y 0.34. Planet colour (tint) goes only on the ground plate and dust piles (`tint` = planet primary colour, made safe). Anchors: `parking` (pad centre, top of the deck), `beacon` (red blinking light), `entrance` (outside the main door, facing the pad). Animation: pad lights blink in two groups, the beacon blinks with group A. Picked per dock by `pickOutpostVariant(dockId, planetType)`.

| ID | Name | Look | Description | Funny detail (subtle) | Triangles | Size W x H x L | Status |
|---|---|---|---|---|---|---|---|
| outpost-depot | Supply Depot | rugged, medium | Patched steel octagon pad. Dusty yard with a worn hangar (rust patches), two fuel tanks (one rusty), crates and a small control tower | A crooked mailbox by the pad | 748 | 19.6 x 4.9 x 14.0 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy) |
| outpost-domes | Dome Habitat | clean, medium | White domes with a ring of lit windows, a dark glass greenhouse, a small living dome, an airlock; round pad with a yellow ring and eight lights | Laundry drying on a line | 920 | 22.1 x 5.5 x 14.2 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy, revision 1) |
| outpost-comms | Comms Station | clean, small | One module, a big dish facing the sky, a tall mast with the beacon, two solar panels; pad painted on the dust (white square, yellow cross) with four flag poles and lights | A deck chair facing the dish | 544 | 18.9 x 7.0 x 10.6 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy, revision 1) |
| outpost-hub | Passenger Hub | clean, large, sci-fi | Dark glass dome concourse with cyan light bands, a glass tube walkway to one big pad (10.4 wide, cyan glow ring), a holo-style sign and a transit tube running off to the city | A forgotten suitcase by the walkway | 1048 | 22.4 x 7.3 x 17.5 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy, revision 1) |

## Stations (stage S3)
All stations: origin = station centre, up +Y. An Elite-style docking slot in the front face (looks to -Z); the bay is a closed room inside, 11 wide, 6.5 tall, 13 deep. The ship parks on the bay floor with its nose towards the slot. Andy chose "camera goes inside": Agent 3 moves the docked camera into the bay. Anchors: `parking` (bay floor centre, ship ground point), `dockEntrance` (centre of the slot mouth, facing out -Z), `bayCamera` (suggested camera spot in a back corner of the bay, `dir` = where it looks), `spinAxis` (ring habitat only). Animation: mouth lights blink in two groups; only the ring habitat spins (about one turn per minute). No funny touches (Andy: save for later). Picked per dock by `pickStationVariant(dockId)`.

| ID | Name | Look | Description | Triangles | Size W x H x L | Status |
|---|---|---|---|---|---|---|
| station-ring | Ring Habitat | grand, cyan/blue | White hub with the slot on its axis, blue bands, cyan glow; a ring of 24 lit segments on 4 spokes that spins | 1022 | 41.0 x 41.0 x 28.4 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy) |
| station-starport | Coriolis Starport | grand, cyan/blue | Huge faceted white block, cyan-lit slot, rows of windows on the sides, blue bands, antennas. Revision 2026-11-09 (fix): hull rebuilt as one piece, no face crosses the bay any more | 822 | 36.3 x 40.1 x 38.4 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy) |
| station-cargo | Cargo Terminal | industrial, orange/yellow | Command block with the slot and hazard stripes, a long spine with four racks of containers, two yellow cranes, solar wings | 854 | 42.0 x 18.6 x 44.9 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy) |
| station-refinery | Fuel Refinery | industrial, orange/yellow | Docking block, four round tanks with orange bands piped to a truss, two long tanks, a burning flare stack | 1374 | 23.6 x 26.5 x 38.4 | INTEGRATED (part 3d; was APPROVED: Lead check passed 2026-11-08; kept by Andy) |

## Reference models (viewer only, never used by the game)
| ID | Name | What it is | Triangles | Anchors |
|---|---|---|---|---|
| scale-test | Size yard | Landing pad 9 wide, one crate, a pilot, a traffic cone and three ship-size boxes (small, medium, large) | 204 | parking (pad centre), crate |
| broken-demo | Broken on purpose | A shed with an inside-out roof, a floating antenna, too many triangles and missing anchors, so the problem checker can be seen working | about 2060 | parking |

## Cockpits (stage C1)
A view only (no steering, no free flight, no combat). Design source: docs/cockpit-design-brief.md, plus Andy's revision-1 answers (2026-11-10, from his reference pictures: low-poly, glass wrapping around the pilot, curved wall of screens, controls for looks, co-pilot seat beside the pilot, half glass, colours and mood per ship, budget 3000). Origin = the pilot's eye, looking -Z, up +Y; Agent 3 places the cockpit at the ship's `eye` anchor and hides the ship's own model in cockpit view. Same bones for all three (revision 2, Andy: eye higher and closer to the console, the same for all): a curved console with four screens in front, the pilot seat behind the eye, the co-pilot seat ahead-right. The `eye` anchor looks slightly down over the console (10 degrees); use its `dir` as the camera's forward. Anchors: `eye`; `screenInfo`, `screenMap`, `screenFuel` (flat, unshaded screens facing the eye; `dir` = facing, `size` = width and height, for Agent 5's text); `windowLight` (middle of the front glass; the `windowLight` mesh has its own material: set its colour to tint the window light); `dog` (Hauler and Liner only). `windowOpenings` = the glass openings (front, left, right, and roof on Hauler and Scout). `animation.levers` = throttles or joysticks with a pivot, axis and largest angle: nothing moves them yet (Agent 3 may nudge them at launch and in the warp). Blinking console lights via `update(t)`. The dog sleeps (no animation). Checker rule: "Faces block the window opening" (frame struts allowed).

| ID | Name | Glass and frame | Colours and mood | Details | Triangles | Status |
|---|---|---|---|---|---|---|
| cockpit-cargo-hauler | Cargo Hauler cockpit | Snug fighter canopy: glass front, sides and overhead, sides leaning in, pillars converging on the nose, two thin front struts, roof spine | Dark grey and orange, dark | Two throttles, a big orange mug, hazard stripe under the front glass, the dog asleep on the co-pilot seat | 1316 | DRAFT (revision 2) |
| cockpit-passenger-liner | Passenger Liner cockpit | Low wrap-around band of angled windows (centre, corners, sides) under a solid roof, lower walls leaning in | Dark with cyan glow strips (roof and sills), dark | Two throttles, a little potted plant, blue seats, the dog asleep on the co-pilot seat | 1378 | DRAFT (revision 2) |
| cockpit-scout | Scout cockpit | Compact overhead canopy: glass over the head, diagonal side struts, narrow front (model kept by Andy in revision 2; only the eye moved) | Dark and red, dark | Two joysticks on pedestals, a strapped-down toolbox on the co-pilot seat (no dog) | 956 | DRAFT (revision 2: model kept) |
