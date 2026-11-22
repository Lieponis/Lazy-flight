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

## Agent 3 stage G1 (3h) (2026-11-12): DONE, Andy confirmed all four checks; Lead review passed
- Range rings, FUEL_RANGE_LY and "in/out of fuel range" removed. Map size follows reach: at least 35 ly, else ceil(reach+3), cap 75 ly (1,970 stars, ~15,800 triangles, 16 ms to list on a computer); beyond it the map says "Farther stars are out of the map for now." Full-tank reach: Hauler 30 ly, Liner 50, Scout 55 (tank upgrades add more). Free travel has no distance cap, only fuel; jobs stay 25 ly. Testing aid ?reach=NUMBER. Glue: reachNow() + api.setReachLy in src/ui/index.ts.
- Not verified: phone frame rate at 75 ly (15,800 triangles is heavy for a phone: if slow, lower the cap to 60 or use a cheaper star shape); "Farther stars" line on a device.

## Agent 7 fix S1 (7e) (2026-11-12): DONE, Andy verified on iPhone (Safari tab and installed app); Lead review passed
- navigator.audioSession.type = "ambient" (feature-detected, never throws), set before the AudioContext is created on first tap and again on rebuild/resume. Spotify/YouTube never stop, both mix, game keeps sound after switching apps, silent switch mutes the game. Only src/audio. 776 tests; Actions green.
- Music now plays on top of the player's own music. Lead recommends option A (keep: music slider at 0 or the speaker button already does what a separate toggle would). Options B (lower default) and C (toggle) not built; awaiting Andy's choice.
- Not tested: Android, iPad, iOS version unknown.
- DECISION (Andy 2026-11-12): music option A, keep as is (S1 closed). Players use the music slider or speaker button.

## New request E1 (Andy 2026-11-12): rare Earth-like planets
- Blue oceans, green land, white clouds; 2-3 % of planets; render-only (planetlook.ts), no rings on them, no gameplay effect. Brief docs/briefs/agent-7f-brief.md (Agent 7, separate chat from P5). Suggestion (not approved): an "Earth-like" tag on the planet info card.

## World seed and unique names (Andy 2026-11-13): APPROVED
- ONE shared, non-changeable world seed (12345, so existing saves continue); every name unique in the whole universe: system "Kopipex 4F-92" (style B) plus a small share of pure unique names; planets "<system> II"; docks unique too. Plan docs/plan-unique-names-world-seed.md. Stages: N1 Agent 2 (docs/briefs/agent-2c-brief.md), N2 Agent 4 (seed lock + dev flag + move/refund for other seeds), N3 Agents 5/3 (menu entry removed, longer names fit everywhere), N4 Agent 6 optional.
- Multiplayer stays out of v1; the shared seed keeps the design ready (same seed = same map for everyone, players differ only by coordinates).

## Agent 2 stage N1 (2c) (2026-11-13/14): built; merged to main by the Lead, BUILD RED (slow test), live game unchanged
- Review: passed on content. Only names changed (byte-identical proof over 9.6 MB for 5 seeds), 0 collisions, WORLD_SEED 12345, codes like "Kopipex 2N-83", 4,200 pure names (about 6.9 % of systems within 150 ly, none beyond ~190 ly), planets "<system> II", docks with fullName. Name limits: system 42, planet 47, dock full name 75 letters.
- PROBLEM: after the merge, "Build and publish" on main failed twice: tests/balance-sim.test.ts "players who keep a small reserve ..." timed out at 5 s (took 6.0 s; on main before N1 it took 2.6 s, on the branch check 4.75 s). Either the name code slowed down the hot path (each dock/job call builds names) or CI is slow. The red build does NOT publish, so the live game still runs the previous good version. Fix assigned to Agent 2: (1) find out why the sim got ~2x slower and cache/avoid name building in the hot paths; (2) give that test a longer limit (Agent 6 had flagged slow tests before).
- Also noticed: Agent 7d (v1.0.0, icon, version, release page) and Agent 7f (Earth-like planets) have reports on main; status.md entries for them still to be written by the Lead.

