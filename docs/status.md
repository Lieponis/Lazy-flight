# Project Status (kept by Project Lead)

**Last updated:** 2026-11-08

## Current phase
M2 COMPLETE (first playable milestone reached). Agent 3 part 3b DONE, per Agent 3's report verified by Andy's click-test (desktop and phone, Actions green): launch, warp with progress/ETA/funny lines, Orbit/Cockpit switch, approach, arrival, tab switch, short trip, older screens.
Andy's note: he does NOT like the current ship and cockpit look yet. To be redone in 3d.
Andy chose (2026-11-08) to change the gameplay screen flow BEFORE any further work (design doc v4): docked view with camera above the ship, Jobs button/menu (no cockpit button there), separate Map button. Workflow: Agent 3 part 3c (docked view) then Agent 5 part 5a (Jobs menu, Map button, status strip). The earlier A/B ordering question is parked; after 5a resume: 4b mechanics, 6a saving, 3d pixel look, 7 polish.

## What works
- Live pixelated spinning cube (desktop and phone confirmed by Andy). Auto-publish via GitHub Actions. One command: npm run check.
- Agent 2 (checked only in its own workspace): universe generator in src/universe (galaxy, system, planet, dock, economy, jobs, names), 29 tests passing with a stand-in test runner, debug page tested in a headless browser.

## Agent 3 part 3a (2026-11-08)
- Starmap: 185 systems within 35 ly, rotate/zoom/tap, fuel-range ring (FUEL_RANGE_LY = 25), Open system button.
- System view: star, planets on orbits, outpost (building) or station (orbiting box) on each planet, planet labels, Back to map.
- Start: seed 12345, system Kopipex. ?seed=NUMBER works. 17 helper tests. Code in src/render/. API: startRender(renderer, parent) returns { state, showStarmap(), showSystem(id) }.
- Not verified: frame rate on phones (judged by feel only), npm run check in Agent 3's workspace.

## Agent 4 part 4a (2026-11-08), VERIFIED by Andy
- Rules in src/game (credits, fuel, starter Cargo Hauler: 30 cargo, no cabin, 60 fuel; start credits 200; 2 fuel per ly; refuel 2 credits per unit; 8 min per ly; same-system 20 s; max 4 h). Contracts: cargo free, reward on delivery. Passenger/tour jobs blocked (no cabin).
- Temporary panel in src/ui (right side, folded on phones). One small change in src/render/index.ts: setCurrentSystem(systemId). ?speed=NUMBER testing aid. 27 new tests (run only with a stand-in runner).
- Real build and Andy's click-test passed.
- Settings: src/game/settings.ts. Ships: ships.ts. Debrief lines: debriefs.ts.

## Agent 3 part 3b (2026-11-08), verified
- Flight view in src/render: ship.ts, cockpit.ts, tunnel.ts, flight.ts, flightplan.ts (pure, 16 tests), flightlines.ts (15 funny lines), flight.css. Settings in src/render/settings.ts (launch 5 s, approach 10 s, min warp 3 s, tunnel streaks 140).
- Only change outside src/render: src/ui/index.ts syncFlight() (calls api.startFlight / endFlight). 3a files touched: index.ts, systemview.ts, hud.ts, state.ts, helpers.ts, settings.ts.
- Flight HUD must stay under ~150 px tall so the trade panel never overlaps it.
- Not measured: phone frame rate; only one phone tried.

## Verified by Andy on 2026-11-08 (Agent 1 and 2)
- Actions run green (real build and real tests).
- Live /debug.html shows systems, planets, prices and job board; seed 12345 vs 999 vs 12345 behaves correctly.
- Cube page still spins.
- Note: docs/report-agent-2.md still says "not verified". This status file supersedes it.

