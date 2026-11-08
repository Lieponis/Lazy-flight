# Asset catalog

The list of every ship, outpost and station design. Rule: an asset the game uses is here AND in `src/render/assets/registry.ts`.
Statuses: REQUESTED, DRAFT, APPROVED, INTEGRATED. Sizes are in crate units (see docs/STYLE-GUIDE.md).

## Ships (stage S1)
All ships: nose to -Z, up +Y, origin = `parking` (ground point between the feet). Anchors: `parking` (ground contact), `eye` (cockpit camera, looks forward -Z), `nose` (front tip), engine anchors at the exhaust, pointing backwards (+Z). Flames grow backwards from the exhaust.

| ID | Name | Role | Description | Funny detail | Triangles | Size W x H x L | Engine anchors | Status |
|---|---|---|---|---|---|---|---|---|
| cargo-hauler | Cargo Hauler | Goods | Wide, flat hauler with a big multi-pane cockpit, cargo hidden inside, two engine pods, orange company marks (Asp Explorer feel) | none (Andy: no funny touches on ships) | 568 | 6.4 x 1.9 x 6.5 | engineL, engineR | DRAFT (revision 1) |
| passenger-liner | Passenger Liner | Passengers and tours | Long, grand white liner with a raised top deck, eight lit windows each side, blue company stripe, swept tail fin, wide engine bank (Dolphin + Orca feel) | none | 684 | 5.2 x 2.8 x 7.0 | engineL, engineR | DRAFT (revision 1) |
| scout | Scout | Scanning and exploring | Small, angular grey explorer with two dark side pods, short swept fins, teal company marks and one big engine (Diamondback Explorer feel) | none | 540 | 4.5 x 1.4 x 4.1 | engineMain | DRAFT (revision 1) |

## Outposts (stage S2)
None yet.

## Stations (stage S3)
None yet.

## Reference models (viewer only, never used by the game)
| ID | Name | What it is | Triangles | Anchors |
|---|---|---|---|---|
| scale-test | Size yard | Landing pad 9 wide, one crate, a pilot, a traffic cone and three ship-size boxes (small, medium, large) | 204 | parking (pad centre), crate |
| broken-demo | Broken on purpose | A shed with an inside-out roof, a floating antenna, too many triangles and missing anchors, so the problem checker can be seen working | about 2060 | parking |