## Agent 7 stage P5 (7d) (2026-11-12/13): DONE, v1.0.0 PUBLISHED, verified by Andy
- New icon (option A, ringed planet, drawn by code), version 1.0.0 in package.json shown on the title screen and in the save file (appVersion), release page https://lieponis.github.io/Lazy-flight/about.html. 797 tests at that time. Lead review: passed (read from the report; Andy verified icon, title version and page).

## Agent 7 stage E1 (7f) (2026-11-12): DONE, Andy: "keep"
- Rare Earth-like planets (options A and C together, fewer clouds), 2.41 % of 5,193 planets, only OCEAN/JUNGLE/ROCKY types, no rings or surprising colours, no gameplay effect; later outposts placed on a coast. Filter /planets.html?filter=earthlike. 788 tests then. Lead review: passed.
- N1 follow-up (Agent 2): names cached, simulation test limit 30 s; "Build and publish" on main is GREEN again (81126e6). Andy still to check /debug.html (names, search, collisions 0).
- NEXT (parallel, different files): N2 Agent 4 (docs/briefs/agent-4h-brief.md: seed lock, ?dev=1, other-seed saves moved + refunded), N3a Agent 5 (docs/briefs/agent-5h-brief.md: names fit every menu), N3b Agent 3 (docs/briefs/agent-3i-brief.md: names fit the 3D screens). Optional N4 Agent 6.

## Agent 4 stage N2 (4h) (2026-11-14): DONE, merged, Andy checked live; Lead review passed
- planStart: seed is always WORLD_SEED (12345); ?seed= only with ?dev=1 (?dev=1 alone continues a save on another seed untouched); saves on another seed are moved + refunded by migrateSave(save, toSeed) (credits, ships, upgrades, paint jobs, job counts kept; trip cancelled; outposts refunded; explored places forgotten, so the Explorer rank resets because it is computed from explored places); message shows once. NEW GAME deletes the save and restarts on the world seed; "New random universe" and the seed line removed from the menu. Import judges a file against the world seed (otherSeed flag; placeholder wording for Agent 5). Developer pages keep ?seed= without the flag. 24 new tests; Actions green (25d34ff).
- Known: a developer save on seed 777 is moved by the next normal load; other open tabs on old code can write their old seed back.
- WAITING: N3a Agent 5 (docs/briefs/agent-5h-brief.md) and N3b Agent 3 (docs/briefs/agent-3i-brief.md): names fit every screen. Then optional N4 Agent 6.

## Agent 5 stage N3a (5h) (2026-11-16): DONE, Andy checked live; Lead review passed
- Long unique names fit every menu/card: one-line spots shorten the word part and keep the code (Andy chose B), cards wrap with codes kept whole, place on its own strip line on phones, nickname only on scenery planet cards, doubled screen title hidden when docked or floating (Andy chose A, via body classes ui-docked-on / ui-floating-on and render classes .hud-title / .fh-title), NEW GAME wording. 862 tests, Actions green (c2db31b, c658b2f, 748976a). Only src/ui, CSS, tests.
- Not verified: the 75-letter names (far systems are not reachable in play) were tested only in a headless browser by Agent 5; Android.
- Rule for Agent 3 (added to its brief): do not rename .hud-title / .fh-title. destinationName given to render is still the dock short name.
- Open Andy decision: gentler Explorer rank rule for carried-over saves ("simple" = rank restarts, recommended; "gentler" = store the rank number separately).
- WAITING: N3b Agent 3 (docs/briefs/agent-3i-brief.md), then optional N4 Agent 6 QA.

## Decisions 2026-11-16 (Andy)
- Explorer rank for carried-over saves: "simple" (the rank restarts in the shared universe). Closed.
- Full QA YES, before a big change that Andy has announced (not yet described). Brief docs/briefs/agent-6g-brief.md = P4 (offline tests, brief 6f, never delivered) + general QA/balance (brief 6d, updated for the world seed, unique names, free travel, paint jobs, save file, map reach). Starts after N3b (Agent 3) is verified, or earlier if Andy prefers (they touch different files).

## Feasibility check, spiral-disc galaxy (2026-11-16, Andy request): see docs/feasibility-galaxy.md
- Verdict: feasible but a universe + map + economy rebuild (about 6 to 8 stages). Key risks: variable-size cells needed, rim strand (ships reach 30 to 82 ly, rim spacing 150 to 170 ly), job radius, map cannot show every real system in a view direction (layers: diamonds, near pixels, far glow). Awaiting Andy's decisions (section 5). Nothing approved or built.

