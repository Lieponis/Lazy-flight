# Project Status (kept by Project Lead)

**Last updated:** 2026-11-08

## Current phase
M2 COMPLETE. Done and verified: Agents 1, 2, 3a, 3b, 3c, 4a, 5a, and Agent 8 (Asset Design, Viewer and Debug).
Agent 8 DONE (2026-11-08): style guide, 11 designs kept by Andy (3 ships, 4 outposts, 4 stations), viewer /models.html with debug tools, 19 new tests (123 in total), Agent 8 ran npm run check after every batch, Andy approved every batch after green Actions. Lead check S4 passed (all triangle counts inside budgets: ships 540-684 of 1000, outposts 544-1048 of 1500, stations 854-1374 of 2500; all 11 IDs in the registry). Catalog statuses set to APPROVED.
Not verified for Agent 8: frame rate on a real phone, viewer on a real phone.
VERIFIED by Andy: 4b, 3d, 5b, 6a, 4c, 5c, 6b, 8 C1 + anchor, 3 C2a/C2b/C2c/3e, 4d, 5d (Upgrades panel, 465 tests, Actions green, phone upright and sideways), 7a (sound + music).
NOW: Agent 7 part 7b (title screen + speaker button; brief docs/briefs/agent-7b-brief.md). Parallel candidates (different files): Agent 7 7c planet looks (render, after 7b), Agent 6 part 6c (starts with the comfort rule fix, then balance with upgrades + final QA; brief docs/briefs/agent-6c-brief.md). THEN liveries (Agent 8 + Agent 5), v1.0.

## What works
- Live pixelated spinning cube (desktop and phone confirmed by Andy). Auto-publish via GitHub Actions. One command: npm run check.
- Agent 2 (checked only in its own workspace): universe generator in src/universe (galaxy, system, planet, dock, economy, jobs, names), 29 tests passing with a stand-in test runner, debug page tested in a headless browser.

## Agent 3 part 3a (2026-11-08)
- Starmap: 185 systems within 35 ly, rotate/zoom/tap, fuel-range ring (FUEL_RANGE_LY = 25), Open system button.
- System view: star, planets on orbits, outpost (building) or station (orbiting box) on each planet, planet labels, Back to map.
- Start: seed 12345, system Kopipex. ?seed=NUMBER works. 17 helper tests. Code in src/render/. API: startRender(renderer, parent) returns { state, showStarmap(), showSystem(id) }.
- Not verified: frame rate on phones (judged by feel only), npm run check in Agent 3's workspace.

## Agent 4 part 4a (2026-11-08), VERIFIED by Andy
- Rules in src/game (credits, fuel, starter Cargo Hauler: 30 cargo, no cabin, 60 fuel; start credits 200; 2 fuel per ly; refuel 2 credits per unit; 8 min per ly (changed to 1 min per ly on 2026-11-09, Agent 6b, Lead approved); same-system 20 s; max 4 h). Contracts: cargo free, reward on delivery. Passenger/tour jobs blocked (no cabin).
- Temporary panel in src/ui (right side, folded on phones). One small change in src/render/index.ts: setCurrentSystem(systemId). ?speed=NUMBER testing aid. 27 new tests (run only with a stand-in runner).
- Real build and Andy's click-test passed.
- Settings: src/game/settings.ts. Ships: ships.ts. Debrief lines: debriefs.ts.

## Agent 3 part 3b (2026-11-08), verified
- Flight view in src/render: ship.ts, cockpit.ts, tunnel.ts, flight.ts, flightplan.ts (pure, 16 tests), flightlines.ts (15 funny lines), flight.css. Settings in src/render/settings.ts (launch 5 s, approach 10 s, min warp 3 s, tunnel streaks 140).
- Only change outside src/render: src/ui/index.ts syncFlight() (calls api.startFlight / endFlight). 3a files touched: index.ts, systemview.ts, hud.ts, state.ts, helpers.ts, settings.ts.
- Flight HUD must stay under ~150 px tall so the trade panel never overlaps it.
- Not measured: phone frame rate; only one phone tried.

