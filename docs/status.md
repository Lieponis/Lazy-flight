# Project Status (kept by Project Lead)

**Last updated:** 2026-11-11

## Current phase
M2 COMPLETE. Done and verified: Agents 1, 2, 3a, 3b, 3c, 4a, 5a, and Agent 8 (Asset Design, Viewer and Debug).
Agent 8 DONE (2026-11-08): style guide, 11 designs kept by Andy (3 ships, 4 outposts, 4 stations), viewer /models.html with debug tools, 19 new tests (123 in total), Agent 8 ran npm run check after every batch, Andy approved every batch after green Actions. Lead check S4 passed (all triangle counts inside budgets: ships 540-684 of 1000, outposts 544-1048 of 1500, stations 854-1374 of 2500; all 11 IDs in the registry). Catalog statuses set to APPROVED.
Not verified for Agent 8: frame rate on a real phone, viewer on a real phone.
VERIFIED by Andy: 4b, 3d, 5b, 6a, 4c, 5c, 6b, 8 C1 + anchor, 3 C2a/C2b/C2c/3e, 4d, 5d, 7a, 7b (title screen LAZY FLIGHT + speaker; iPhone Air 'Keep'). Agent 6 part 6c DONE (balance with upgrades: Andy kept the prices; comfort rule fix; npm audit 0; cleanup; 494 tests) - Andy's iPhone checklist result pending.
NOW: Agent 2 stage U1 (fewer docks, bigger systems, universe v2; brief docs/briefs/agent-2b-brief.md, plan docs/plan-fewer-docks.md; branch universe-v2) and Agent 8 liveries, in parallel (different files). 7c is DONE and verified (see below). NEXT: U2 Agent 4 (migration, refund, game), U3 Agents 3/5 (system view up to 10 planets, docks only), U4 Agent 6 (rebalance and QA); livery choice in Shipyard; release page (7d); v1.0.

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
- Combat: permanently out, never (Andy 2026-11-11: no weapons, children friendly, stress releasing, chill vibe). "Free flight" is now ALLOWED, but only as MENU TRAVEL without a job (pick a place on the map, pay fuel, watch the warp); steering the ship yourself stays out unless Andy says otherwise.
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
Permanently: combat (and any weapons or enemies). Free flight changed 2026-11-11: menu travel without a job is IN (see "Free travel" section).
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
- 7b done. Lead CONFIRMS the deviation: title backdrop is a short-lived separate space scene using the game's own planet/station models, completely freed after PLAY (instead of the live docked view); Andy chose it. Game name LAZY FLIGHT (repo Lazy-flight; save keys stay lazy-freight.*). Tagline 'SPACE HAULING AT THE SPEED OF NAP'. 6c: tool upgrade Vite 8 / Vitest 5, audit 0; Android/Firefox/desktop Safari NOT verified. SUGGESTIONS (not approved): pay-bonus split on job cards; tutorial hint 'upgrades first or outpost first'; version number on title; add-to-home-screen hint.
- DECISION (Andy 2026-11-11): fewer docks per system (1-3 by system size), systems up to 10 planets, old saves move + refund, the same seed gives a different universe (UNIVERSE_VERSION 2). Plan: docs/plan-fewer-docks.md.

## Agent 7 part 7c (2026-11-11), VERIFIED by Andy ("Keep") and reviewed by Lead
- New planet looks, option B "No Man's Sky mix": surprising colours on ~1 in 3 planets, rings on ~8%, ice caps, craters, clouds, storm stripes. Render-only (`src/render/planetlook.ts`), chosen from a hash of the planet id.
- `src/universe` untouched, proved by a fingerprint test (seeds 12345/777/4242). Nothing new is saved. 505 tests pass, Actions green.
- Preview wall: `/planets.html` (`?filter=rings` is a good release screenshot).
- Not verified: Android, phone frame rate. Suggestions (unapproved): darker night steps; lava glow and city lights (option C); show "ringed" in the planet label.
- Looks depend only on planet id, so the fewer-docks change will not affect them.

