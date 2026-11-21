# Report Agent 4, stage NAV-1 ("4j"): My places and the hopping flight plan

Work on main. Commits: 869d39b (API doc), 7d333cf (places), d92f9c2 (planner, debug page), 05ad442 (upgrade/fewest-hops tests). "Build and publish" green on each. Andy's checks: doc seen; places and plan on the test page "ok"; old save "Good".

## What was built
- `docs/nav-api.md`: the contract for Agents 3 and 5 (ids, save fields, `Place`, `RoutePlan`, `RouteHop`, how to fly a hop).
- **MY PLACES** (`src/game/places.ts`, `Game.getPlaces/starPlace/unstarPlace/isStarred`): start dock, owned outposts, stars (max 30; the 31st returns `{ ok:false, full:true, reason:"You can star 30 places. Remove one first." }`), last 10 docks (newest first). One row per place with all its kinds (`["start","starred","recent"]`), distance, fuel, `reach` now/refuel/never like job cards. A star system number can be starred (its first dock). The dock you are docked at always counts as the newest recent.
- **Save**: new fields `recentDocks` and `starredPlaces`; old saves get empty lists; save version stays 1. Loading drops ids that do not exist; a moved save (other seed or old universe) forgets both lists. Recent docks are filled after every arrival (job delivery or free trip).
- **Flight plan** (`src/game/route.ts`, `Game.planRoute/nextHop`): every hop lands at a dock, at most 20 hops per call ("The plan shows the next 20 hops of about N. Ask again after you arrive."), pure, deterministic, read-only. Statuses: `ok`, `here`, `too-far-no-docks`, `stuck` (with `closestLy` and `gapLy`), and `no-such-place` (added to the doc; unknown or old-shape ids).
- Per hop: fuel, `refuelBefore`, estimated refuel credits (a full tank at the price of the stop you leave; cheaper where you own an outpost in that star system). Totals for the shown hops.
- Test page `/game-debug.html` section 13: places table with star buttons, plan presets, hop table, "Fly hop 1".

## How the plan chooses (look-ahead, as asked)
Greedy: ask the universe for the docks near a point one tank ahead (and 70% ahead), keep docks in other systems within reach, take the one that ends closest to the target. If none gets closer: 4 more directions (45 degrees to each side, up, down), then a two-hop look-ahead over the 6 best-placed docks (a small detour hop, then one that gets closer). Else `stuck`. The last hop lands exactly at the target dock when it is within one tank.

## Decisions and findings (please read)
1. **Hop length is the tank minus 1 fuel, not the whole tank.** The strand protection (kept, Andy's decision) refuses a trip that leaves less than 1 fuel, so a 30 ly hop with the 60 fuel Hauler is refused by `freeTravel`. The plan range is therefore 29 ly for the Hauler (`RoutePlan.rangeLy`; `getPlaceInfo().rangeLy` still says 30). The brief said "reach = getPlaceInfo().rangeLy"; using it would make the plan's first hop impossible to fly. Full-tank hops would need a change to the strand rule: Lead's decision.
2. **Fewest hops, equipped ship with upgrades** (Andy's instruction): the plan uses the equipped ship's tank and engine upgrades (test: tank level 3 gives longer hops and a shorter plan; the Scout with upgrades hops 66 ly). I tried a smarter search (best of the 4 and 12 closest docks, each looking one hop further): it found no shorter plan on 8 test trips (60/100/150/300/500/1000 ly) and was 4x slower, so it was dropped. Result: 3 hops for 60 ly, 7 for 180, 12 for 300 (geometric minimum 11), 19 for 500 (minimum 18), about 37 for 1,000 (minimum 35). A test keeps the plan within one hop (or 10%) of the minimum.
3. **Fuel cost of long trips (for balance, not changed):** with the Hauler every hop leaves 1 to 5 fuel, so every stop needs a refuel: 20 hops = 549 ly, 1,107 fuel, about 2,100 credits, while the start-dock jobs pay 200 to 300. Exploring far costs real money. Suggestion: look at this in a balance pass (Agent 6/Lead).
4. Dead ends at the rim: from a rim dock with no other dock within 29 ly the plan says `too-far-no-docks`; the blocked ways say `stuck` with the closest distance and the empty gap (found at 30,000 ly from the centre: gaps of 3.6 to 4.7 ly beyond one tank).

## Speed (ms for one `planRoute`, average of 5, this machine)
| case | ms |
|---|---|
| start region, 60 ly | 3 |
| start region, 1,000 ly (20 hops) | 18 |
| 300 ly out, 300 ly across | 17 |
| rim, stuck | 11 |
| rim, no docks in reach | 6 |
All under 50 ms, so no slicing was needed.

## Tests
`tests/nav1.test.ts` (15): places (kinds, order, once each, far places "never", stars incl. the 31st, system-number stars, unknown/old ids), recent docks (newest first, no duplicates, max 10, job delivery), save round trip, garbage repaired, nonexistent ids dropped on load, old saves (v1/v2 fixtures through the whole load path), moved save forgets lists.
`tests/nav1-route.test.ts` (19): hop lengths never exceed range, every hop a real dock, each hop closer, no system twice, last hop at the target dock, 1,000 ly gives 20 hops and the "next 20 of about N" message, same system / current place give `here`, system number target, unknown ids, rim `too-far-no-docks` and `stuck`, deterministic and read-only, time, refuel and credit sums, outpost discount, Scout needs fewer hops, upgrades, near-minimum hop count, flying three hops with the real `freeTravel` (arrival docks, recent updated, discovery counts).

## For the other agents (work list)
- Agent 3 (map): draw the line through `[current system, ...hops.map(h => h.systemId)]`; mark `getPlaces()` rows by `systemId` and `kinds`.
- Agent 5 (UI): MY PLACES list and FLIGHT PLAN screen from the two calls; show `message` for every status; call `planRoute` again after each arrival; if `refuelBefore`, `refuel()` first (docked only).
- `getPlaceInfo().rangeLy` (30) is not the plan range (29): show `plan.rangeLy` on the plan screen.

## Not done / suggestions
- No auto-fly of the whole plan (out of scope; one hop at a time).
- Suggestion: a "cheapest" plan variant (prefer stops with outposts for cheaper fuel).
- Suggestion: `stuck` plans could show the partial hops reached so far (now empty by contract).
- Local note: `tests/nav1*.test.ts` were run with a stand-in test runner here; the real runner is the cloud build, which was green.