## Agent 3 part 3c (2026-11-08), verified
- Docked view in src/render/docked.ts (outpost: ship on a landing pad on a small curved planet; station: ship on a bay platform with corridor, planet below). dockedcam.ts camera maths (11 tests).
- Render API: showDocked(dockId), showSystem(id), showStarmap(), setCurrentSystem(id), startFlight(info), endFlight(), isFlying(). state.screen = docked | starmap | system | flight; state.dockedDockId.
- Temporary buttons for Agent 5 to replace: "Map" (docked.ts DockedScreen.enter), "Back to dock" (systemview.ts and starmap.ts refreshHud).
- Camera settings in src/render/settings.ts (angle 28 deg, distance 14, zoom 6 to 40, drift 0.04).
- Only change outside src/render: one line in src/ui/index.ts (showDocked at start).

## Verified by Andy on 2026-11-08 (Agent 1 and 2)
- Actions run green (real build and real tests).
- Live /debug.html shows systems, planets, prices and job board; seed 12345 vs 999 vs 12345 behaves correctly.
- Cube page still spins.
- Note: docs/report-agent-2.md still says "not verified". This status file supersedes it.

## Known issues
- (Fixed) Stale panel.ts and panel.css were removed from Andy's folder.
- Tours in v1 fly straight to the final stop (decision for 4b); per-stop flights later.
- Flight HUD still uses its old font (suggestion: VT323 for consistency).
- Expanded trade panel can cover the docked view on a phone (starts folded there). Agent 5 replaces it.
- Ship, pad, building and station shapes are rough. Redo in 3d.
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
- New agent 8 (Asset Design, Viewer and Debug): also builds the /models.html viewer with debug tools (wireframe, ruler, anchors, budgets, problem checker, variant grid, compare, shareable addresses, copy-problem-report) and fixes asset defects. Full brief in docs/briefs/agent-8-brief.md (Andy pastes a one-line pointer). Designs ships (3 classes), outposts (4 variants) and stations (4 variants) as code-built low-poly models plus a viewer page (models.html). Pipeline and rules in docs/ASSET-PIPELINE.md. Agent 8 never edits existing game files; integration is done by Agent 3 part 3d after Lead approval. May run in parallel with Agent 5a (different files); Andy commits one delivery at a time and waits for a green tick.
- Working method: agents give Andy ONE small step per message (do / look for / reply with). Files delivered as one zip, committed through GitHub Desktop.

- Agent 3 plan now: 3d integrates Agent 8's approved designs (docked, system view, flight, ship by id with ?ship= testing aid; docked camera INSIDE the station bay, Andy's choice), 3e = pixel look and cockpit frame redo. Old shape functions stay exported for the viewer's compare.
- Agent 8 decisions by Andy: no funny touches on ships or stations (outposts subtle ones); ship budget 1000; station bay 11 x 6.5 x 13.
- Agent 3 earlier split: 3b flight view (render must not import game; wiring through src/ui glue), 3d pixel look polish (3c is now the docked view). Cockpit frame is simple geometry in 3b.
- Agent 4 order and scope: 4a before 3b. 4a = trade jobs only. Trade jobs are contracts for v1: cargo is provided, reward paid on delivery. Buying and selling goods on the open market is a later suggestion. Starter ship has a cargo bay only, so passenger and tour jobs are blocked until a ship with a cabin exists (4b/Agent 5/6 phase).
- Job time limits (12 to 48 h) are not enforced in 4a (all trips are at most 4 h).
- 4b defaults (Lead): ships cargo-hauler (30 cargo, 0 cabin, tank 60), passenger-liner (6 cargo, 12 cabin, tank 70, price 1500; now tank 100 (5b) and price 2500 (6b, 2026-11-09)), scout (10 cargo, 2 cabin, tank 110, price 1200). Own several, buy at any dock when no job, switch free, each ship keeps its own fuel, no selling. Ship IDs use hyphens and match Agent 8's models.
- Free emergency refuel when the player is stuck (no usable fuel and not enough credits): approved 2026-11-08, build in Agent 4 part 4b.
- Testing aid: ?speed=NUMBER makes game time run faster so Andy does not wait hours.