## Universe v2, stage U1 (2026-11-11): Agent 2 DONE on branch `universe-v2` (not on main)
- Lead review: passed against brief. Up to 10 planets, 1-3 docks per system (avg 1.4), UNIVERSE_VERSION 2, 48 universe tests; boards stay full (6 jobs, none under 3) over 60 seeds, so MAX_JOB_DISTANCE stays 25.
- Full check red ONLY in other layers (13 tests: start dock = planet 0 no longer always a dock). That is why it is on a branch. Andy must NOT merge; Agent 4 fixes it in U2 (brief docs/briefs/agent-4e-brief.md), then merges.
- Not verified by Agent 2: real npm run check, 4 three.js test files (assets, lens, planetlook, title). Agent 4 must run them.
- Next: U2 Agent 4 -> Andy verifies live -> U3 Agents 3/5 (system view) -> U4 Agent 6.

## Universe v2, stage U2 (2026-11-11): Agent 4 DONE, merged to main, VERIFIED by Andy live
- Lead review: passed. startDockOf is the one start dock; old saves move + refund (20,000 flat per old outpost, approved by Andy); 13 failing tests fixed, none weakened; planetlook fingerprints re-recorded for v2 (identical on the commit before, so the universe was not touched by U2).
- Extra (Andy's request, Lead confirms): every planet can be tapped for info; dock-less ones say "No dock here - nothing to visit". They are still never a destination. U3 plan line changed from "not selectable" to "selectable for info only".
- New: .github/workflows/check.yml runs the checks on every non-main branch, never publishes.
- Numbers: 79-110 docks within 25 ly (32-61 outposts); cheapest outpost 5,000-10,200; first outpost 11.1 h planner (was 9.1), 29.0 h sensible, casual/lazy never. 20 of 300 seeds have no takeable first job (was 28).
- Known: 1 audio test fails on main (existed before U1); Agent 6 to fix in U4.
- NEXT (parallel, different files): U3 Agent 3 (system view, docs/briefs/agent-3f-brief.md) and Agent 5 (wording/menus, docs/briefs/agent-5e-brief.md). Then U4 Agent 6 (rebalance, audio test, old-save check on a phone). Suggestion for U4 awaiting Andy: guarantee one starter job on the first board.

## Agent 8 ship liveries (2026-11-11): DONE, Andy approved all in the viewer; Lead review passed
- 4 paint jobs per ship (standard + 3), cosmetic only, same triangles and anchors. API: liveriesFor(shipId), DEFAULT_LIVERY, getAsset(id).build({livery}); unknown id = standard. 565 tests, Actions green. Report docs/report-agent-8-liveries.md.
- DECISIONS (Andy 2026-11-11): extra paint jobs cost a SMALL PRICE each (Lead proposes 500 credits, "standard" always free; Andy can change); the whole livery feature (saved field per owned ship with default "standard", Shipyard picker, livery shown in docked view, flight and Shipyard preview via buildShipModel(shipId, liveryId?)) is built AFTER U3 is live and verified, in one go (Agent 4 game+save, Agent 5 picker, Agent 3 glue).
- Not done yet: the choice, saving, showing it in game.

## Agent 3 stage U3 (2026-11-11): DONE, Lead review passed (render side); Andy chose option A
- System view handles 1-10 planets: size-aware orbits, camera fits system, lighter balls when crowded (7+ planets). Bright blue lanes = docks, dim = scenery. Docks 5x smaller, tap planet = centre, tap star = back, zoom 5x closer. Only src/render (+ render tests). 10-planet triangles: planets median 1,440 / worst 1,740; with up to 3 docks typically ~4,000, worst ~5,900 (estimate; live counter at ?systempreview=1, Andy's reading not received).
- Not verified: real on-screen triangles, phone frame rate, Android.
- Open: tap on empty space only unselects (Andy not yet asked). Flaky 5 s test tests/universe-v2.test.ts (start dock) -> Agent 6 in U4 (longer limit).
- Waiting for Agent 5 (docs/briefs/agent-5e-brief.md) before U3 is closed; then U4 Agent 6, then liveries (4/5/3), then release page 7d.

## Agent 5 stage U3 (5e) (2026-11-11): DONE, Andy click-tested on phone, Lead review passed
- Planet panel on the system map (DOCK / SCENERY card, option A; on the left when the phone is sideways), friendlier "universe rebuilt" fading note after PLAY, calmer empty-board text. Only src/ui, CSS, ui tests. 588 tests, Actions green.
- U3 CLOSED (Agents 3 and 5). Note: UI hides the render label on system map with CSS (.hud-label); Agent 3 may stop setting it later (cleanup).
- NEXT: U4 Agent 6 (brief docs/briefs/agent-6d-brief.md): rebalance on v2, outpost options, starter-job proposal (Andy decides), flaky + audio test fixes, old-save and regression QA, phone checklist. After that: livery feature (Agents 4/5/3), release page 7d, v1.0.
- Open Andy questions: starter job (decided in 6d), tap on empty space in system view (unanswered).

## Free travel (Andy 2026-11-11): DECISION, design pending
- Andy changed his own rule: free flight is IN as "Free travel": from the map, go to a place without taking a job, paying only fuel, so you are never stuck at a dock with no jobs and can explore. Chosen: MENU TRAVEL (not steering). Combat never.
- Andy also wants to reach empty space / stars with no dock. Lead note: after universe v2 every system has at least 1 dock, so "no-dock star" does not exist; what Andy may mean (empty deep space, scenery-only planets) needs a design answer. See docs/proposal-free-travel.md.
- ANSWERS (Andy 2026-11-11): scenery planets + docks without a job (no deep empty space); discovery credits 50-100 per first visited system; NEW 4th rank EXPLORER (unique systems and unique planets); strand protection ON. Details in docs/proposal-free-travel.md. Rule change: max 3 ranks -> 4 categories, Andy's decision.
- NEXT: F1 Agent 4 (docs/briefs/agent-4f-brief.md) game rules + save; then F2 Agents 3/5 (button, arrival, Explorer rank screen), F3 Agent 6. Livery feature, release page 7d wait.

## Agent 4 stage F1 (4f) (2026-11-11): DONE, merged, Andy checked live; Lead review passed
- Free travel (canFreeTravel/freeTravel), floating at a scenery planet, strand protection, discovery credits (50-100 once per system), Explorer rank option B (50 and 200 discoveries; "Lost in Space", "Cartographer", "Mr Galaxy-wide"; +0/10/20% discovery credits only). Compact save (~24 bytes/system, cap 20,000 systems). 31 new tests + explorer sim.
- Andy found a real crash (old saves made before F1 crashed the page); fixed with a whole-path test. Lesson for QA: test old saves through the whole path. First-outpost times shifted a few hours (planner 10.1 h, sensible 32.8 h, spender 32.1 h); nothing retuned.
- Known: 1 audio test fails (pre-existing); agent6c needs a real runner.
- NEXT: F2a Agent 3 (render views, brief docs/briefs/agent-3g-brief.md), THEN F2b Agent 5 (Fly here button, Explorer row, arrival texts; brief written after 3g so the API is real), then F3 Agent 6. Livery feature and release page 7d later.
- DECISION (Andy 2026-11-11): NO guaranteed starter job. Free travel covers the dead-first-board case. Removed from Agent 6's list (docs/briefs/agent-6d-brief.md item A3 is cancelled; Agent 6 should instead check that a new player stuck on a dead board can reach another dock by free travel).

## Andy's decisions 2026-11-11 (evening)
- Guaranteed starter job: NOT needed (free travel solves being stuck). Dropped from the 6d plan.
- Tap empty space in system view: returns to the star-centred view (added to Agent 3's 3g brief, item 6).
- Liveries are built TOGETHER with the new gameplay: Agent 4 (L1, saved paint jobs, price 500 each, docs/briefs/agent-4g-brief.md) in parallel with Agent 3 F2a (render glue for buildShipModel(shipId, liveryId), item 7 of 3g). Agent 5 F2b then adds the Shipyard picker, wires the worn livery into views, the Fly here button and the Explorer row. Then Agent 6 QA (6d, without the starter job).

## Agent 3 stage F2a (3g) (2026-11-11): DONE, Andy approved each part by clicking; Lead review passed
- Floating scene (layout A): ship circles a planet with no dock; camera button cycles Orbit / Free / Cockpit (icon is a placeholder for Agent 5). Free trips use the same launch/warp/arrival from and to planets with or without docks; camera continuous through phases; dock arrivals hold the warp view first. Tap on empty space in system view returns to the star view (done). Liveries wired through buildShipModel, docked, flight, shipyard preview (nothing picks one yet).
- API for Agent 5: api.showFloating(planetId), api.floatingPlanetId(), api.leaveFloating(), api.startFlight (planets without a dock allowed), api.setShip(id, livery?). Floating scene = state.screen "flight" + state.floatingPlanetId.
- Not verified: phone TRIS/frame rate, touch in Free view. sound.ts does not know the 1.6x longer free-trip phases (to Agent 5 in F2b). Unused layouts B and C can be deleted (cleanup). Keep the rule: sound test counts `launchSeconds:` in flight.ts.
- WAITING: Agent 4 L1 (4g report) before the Agent 5 F2b brief (needs the livery API).

## Agent 4 stage L1 (4g) (2026-11-11): DONE, Andy checked on /game-debug.html; Lead review passed
- Paint jobs in rules and save: getLiveryCatalog, buyLivery, setLivery, currentLivery; per-ship owned/worn; 500 credits each extra, standard free; buy only at a dock; id table checked by a test against liveriesFor; old saves load. Income: one paint job ~6 min for a sensible player, ~1 h for a casual one; all 9 extras 4,500. Nothing retuned.
- Note: Actions green on main (8903a91).
- NEXT: F2b Agent 5 (brief docs/briefs/agent-5f-brief.md): Fly here button, floating panel, arrival line, Explorer row, camera icon, Shipyard paint picker + wear wiring, sound timing for free trips, hints. Then Agent 6 QA (6d, no starter job), then 7d release page, v1.0.

## Agent 5 stage F2b (5f) (2026-11-11): DONE, Andy click-tested on phone (upright and sideways, all "matches"); Lead review passed
- FLY HERE on planet card (option B), floating screen with WHAT NOW? (option C, top right), free-arrival note with discovery credits, Explorer row in Ranks, paint jobs in the Shipyard card (option A, Wear now, worn paint on pad/flight/floating), pixel-eye camera button (CSS only), free-trip flight sounds (1.6x phases), hints on Jobs and Explorer. 683 tests, Actions green. Only src/ui, CSS, ui tests.
- Not verified: free-trip sound by ear; camera styling depends on render button title ending " view"; first-time hints need a "seen" flag (not approved).
- ALL planned features are now built: universe v2, free travel + discovery + Explorer, paint jobs, planet looks, title, sound.
- NEXT: Agent 6 QA/balance (brief docs/briefs/agent-6d-brief.md, updated: no starter job, new systems, old-save whole-path lesson), then Agent 7 release page (7d) and v1.0.

## Offline app roadmap (Andy approved 2026-11-12)
- Approved: installable offline app (PWA), save file moving (export/import), offline test workflow. Roadmap: docs/ROADMAP-offline-app.md. Stages: P1 Agent 1 (manifest, icons, service worker, safe updates), P2 Agent 6/4 (export/import logic), P3 Agent 5 (Save panel + install hint), P4 Agent 6 (offline test workflow `npm run offline-check` + phone checklist), P5 Agent 7 (icon, release page). Approved small save field: a "seen" flag for the install hint.
- General QA (6d) is optional/skipped; P4 is the offline QA. Release page 7d merges into P5.
- P1 started (2026-11-12): Agent 1 brief docs/briefs/agent-1b-brief.md. Kill switch required; developer pages stay online-only; installed iPhone app starts a new game until P2/P3.

## Agent 1 stage P1 (1b) (2026-11-12): DONE, merged, Andy installed on iPhone and checked offline (airplane mode); Lead review passed
- Installable offline app: manifest, placeholder icons (public/icons, replace in P5), service worker built from the file list with SHA-256 checks (all-or-nothing box), safe update (REFRESH note when no job/trip/flight), developer pages online-only (friendly page offline), kill switch (pwa-mode.txt = retire; README 4b). 714 tests, Actions green, 19/19 headless checks on a stand-in.
- Not verified: Android, desktop install, real iPhone cleanup, the update note on a real device (check after next publish), kill switch on a real phone, headless run on the REAL built game (P4). Corrected plan: a first visit made offline is impossible; P4 test 7 now = stored copy wiped.
- Andy: please delete the leftover branch `p1-retire-test` on GitHub (Code > Branches > trash). Never merge it.
- Suggestion awaiting Andy: test-speed switch in SETTINGS for the installed app (no address bar to add ?speed=).
- NEXT: P2 Agent 6 (docs/briefs/agent-6e-brief.md) save export/import logic; then P3 Agent 5, P4 Agent 6, P5 Agent 7.

## Agent 6 stage P2 (6e) (2026-11-12): DONE, Andy checked on /game-debug.html (export, wipe + import, refusals, undo); Lead review passed
- Save file logic in src/save: exportSaveFile, inspectImport, applyImport, undoImport; checksum (not a security lock); backup slot lazy-freight.save.beforeimport; lazy-freight.save.generation stops an open game's autosave from overwriting an import; src/save handles the sound key itself (layer rule) with a test equal to src/audio/prefs.ts. 747 tests; Actions green. appVersion is null (suggestion: version number in the build, P5).
- NEXT: P3 Agent 5 (docs/briefs/agent-5g-brief.md): SAVE FILE panel, install hint (+ "installHintSeen" save field approved), tip in installed app. Then P4 Agent 6, P5 Agent 7.
- Andy approved (2026-11-12): TESTER speed switch in MENU > SETTINGS for the installed app (key lazy-freight.testspeed, applied after reload, ?speed= wins). Added to Agent 5's P3 brief (item 5; smallest edit in src/game/clock.ts allowed).

## Agent 5 stage P3 (5g) (2026-11-12): DONE, Andy tested on iPhone (Safari export, file import into the installed app, garbage refused, undo, tester 60x across restart, install hint once, upright/sideways); Lead review passed
- SAVE FILE panel (option A), side-by-side import confirm (A), undo, install hint once per device (A) + "import your game" tip in the installed app, TESTER speeds 1/10/20/60/300/1000x stored outside the save (lazy-freight.testspeed; startSpeed() in src/game/clock.ts, the only edit outside src/ui). 761 tests; Actions green.
- Fixed on the iPhone: the keyboard changed "LFSAVE1:" to "lfsave1:"; paste box has no autocorrect and the UI repairs the start and stray spaces before src/save checks (checksum still refuses damage).
- Lead DECISION: hint-seen flags in their own slot lazy-freight.hints (per device, never exported) is accepted (instead of a save field).
- Not tested: Android install button.
- NEXT (parallel, different files): P4 Agent 6 offline test workflow (docs/briefs/agent-6f-brief.md; general QA 6d stays skipped) and P5 Agent 7 icon + version + release page (docs/briefs/agent-7d-brief.md). Then v1.0.

## Small change G1 (Andy 2026-11-12)
- Jobs stay capped at 25 ly. Free travel is capped only by fuel on board (the game already works so). ALL range circles removed from the galaxy map; "in fuel range" wording removed; map radius follows the real reach of the ship's fuel (capped after measuring). Brief docs/briefs/agent-3h-brief.md (Agent 3, runs in parallel with P4 and P5: different files).

## Bug S1 (Andy 2026-11-12): opening the game stops other apps' media (YouTube, Spotify) on iPhone
- Brief docs/briefs/agent-7e-brief.md (Agent 7, src/audio only): audio session "ambient" so the game mixes with other audio. Open: with mixing, game music plays on top of Spotify; options to Lead. Silent switch will mute the game with ambient.