## Known issues
- Ship and cockpit look is rough; Andy dislikes it. Redo in 3d.
- Same-system jobs never appear on boards (universe puts destinations in other systems). Not a bug; note for balance.
- Tour jobs currently fly straight to the last stop; Agent 4b must handle multi-leg tours when tours become playable.
- Picking a destination star on the starmap does not yet filter the job board (suggestion, UI phase).
- Possible dead end: fuel and credits both run out and no job can be taken. Free emergency refuel APPROVED (Agent 4's suggestion); goes into the Agent 4 4b brief.
- No saving yet: reload = new game. Saved times are game ms; on load Agent 6 must shift them (clock starts at real now on page load).
- Starmap ring is still a fixed 25 ly, not real fuel range.
- A completed job can reappear if the player returns to the same dock within the same 6-slot window (Agent 6 balance pass).
- Render now fills the whole window with about 57,600 pixels (320x180 in a 16:9 window) instead of black bars. Accepted. 3b must decide how the cockpit frame behaves in non-16:9 windows.
- Current system is fixed at the start system. Agent 4 needs a small, listed change in src/render to move it on arrival.
- Tapping the star in system view does nothing (minor).
- Temporary HUD in src/render/hud.ts. Agent 5 replaces it.
- (Resolved) Real build and tests are green in GitHub Actions. Debug page on a phone not checked (low priority).
- Time limits on jobs (12 to 48 hours) are random and not tied to distance. Agent 4 decides how they relate to the 4-hour trip cap.
- Word lists are .ts files (readable, editable, but not plain text). Accepted for v1.
- Naming mismatch in Agent 2's report: listSitesNear vs listSystemsNear. Agent 3 must use the names actually exported from src/universe/index. To confirm after the build.
- Debug page tables may need sideways scrolling on a phone (low priority).
- No package-lock.json yet (Agent 6). Root README upload step to be rewritten around GitHub Desktop (Agent 6).

## Decisions made
- Free flight and combat: permanently out, at every stage.
- Every planet has exactly one dock: surface outpost or orbiting station. Gas giants always get stations (Agent 2's choice, accepted).
- Outposts optional to buy. Perks: fuel discount 5-20%, passive income per hour. Price 500 to 40,000 credits. Stations not for sale.
- One job pattern. Kinds built: TRADE, PASSENGER, TOUR. SCAN and RESCUE reserved for the later phase.
- Max trip length 4 hours (Agent 4 converts distance to time). MAX_JOB_DISTANCE = 25 light years.
- Time slot = 1 in-game hour. Job boards stay the same for 6 slots (JOB_BOARD_REFRESH_SLOTS). Accepted.
- A dock's id equals its planet's id. Accepted.
- 3 ranks, 3 ships for v1. Stack: TypeScript, Three.js, Vite, Vitest, GitHub Pages, localStorage saves.
- Working method: agents give Andy ONE small step per message (do / look for / reply with). Files delivered as one zip, committed through GitHub Desktop.

- Agent 3 split: 3b flight view (render must not import game; wiring through src/ui glue), 3d pixel look polish (3c is now the docked view). Cockpit frame is simple geometry in 3b.
- Agent 4 order and scope: 4a before 3b. 4a = trade jobs only. Trade jobs are contracts for v1: cargo is provided, reward paid on delivery. Buying and selling goods on the open market is a later suggestion. Starter ship has a cargo bay only, so passenger and tour jobs are blocked until a ship with a cabin exists (4b/Agent 5/6 phase).
- Job time limits (12 to 48 h) are not enforced in 4a (all trips are at most 4 h).
- Free emergency refuel when the player is stuck (no usable fuel and not enough credits): approved 2026-11-08, build in Agent 4 part 4b.
- Testing aid: ?speed=NUMBER makes game time run faster so Andy does not wait hours.

## Out of scope list
Permanently: free flight, combat.
v1: planet landing, multiplayer, voxel terrain, accounts/servers, monetization, more than 3 ships/ranks, full-galaxy map.

## Next step
1. Andy replaces docs/design-doc.md with v4.
2. Agent 3 part 3c (docked view) brief, then Andy's checks.
3. Agent 5 part 5a (Jobs menu, Map button, status strip) brief, then Andy's checks.
4. Then 4b (incl. approved emergency refuel), 6a saving, 3d pixel look, 7 polish.