## Out of scope list
Permanently: free flight, combat.
v1: planet landing, multiplayer, voxel terrain, accounts/servers, monetization, more than 3 ships/ranks, full-galaxy map.

## Next step
1. Andy continues the Agent 4 part 4b chat (if started) and reports back.
2. Agent 3 part 3d: new chat, attach agent-3d-package.zip, paste the one-line pointer.
3. Commit each delivery separately and wait for a green tick.


## Known issue (4b)
- Balance: 29 of 44 sample tours need more fuel than the Passenger Liner tank (70). Lead suggestion: raise Liner tank to 100 in ships.ts, or decide in 4c balance pass. Andy to decide.
- 3d known issues (Andy: both OK, not to be fixed: no outpost arrival shake; planet not visible from cockpit when leaving a station, it is behind the ship); reload starts a new game.
- DECISION (Andy): Passenger Liner tank raised from 70 to 100 so more tours are playable. Done by Agent 5 in 5b (one-number change in ships.ts, update the 4b test if it checks 70).
- DECISION (Lead, 6a): Agent 6 may change src/render/index.ts so startRender(renderer, parent, options?: { seed?: number }) uses the given seed, else behaves as before (?seed= or 12345). Nothing else in render. NEW GAME offers "Same universe" or "New random universe" (Andy). Game and render must always use the same seed.
- 4c perks chosen by Agent 4: owned outpost = 20% cheaper fuel and +10% pay on jobs ending there, whole star system. Ranks: 3 per category, pay bonus 0/5/10%. Passive income suggestion NOT approved (out of scope unless Andy says).
- SUGGESTIONS (not approved, not built): dog animations (tail wag, head follows sway, wakes at warp).
- DECISION (Lead + Andy, 6b): TRAVEL_SECONDS_PER_LY 480 -> 60 (avg trip ~20 min, longest tour ~75 min, 4 h cap no longer triggers). Passenger Liner price 1500 -> 2500 (Scout 1200, outposts unchanged, Liner tank stays 100). Expected: first ship ~1.5 h, first outpost ~8 h for an attentive player (~4,800 cr/h). Agent 6 may fix bug 6b-1 in src/game (accept checks the job WITHOUT rank/outpost bonuses; bonus still paid on arrival) and turn its it.fails test into a normal test.
- LATER (suggestions, not approved): more things to spend credits on after all outposts are bought; emergency fuel is unreachable in normal play and stays a safety net.
- DECISION (Lead, 6b): repeat-jobs fix approved in src/game: hide job ids delivered in the current board period from that board (do not change JOB_BOARD_REFRESH_SLOTS or src/universe). package-lock.json: commit approved (pins tool versions). Stale zips to delete by hand (list in report-agent-6b.md section 6).
- C1 PROCESS CHANGE (Andy: Agent 8 cockpit result far from his vision): thumbnail round (3 rough options A/B/C) before modelling, reference sheet from Andy, compare-to-reference after each batch. Guide: docs/GUIDE-visual-direction.md. Lead rewrites the C1 brief on request.
- DECISIONS (Lead, C1 review): one base cockpit for all ships OK; 2,400 triangles OK (limit 3,000 for restart); lens.ts OK; seatBlue and 'may cover window' checker rule OK; cockpit stays OUT of the registry until Andy decides on window light (Agent 3 imports buildCockpitBase directly). Throttle animation = suggestion only.
- C2a extras added by Andy during testing (approved): cockpit shake 20% of orbit shake, drag to look around, zoom 5x in/out, double-tap glide to start view, start view zoomed out 1.75x. Not measured: phone frame rate (Andy: 'phone good'). SUGGESTIONS (not built): throttle lever moves with the trip; Reset view button; remember zoom between flights.
- DECISIONS (Lead, C2b review): C2b passed. Tour stops into FlightInfo approved as stage C2c (Agent 3, glue only). screenRightWing anchor goes to Agent 8 (next cockpit task). Andy decided: funny ship-computer lines (15 s / 10 s) replace the HTML status box in Cockpit view. SUGGESTIONS (not built): blinking arrival cue, credits on the console screen, funny line on its own screen.
- C2c passed (tour stops on cockpit screens). SUGGESTIONS (not built): message when a stop is passed. Agent 8 still owes the screenRightWing anchor.
- DECISION (Andy 2026-11-10): cockpit extras (dog, lamp, window light) not now; 3e released now incl. warp animation redo; polish scope = sound, music, title screen, extra planet/ship types; wants a ship-upgrades proposal.
- 6b DONE and verified (Lead review passed; bugs 6b-1 and 6b-2 fixed; 334 tests; Actions green; Andy tested an iPhone Air in Safari: smooth). Not yet tested: Android. npm audit: 6 known weaknesses in OLD BUILD/TEST TOOLS only (Vite/Vitest), not shipped in the game; decision: handle in final QA (6c) as a tool upgrade only if it is low risk. Credit sinks: ship upgrades proposal waiting for Andy.
- Agent 8 anchor task DONE (screenRightWing; Andy checked in viewer; 377 tests). Follow-up (replace Agent 3's mirrored placement with the anchor) folded into the 3e brief as its first small task, so only one agent edits cockpitscreens.ts.
- 3e DONE (Lead review passed). Known: field named tunnel in flight.ts now holds the warp (rename later, cosmetic); tour stops evenly spaced. Look test aids: ?look=A|B|C|off, ?lookpreview=1, ?warp=A|B|C, ?warppreview=1.
- DECISIONS (Andy 2026-11-10): ship upgrades APPROVED: 4 tracks (fuel tank, hold/cabin, efficient engines, passenger comfort), 5 levels each, stay with the ship. Polish extras: extra planet looks AND ship liveries (paint jobs); still exactly 3 ships. Lead rule: planet looks are render-only so the seed gives the same universe; liveries are cosmetic colour variants chosen in the Shipyard (saved field with default).
- 4d done. Lead notes: comfort bonus is ADDED to rank and outpost bonuses on the plain reward (top +50%); bigger tank does not refill; hold upgrade never creates a cabin; numbers round to whole units. Until 5d the menus show BASE tank/burn numbers (display lag only). SUGGESTIONS (not approved): pay bonus split on job cards; badge per upgrade level on the ship.
- 7a done. Sound is code-made (Web Audio), no files, saved under its own key lazy-freight.sound (src/save untouched). RISKS to watch in QA: src/ui/sound.ts copies the flight phase timing from src/render (if Agent 3 changes phase lengths, sounds must follow); bonk detection depends on CSS class names .ui-panel-title.ui-red and .ui-notice. SUGGESTIONS (waiting for Andy): speaker/mute button on the top strip (works in flight); second music track.
- DECISION (Andy 2026-11-11): speaker (mute) button approved: next to MENU when docked, instead of MENU during flight; built by Agent 7 in 7b. Second music track not approved (suggestion only).
- 5d done. Lead decisions: comfort-on-cabinless-ship rule gap fixed as Part 0 of the 6c brief (src/game change approved for Agent 6). Andy allows agents to push reports to docs/report-agent-*.md again. NOT verified: cockpit fuel numbers with upgrades during flight (check once in QA). SUGGESTIONS (not approved): pay-bonus split on job cards; upgrade badge on the docked ship.