## BIG CHANGE approved to start as prototypes (Andy 2026-11-16): spiral-disc galaxy
- Decisions in docs/feasibility-galaxy.md section 6: about 20 billion systems; spiral shape only (no orbiting); start at 1/3 from centre to rim; map: nearest 10,000 tappable, rest faint back-drop; jobs by nearest docks by count; QA paused until after the galaxy.
- G1 Agent 2 prototype (docs/briefs/agent-2d-brief.md, branch galaxy-proto, never merged) and G2 Agent 3 map prototype (docs/briefs/agent-3j-brief.md, preview page only) run in parallel; go/no-go with Andy after both. Agent 3's N3b (names fit 3D screens) is still running: finish N3b first if it is not done.
- Andy 2026-11-16 (late): sky must be a projection of the galaxy from the player's position (Elite Dangerous style), with a faded cloud beyond the nearest stars. Added to the Agent 3 and Agent 2 prototype briefs; agents already running must reread them. See docs/feasibility-galaxy.md section 9.

## N3b / 3i DONE and accepted (Lead 2026-11-17)
- Agent 3 report docs/report-agent-3i.md. Long unique names fit 3D screens (look B), full unique name on cockpit, "Sharp" text, Actions green, Andy's click-tests matched. Glue: only `flightName` in src/ui/index.ts.
- Not verified: real shader and frame rate on phones, TRIS counter, galaxy-map label with worst-case name. If a phone is slow: `SCREEN_SUPERSAMPLE` 3 -> 2 (screendata.ts).
- Rule: do not add more `launchSeconds:` / `this.phases = ` literals in flight.ts (tests/agent6c).
- Two name-shortening helpers exist (ui and render). Suggestions (unapproved): shared pure folder; compact layout when zoomed out; fix vertical stretch of screen pictures.
- Agent 3 is now free for G2 (docs/briefs/agent-3j-brief.md).

## G1 galaxy generator prototype DELIVERED (Agent 2, branch galaxy-proto, report docs/report-agent-2d.md on that branch) - Lead 2026-11-17
- Built and tested (31 tests): 17.88 billion systems, 4 log-spiral arms, polar cells, 8 slots per cell, ids up to 4.66e10, 9-symbol codes for 85% of systems, 10M random systems all unique, exact-repeat maths (detmath). lineIntegralDensity included (sky cube 6x32x32 in ~60 ms).
- Numbers: nearest 10,000 at start in 26 ms (cloud; phone est. 80-160 ms); start on inner arm edge, 8.0 ly spacing, 126 systems within 25 ly, 3,349 within 75 ly, nearest 10,000 reach 107.7 ly. Rim: nearest system 80-250 ly away.
- Recommendation GO with conditions: phone timing + iPhone checksum (with G2); game queries by count only; Andy's choice start at arm edge (8.0 ly) vs arm middle (6.7 ly); rim policy.
- Lead verdict: accepted as prototype. Waiting for G2 (Agent 3 map preview) before go/no-go. Section 9 of the report = v3 change list by layer (use it for G3-G6 briefs).

## G1 phone check CLOSED, G2 delivered (Lead 2026-11-17)
- G1: Andy's iPhone: timings 5 ms (nearest 10,000 at start), 28 ms (60,000); checksum d0019075 OK (matches computer). G1 = GO, no open phone condition.
- G2: Agent 3 report docs/report-agent-3j.md: verdict GO, phone FRAME line still open. Live page /galaxy-map-preview.html. Caps proposed: diamonds 5,000 (phone max 10,000), tappable 10,000, near pixels 60,000 (30,000 if slow), sky 60,000 dots at 64 size (32 if slow). Sky changes visibly after: dots 20-200 ly, glow 200-500 ly (not at rim). Section "What must change in the real map code" = G5 brief base.
- Open for Andy: phone numbers on the preview (FRAME, SKY BUILT, TAP lines, smooth/choppy), AUTO reach = the diamonds-at-rim he meant?, shape near stars like the galaxy at rim (suggestion yes/no), start spot (arm edge vs arm middle), rim policy.
- Next: go/no-go after Andy's phone numbers; then G3 briefs (Agent 2 universe v3 using report-agent-2d section 9).

