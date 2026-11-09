# Agent 8 fix report: Coriolis Starport bay (2026-11-09)

## What was wrong
`station-starport` was built from three hull pieces in a row (front block, front shoulder, middle) plus a back piece. Each piece is closed at both ends, and three of those end walls (at z -16.4 and z -9) stood right inside the docking bay (z -17 to -4). With the docked camera inside the bay, they showed as a face across the room.

## What was fixed
- The starport hull is now ONE piece (the same shape: narrow front, wide middle, narrow back), so it has no inner end walls. The bay is unchanged: 11 x 6.5 x 13. The `parking`, `dockEntrance` and `bayCamera` anchors did not move. Triangles went from 874 to 822 (budget 2500). The outside looks the same; through the slot you now see into the lit bay.
- The other three stations (ring, cargo, refinery) were checked the same way: nothing crosses their bays. No change needed.
- The problem checker now has a station rule: "Parts cut across the inside of the docking bay: ...". So "Check this asset" in /models.html would have caught this.
- Two new tests in tests/assets.test.ts: no part of any station (except the bay's own floor, walls, ceiling, marks and lights) enters the bay room; and a deliberately added wall across a bay is caught.

## Files changed
src/render/assets/stations.ts, src/render/assets/checker.ts, src/render/assets/registry.ts (triangle count), tests/assets.test.ts, docs/ASSET-CATALOG.md (revision note, statuses unchanged), this report. Nothing in the render scenes was touched.

## Verified
`npm run check` here: build OK, 206 tests passed (11 files). Screenshots of all four bays at game resolution in a headless browser. Not verified: the real game home screen (Agent 3's camera spot may differ from `bayCamera`, but the test covers the whole bay room).
