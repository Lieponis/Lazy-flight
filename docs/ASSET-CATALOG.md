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

## Liveries (ship paint jobs, 2026-11-11)
Cosmetic only. A livery repaints a ship's paint parts (hull, panels, dark parts, underside, company marks); shape,
triangles, anchors, glass, lights and flames stay the same. `standard` (or no livery) = the original look. Defined in
`src/render/assets/liveries.ts`; pass `getAsset(shipId).build({ livery: id })`. Report: docs/report-agent-8-liveries.md. Andy's choices: 3 new plus the
standard per ship, smart company-fleet colours, nothing jokey, a set per ship's job, colours only, option C (bright
company colours: the whole hull in one bold colour) for the Hauler and Scout; the Liner uses option B of its own
round (a pale body with a bold top deck and tail; Andy changed purple and coral to green and pink). The Liner's top deck
and tail use the new palette slot `paintTrim` (same white as `paintWhite`, so its standard look is unchanged).

| Ship | ID | Name | Description | Status |
|---|---|---|---|---|
| cargo-hauler | standard | Standard | The original paint. | default |
| cargo-hauler | hazard-yellow | Hazard Yellow | Yellow hull, black panels, white marks: heavy site machinery. | APPROVED (Andy) |
| cargo-hauler | teal-line | Teal Line | White hull, teal panels, navy marks: a tidy freight company. | APPROVED (Andy) |
| cargo-hauler | orange-express | Orange Express | Orange hull, white panels, navy marks: the fast parcel service. | APPROVED (Andy) |
| passenger-liner | standard | Standard | The original paint. | default |
| passenger-liner | sky-blue | Sky Blue Air | Pale blue body, sky blue top deck and tail, yellow marks: a cheerful holiday airline. | APPROVED (Andy, option B) |
| passenger-liner | spring-green | Spring Green | Pale green body, green top deck and tail, yellow marks: a calm countryside line. | APPROVED (Andy, option B) |
| passenger-liner | rose-line | Rose Line | Pale pink body, pink top deck and tail, navy marks: the friendly tour company. | APPROVED (Andy, option B) |
| scout | standard | Standard | The original paint. | default |
| scout | survey-lime | Survey Lime | Lime hull, black side pods, white marks: the survey office. | APPROVED (Andy) |
| scout | rescue-red | Rescue Red | Red hull, white side pods, dark marks: search and rescue. | APPROVED (Andy) |
| scout | electric-blue | Electric Blue | Bright blue hull, white side pods, yellow marks: a sporty explorer. | APPROVED (Andy) |

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
Restarted after Andy's reset: ONE base cockpit for all three ships, built one step at a time from Andy's drawings
("Cockpit shell", "Cockpit windows", "Cockpit panels", ...). Work in progress: `cockpit-base` in
src/render/assets/cockpitBase.ts, shown in the viewer only (reference group), not in the registry yet.

| Step | What | Status | Decided |
|---|---|---|---|
| 1 | Shell and window cut-out | APPROVED by Andy | six zero-thickness surfaces (front wall, back wall, floor, two side walls, lofted roof); shapes measured from the drawing; window follows the front view most closely (option C), no sharp corners |
| 2 | Dashboard panels | APPROVED by Andy | option B (as drawn, softened): wrap-round dashboard (middle + two wings) at the drawing's height, flat light top meeting the shell with no gap, light upright face and dark leg room (right angles); side columns; centre console joined to the dashboard; overhead panel from the window's edge to the back; exactly left/right symmetric; eye higher (1.45) and closer to the dashboard; view 70 degrees side to side through a light Panini lens (src/render/assets/lens.ts, option C: no stretched edges; the game's cockpit view must use `CockpitLens.render` too); viewer drag reversed left/right only; centre console in the dashboard's colour |
| 3 | Seats | APPROVED by Andy | option B: the drawn seats (pedestal, cushion with leg cut-out, leaning backrest, headrest) moved forward and slightly inwards so the eye sits just in front of the headrest; clear of the centre console; Airbus flight-deck blue (palette `seatBlue`); seats may cover parts of the window from the eye (allowed) |
| 4 | Instruments and lights | APPROVED by Andy | five screens on the dashboard's upright face (three in the middle, a smaller one on each wing, all kept inside the face) and one on the console, game teal with grey frames; about 90 indicator lights, 0.06 crates square on a dark surround (bigger and clearer, Andy), in random glow colours, each flashing at its own pace (fixed seed, one extra mesh whose colours `update` changes); the overhead panel full of lights; extra lights round the wing screens; every face light is checked to sit inside the dashboard face (building fails otherwise); throttle with a cylinder grip and a small lever (both game-movable levers); two switches; all exactly left/right symmetric |
| 5 | Screen jobs | APPROVED by Andy | option A 2: `screenInfo` on the middle-left screen (straight ahead of the pilot), `screenMap` on the middle screen, `screenFuel` on the pilot's (left) wing screen in amber; each anchor = screen middle, facing into the cabin, size in crates; the other three screens show made-up readouts (bars, a graph line, a header strip), no text |
| 6 | Dog, warm lamp, window light | DEFERRED by Andy (not now) | |

Next: put it into the game and draw on its screens, see docs/INTEGRATION-cockpit.md. Report: docs/report-agent-8-c1.md.

Anchor task (2026-11-10): added `screenRightWing` (right wing screen, the mirror of `screenFuel`). Report: docs/report-agent-8-anchor.md.

Known: Andy's drawings disagree between views in places (window; dashboard lip vs the low roof at the nose sides),
so one view leads and the others are matched as closely as the shapes allow. Small zigzag shading steps on the curved roof.