## GO GALAXY (Andy 2026-11-17): universe v3 stages start
- G2 phone check closed (iPhone 17 Air, 60 fps); tap fix confirmed. Agent 3 finishes shaped near stars (thin disc at rim kept, rim zoom limit 823 ly) in parallel.
- G3 Agent 2: brief docs/briefs/agent-2e-brief.md. Work on NEW branch `universe-v3` from main + galaxy-proto merged. NOTHING merges to main until the whole branch is green and Andy has played it. Main stays playable. Expected: tests outside src/universe fail on the branch until G4/G5.
- Next after G3 report: G4 Agent 4 (game/save: migration, reach/fuel, explored cap, job rules), G5 Agents 3 and 5 (real map from agent-3j report, names, UI), G6 Agent 6 (balance, QA, offline tests, phones, brief agent-6g). Rim policy still open.
- Correction (Agent 3, 2026-11-17): rim zoom limit on the live preview is 823 ly (not 829). G2 closed. G5 brief waits for the G3 API (report-agent-2e) and G4.
- Andy 2026-11-17: YES to "per-system sky" (Agent 3 report-agent-3j step 1): `starfieldPositions` gets an optional seed argument (default = today's number so old calls stay identical); each system/flight/dock/floating view passes a number made from the system id. Decoration only, no physics. Goes into the G5 brief (needs the new system numbers, so it waits for G3). Step 2 (sky function with the band) stays later.

## G3 universe v3 DELIVERED (Agent 2, branch universe-v3 head b2095e2, report docs/report-agent-2e.md on that branch) - Lead 2026-11-17
- Accepted. Galaxy moved to src/universe/galaxy (checksum d0019075 unchanged); ids = numbers, planet/dock id "<number>/<index>", old ids give null (`isLegacyId`); NearCache, nearestDocks; jobs from the 12 nearest docks, no distance limit; start = Bimvik Deep JR62R-MT37, dock 44776692551/2; UNIVERSE_VERSION 3; fingerprints pinned (12345 a8bc7ccf:483603).
- Numbers: docks 1.4/system everywhere; docks within 25 ly: centre 15,553 / start 172 / middle 8 / rim 0. Job trips: start 0-35 ly, rewards 62-4,306; middle up to 136 ly; rim up to 646 ly, rewards up to 68,566. Rim nearest dock 71 ly.
- Branch Actions red as expected: 26 type errors outside the universe layer (game.ts, render/*, models.ts, planets.ts, game-debug.ts) and ~25 test files stop at import (`listSystemsNear`). Work list for G4/G5 = section 9 of the report; save migration facts = section 10.
- Open: rim policy; reward flattening with distance; reach/fuel rules. Agent 4 G4 brief waits for Andy's two decisions.
- Andy decisions 2026-11-17 (after G3): rim = LATE long-range ship later (not in v3; for now player protected: only trips fuel can finish, no strand); job reward flattened beyond 50 ly (square-root style, Agent 4 proposes curve, may edit only the reward calc in src/universe/jobs.ts and re-pin job fingerprints).
- G4 Agent 4 brief: docs/briefs/agent-4i-brief.md (branch universe-v3 from b2095e2; first step: docs/universe-v3-game-api.md so Agents 3 and 5 can start G5; own branch-only workflow check-game.yml).
- Andy is running his three G3 checks on /debug.html, /galaxy-debug.html and a job board (artifact links in report-agent-2e section 12); iPhone check: start system name "Bimvik Deep JR62R-MT37" and first job reward 230 credits ("33 x Moon Biscuits to Polite Sprocket Station").

## G4 game and save on universe v3 DELIVERED (Agent 4, branch universe-v3, report docs/report-agent-4i.md) - Lead 2026-11-17
- Accepted. check-game.yml green (539 tests; balance-sim 3.5 s). Reward curve: full pay to 50 ly, then 50*sqrt(1+(d-50)/25) (650 ly trade 3,080 instead of 7,880); fingerprints unchanged. Explored cap 100,000. Jobs show reach now/refuel/never; far dock = messages, no crash.
- Finding: not every dock within 100 ly has 2 doable jobs: 93% of boards 1+, 74% 2+, 1.5% dead ends; start dock always 2+. Lead decision: ACCEPT for now; suggestion "one short guaranteed job per board" goes to G6 (balance) if QA finds it annoying.
- G5 briefs written: docs/briefs/agent-3k-brief.md (render, real map, sky, per-system sky, planets.html) and docs/briefs/agent-5i-brief.md (reach states, messages, rebuilt text, names). Order: Agent 3 Step 1 compile fix first, then Agent 5 starts; same branch, different files.

## Branch preview published at /Lazy-flight/preview/ (Lead 2026-11-17)
- Andy cannot set up hosting: `.github/workflows/deploy.yml` now also builds branch `universe-v3` (VITE_PREVIEW=1, no type check) into dist/preview. Preview steps are continue-on-error; a broken preview is removed and never blocks the live game. Rebuilds on every push to main, twice an hour (cron 7,37), and by hand.
- Safety: the preview uses its own save box (prefix "preview-v3:", src/previewboot.ts, Agent 3, test tests/previewstorage.test.ts), shows a PREVIEW tag and runs no offline helper. The live site's helper handles /preview/ as network-only (not touched).
- Remove the preview step (and the cron) when universe-v3 is merged into main.

## G5a (render, map, sky) and G5b (screens) DELIVERED (Agents 3 and 5, branch universe-v3; reports docs/report-agent-3k.md, docs/report-agent-5i.md) - Lead 2026-11-18
- Accepted. Andy checked on his iPhone: map at centre/start/middle/rim 60 fps; smaller diamonds at the centre "better"; per-system sky "different"; job card badges (READY TO FLY / REFUEL FIRST / TOO FAR FOR THIS SHIP) and board messages "Ok"; rebuilt-note and import texts "Ok". Check runs green on the branch (1,127 tests).
- Preview timer unreliable (ran once in 10 h): added `.github/workflows/preview-refresh.yml` (main): after "Check the game layer" finishes on universe-v3 it starts "Build and publish" by itself.
- Open: far-dock text says "next dock 94.7 ly" even if the same system has another dock (src/game text, Agent 4 small fix); sky has NO bulge (universe is a thin disc): Andy decides if Agent 2 adds a bulge to densityAt; title text glitch screenshot (Plaboo 53J25-4557) not reproduced; planets.html not confirmed by Andy yet.
- Next: G6 (Agent 6): QA, balance, offline-app update path, phones; then MERGE universe-v3 into main after Andy has played it. Before the merge Andy must EXPORT A SAVE FILE from the live game (SAVE FILE menu).
- G6 Agent 6 brief: docs/briefs/agent-6h-brief.md (QA, old saves through the whole path, offline update path, balance on v3, performance, far-dock text fix, verdict MERGE READY or not). Merge of universe-v3 into main only after that verdict and Andy's play-through; remove the preview step from deploy.yml and the preview-refresh workflow at the merge.
- Andy 2026-11-18: YES, add a central bulge (the real galaxy is a thin disc; the sky had no bulge). G7 Agent 2 brief docs/briefs/agent-2f-brief.md: three sizes A/B/C as pictures; HARD RULE: start region and everything beyond ~8,000 ly unchanged (checksum d0019075, start system Bimvik Deep, ids, names, fingerprints). Then a small Agent 3 check of map/sky at the centre. G6 QA (agent-6h) HOLDS until the bulge is in.

## G7 central bulge DELIVERED (Agent 2, branch universe-v3 head 5a14045, report docs/report-agent-2f.md) - Lead 2026-11-18
- Accepted. Andy chose size C (radius 5,500 ly, 9,900 ly tall, smooth rise out of the disc). Separate bulge system numbers after all disc numbers (46.6 to 82.7 billion); 80 saved before-samples all match: no old system changed; start checksum d0019075, start system and dock unchanged; only centre checksum re-pinned (2bfcbd0f). Total 20.1 billion systems. Nearest 10,000 still 10/17/25 ms. Deviation: centre spacing 1.48 ly (was 1.8), `peak` in params.ts lowers it (0.25 x 1/1.8^3 ~ 1.67 ly, fainter).
- Next: G7b Agent 3 small check of map/sky at the centre (render may miss the bulge above 1,000 ly; sky steps near the viewer; bulge cells are cubes; ids up to 8.27e10). Then G6 QA (agent-6h; add: getSystem above 46.6 billion, disc+bulge close pairs, galaxy-debug page on phone).
- Agent 3 report v5 accepted (backdrop instant, faint system-view backdrop, Andy confirmed on iPhone). Preview rebuild issue: already fixed by `.github/workflows/preview-refresh.yml` (verified: runs after every branch check, success). Red "Check a branch" on universe-v3: only 2 tests in tests/galaxy2-bulge.test.ts time out on CI (slow search 76 s, number-uniqueness 30 s; whole check 131 s); centre checksum is already pinned (2bfcbd0f) and passes. Agent 2 must make them fast (smaller samples, same proof) BEFORE the merge, because "Build and publish" runs npm test on main. Agent 3 G7b check (bulge in map/sky) still to be sent.
- Andy 2026-11-18: QA must be lean to save usage. docs/briefs/agent-6h-brief.md rewritten: 6 checks only (CI green; old saves through the real load path incl. one exported from the live game; offline update path + one 5-tap phone checklist; far-dock text fix; small balance sanity on the world seed with 3 player types; two bulge spot checks), short report with a MERGE READY verdict. No 30-seed run, no full regression, no performance study.
- G7b DONE (Agent 3, report docs/report-agent-3l.md): sky shows the bulge at start, middle, 10,000 ly; far backdrop was 2.7x too bright, fixed; map works for numbers above 46.6 billion (spacing above/below the plane fixed). iPhone at the centre: sky built 1,053 ms, 60 fps. 1,183 tests green. Open for Andy: centre zoom-out limit and diamonds ~25% too big (needs his OK to change); two dark smudges in the system view (new or old?).
- G6 lean QA (agent-6h) may start after Andy's answers; Andy exported a live save already.

## G6 lean QA DELIVERED (Agent 6, report docs/report-agent-6h.md on universe-v3, head 5e6d8f6): verdict MERGE READY - Lead 2026-11-18
- Andy's live save (universe 2, 3 ships, 3 paint jobs) and 4 old saves migrate correctly (credits/ships/upgrades/paint/ranks kept, job/trip cancelled, outposts refunded, note once, import same). Offline update main -> v3 passes the robot (helper versions a0ef0d72ef2b -> 3c7dc917daa6); iOS installed-app handover only provable on a phone (5-step checklist in the report, section "Andy's phone checklist"). Far-dock text fixed. Balance: no blocker; Andy decisions later: (1) first ship at ~25 min instead of ~2 h (raise Scout price e.g. 1,200 -> 3,000, or lower pay per ly, or keep); (2) lazy/no-ship player waits 12.5 of 30 h (hint on empty board?).
- MERGE BLOCKER FOUND by the Lead (trial merge, nothing pushed): main has Agent 3's G2 shaped-near-stars commits (1798614..3ebcf30, src/render/galaxy/*, tests/galaxysky.test.ts) that universe-v3 does not have; conflict in src/render/galaxy/neardata.ts. Fix: Agent 3 merges main into universe-v3 (keeping the v3 map code), CI green, then the Lead merges universe-v3 into main. At merge: remove the preview step from deploy.yml and delete preview-refresh.yml.

## Safe copy before the big merge (Lead 2026-11-18)
- Branch `backup-before-galaxy` points to main commit 2f7b995 (the last main with universe v2). A tag and a GitHub Release could not be created from this session (blocked); the branch is the safe copy. Roll back: on main run `git revert -m 1 <merge commit>` (keeps history) and push; "Build and publish" then publishes the old game again. Saves migrated to v3 are not understood by the old game: use Andy's exported save file (SAVE FILE menu) after a rollback.

## BIG MERGE DONE: universe-v3 merged into main (Lead 2026-11-18)
- Merge commit message "Merge universe-v3: the spiral galaxy ...". Preview step and cron removed from deploy.yml, preview-refresh.yml deleted. Preview code (VITE_PREVIEW) stays, harmless without the flag. Old version safe on branch `backup-before-galaxy`.
- Next: watch "Build and publish" (runs the tests, then publishes); Andy does the 5-step phone checklist (docs/report-agent-6h.md "Andy's phone checklist"); then open items: first-ship pacing decided (prices x2.94, Scout 3,528, Liner 7,350), no-ship player hint (Andy undecided), faint backdrop on docked/flight screens, diamond legend, name-shortening merge, QA leftovers (320 px width cut, npm audit), late long-range ship (suggestion).
- Andy 2026-11-18 13:06: phone checklist after the merge "All ok" (installed app updated, universe rebuilt note, credits and ships kept, offline relaunch). UNIVERSE v3 / BIG CHANGE COMPLETE and live. Backup branch backup-before-galaxy stays.

## After the merge: next small tasks (Andy agreed the order, 2026-11-18)
- Order: (1) empty-board hint for no-seat players, (2) faint backdrop on docked and flight, (3) legend under the map, (4) small QA leftovers, (5) late long-range ship (needs Andy's design decision).
- Briefs: docs/briefs/agent-5j-brief.md (items 1 and 3, Agent 5), docs/briefs/agent-3m-brief.md (item 2, Agent 3). Item 4 and 5 later.
- Andy asked: Agent 8 draws rough 2D sketches of 9 future ships (3 cargo, 3 passenger, 3 explorer), inspiration only, nothing in the game: docs/briefs/agent-8-sketches-brief.md (files only in docs/concepts/ship-sketches/). The "max 3 ships" rule is untouched.
- Agent 5j DONE (report docs/report-agent-5j.md, commits 2b6b523, 05a7e44; live): Andy chose B for both: board line "Passengers are waving at you, but your ship has no seats. A cabin ship from the SHIPYARD can carry them." (title PASSENGERS WAITING when alone) and map legend "Diamonds: stars you can reach. Little dots: too far for now." Checked live on his phone: Ok. One deploy (2b6b523) failed on tests/starfield.test.ts from Agent 3's parallel change; the next push fixed it; live never broke. Agent 8 sketches pushed (4c8b1eb, docs/concepts/ship-sketches/). Agent 3 (3m, docked/flight backdrop) still in progress.
- Agent 3 G8 (3m) DONE (report docs/report-agent-3m.md, main 45aa7fe, live): faint galaxy sky behind docked, flight (orbit and cockpit lens) and floating screens via one shared layer (src/render/systemsky.ts). Andy's iPhone Safari: docked 60 fps, flight in warp 60 fps, cockpit 60 fps. Two systems show different skies. ?mapstats=1 FRAME line works in Safari only (installed app cannot take a query).

## NAVIGATION (Andy 2026-11-18): MY PLACES + NEXT HOP helper + line on the map showing the hopping flight plan
- Problem: no way back to outposts, start dock or liked systems in a 20-billion-system galaxy. Andy chose three pieces (no tow service now; tow stays a suggestion). Defaults chosen by the Lead (change on request): recent docks 10, starred places 30, plan shows next 20 hops, hops land at docks within one FULL tank's reach, greedy with small look-ahead, no auto-fly.
- Briefs: Agent 4 docs/briefs/agent-4j-brief.md (logic, save, docs/nav-api.md FIRST), then in parallel Agent 3 docs/briefs/agent-3n-brief.md (line + markers on the map) and Agent 5 docs/briefs/agent-5k-brief.md (MY PLACES and FLIGHT PLAN screens). Agents 3 and 5 start only after nav-api.md exists.
- NAV-3 Agent 5k DONE (report docs/report-agent-5k.md, e4dc1d2, 81b04ba): MY PLACES (rows A, badges READY TO FLY / REFUEL FIRST / NEEDS HOPS), FLIGHT PLAN (B, big NEXT HOP card, FLY NEXT HOP, REFUEL, SHOW ON MAP, CLEAR DESTINATION), star buttons on docked view and planet card. Andy checked live on phone: Ok. Destination is stored in this browser only (localStorage lazy-flight.nav-target), not in the save (accepted). Fixed the 5j map legend that never showed. 1,304 tests green. NAV-2 (Agent 3): line look B (dashed) chosen by Andy; report-agent-3n and NAV-1 report-agent-4j not yet delivered.
- NAV-1 Agent 4 DONE (report docs/report-agent-4j.md, main): getPlaces (start, outposts, 10 recent, 30 stars), planRoute / nextHop (up to 20 hops, each at a dock, 3-18 ms, statuses ok/here/too-far-no-docks/stuck/no-such-place), equipped ship's upgrades used (Scout with upgrades hops 66 ly), within 1 hop of geometric minimum. Plan range = tank minus 1 fuel (Hauler 29 ly) because strand protection refuses trips leaving < 1 fuel; getPlaceInfo().rangeLy still says 30 (tiny mismatch, logged for QA). Balance note: 20 hops (549 ly) cost ~2,100 cr of fuel vs start-dock jobs 200-300 cr (Andy to decide later: exploring is expensive; options: keep, cheaper fuel/outpost discount, tow). Suggestions: cheapest plan preferring outposts; partial hops for stuck plans.
- NAV-2 Agent 3 DONE (report docs/report-agent-3n.md, main 3a76543, 022c906): flight-plan line on the map (look B dashed, Andy), markers (stops, refuel stops, target, start, outposts, starred, recent), edge markers with name and distance for far targets, RenderApi.showMapRoute camera help. Andy checked on iPhone incl. a far plan: "Perfect". Fix after Andy's video: icons shook while turning the map; markers are now a finer overlay layer (src/render/markeroverlay.ts), MAP_TURN_SMOOTH_MS = 0. iPhone: 60 fps with a 20-hop plan. Unconfirmed on a real screen: framing after FLIGHT PLAN > SHOW ON MAP, plans beyond ~20 hops (dim rest line), dash faintness over dense stars. NAVIGATION (NAV-1/2/3) COMPLETE and live.

## Black bars on the installed iPhone app: new lead (Lead 2026-11-22)
- Hotfix 2026-11-21 accepted (cause: far-dock star search, 390 MB; not the status bar). Offline play back on.
- Andy: Pocket Pilots (NimbleBit, https://pilots.nimblebit.com/, a WEB game) fills his whole screen when installed from Safari. Its tags: black-translucent + viewport-fit=cover (same as 224d654), manifest standalone, dark #0d1626. So the "iOS bug, impossible" conclusion is incomplete. Brief: docs/briefs/agent-5l-brief.md (install-time effect WebKit 316008, manifest, page background, canvas sizing).

## Edge-to-edge DONE + small UI tasks (Agent 5, Lead-checked 2026-11-22)
- Installed iPhone app now fills the screen (Andy checked on iPhone, iOS 26.6): black-translucent + in standalone html/body height auto, overflow visible, body min-height 100lvh; canvas 100% of #app. Real cause (measured with public/ios-fill-test.html): html/body height 100% + overflow hidden made iOS give the page 844 of 912 pt. So it was NOT an unfixable iOS bug; earlier "impossible" note was wrong. Brief 5l superseded. Main 5597fb1, deploy green, 1,353 tests.
- Also done: title 3D station sized from its own box (no stretch); phone status strip (line 1 CR, FUEL, speaker, MENU; line 2 place; fuel bar hidden under 380 px); MENU on every screen incl. warp (MENU_ANYWHERE; Jobs and Shipyard stay docked).
- Reinstall note: status-bar style is read at install time (WebKit 316008); Andy's app was already re-added, so fine. Other iPhone players must remove and re-add the app once to get the new look.
- Open: confirm the earlier small task (clear flight plan: X on map bar, CLEAR DESTINATION in MY PLACES, SHOW ON MAP not setting destination) is in; Agent 3: flight title still shows in flight (decided in 5h); fill-test page stays as a dev page (could be removed later); map still asks 60,000 stars far above the disc (suggestion for Agent 3).

## Three visual annoyances (Andy 2026-11-22) -> Agent 3, docs/briefs/agent-3o-brief.md
- (1) outposts stand on the ice pole of every planet type (only Earth-likes are turned to a coast); (2) stations show a still planet while docked, should visibly orbit slowly; (3) warp/flight sky has a fixed angle, must match real direction origin -> destination (centre ahead when flying to the centre).
