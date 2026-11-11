# Report: Agent 3, stage U3 (system view with 1 to 10 planets)

**Not run here:** `npm run check` and Three.js cannot run in my workspace (no network). Proof = green Actions run (the last runs were green) + Andy's click-test. Offline I ran a stand-in type check and the pure tests.

## Built (all in `src/render`, nothing outside it)
- **Layout** (`systemlayout.ts`, pure, 16 tests): each orbit is sized to its planets' footprints (ball, rings or station circle), so gas giants get room and 10 planets stay compact. Station circle is now smaller (`stationOrbitFor`). Camera starts far enough that the whole system fits (`fitDistance`, uses the real window shape).
- **Docks easy to find** (Andy chose **A**, bright lanes): orbit line of a planet with a dock is bright blue, scenery is dim (`SYSTEM_LANE_*` in settings). Name tags (B) and beacons (C) were built, shown, rejected and removed. `?marks=off` shows the old look for comparison.
- **Docks 5x smaller** in the system view (Andy): `SYSTEM_OUTPOST_SCALE*`, `SYSTEM_STATION_SCALE`.
- **Tap a planet = it becomes the centre** (Andy): camera glides to it and moves in (never out); dragging circles around it; tap the star to go back. `OrbitView` got `focusOn / glide / resetFocus` (starmap unaffected). **Zoom in 5x closer** (`SYSTEM_MIN_ZOOM_DIST` 0.8; camera near plane 0.05).
- **One-dock system:** the bottom text always gives a summary ("1 planet, 1 dock: Name (Station)", or "10 planets, 3 docks: ..."), so there is no empty "choose a destination" feeling. Scenery planets stay tappable for info (Agent 5e's panel shows DOCK / SCENERY).
- **Phones:** planet balls are lighter in crowded systems (7+ planets: rocky 80 triangles, gas 180 instead of 180/320). Planet look (7c) unchanged.

## Triangles (10-planet systems)
Estimated on 60 seeds: planets + clouds + rings + star **median 1,440, worst 1,740** (before the change: median 2,560, worst 3,060). Dock models add about 540 to 1,400 each (Agent 8 budgets), at most 3 docks: **whole picture about 3,000 to 5,900 in the worst case, typically around 4,000**. A live counter is in `?systempreview=1` (TRIS). Andy's reading of that counter: **not received**, so the real on-screen number is NOT verified. Suggestion: if a phone is slow, hide the dock models beyond a zoom distance (not done).

## How to check
Live: https://lieponis.github.io/Lazy-flight/ . Testing aids: `?systempreview=1` (OFF/A buttons, `<` `>` to step through systems with 1 to 10 planets, TRIS counter, does not touch the saved game), `?marks=A|off`. Test seeds (start system): seed 1 = 1 planet; 2 = 5 planets, 2 docks; 5 = 10 planets, 3 docks; 43 = 10 planets, 1 dock. NOTE `?seed=` starts a NEW game and replaces the save.

## Phone checklist (one)
Open `?systempreview=1`, step `>` to a 10-planet system: smooth turning, bright lanes visible, tap a planet then pinch in close with nothing cut off.

## Known issues / for others
- **Flaky test (not mine):** `tests/universe-v2.test.ts` "is the first dock of the system nearest to the middle" took more than its 5 s limit once on Actions (red run, green after re-run). Suggestion for Agent 2/4/6: give it a longer time limit.
- Tapping empty space only unselects (does not go back); Andy was asked, no answer yet.
- Dock markers never tested on a real phone; frame rate not measured.
- `systemview.ts` still draws the old-look lines when `?marks=off`; delete later if unwanted.
