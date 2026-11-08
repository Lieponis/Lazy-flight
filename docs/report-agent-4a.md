# Agent 4 report, part 4a: first playable trade loop

## 1. What was built
Rules in `src/game/`: dock, pick a trade contract, fuel is burned, trip time from distance (max 4 h; same-system trips take 20 s), arrive, get paid once, funny debrief, refuel. A plain temporary panel in `src/ui/` (right side; "Hide" folds it away; folded by default on phones). 27 new tests in `tests/game.test.ts`. Trade jobs are contracts: cargo is free, reward paid on delivery. Starter ship: Cargo Hauler (30 cargo, no cabin, 60 fuel), so passenger and tour jobs are blocked, as intended.

## 2. How to check it
Open the live page with `?speed=120` added. Check credits/fuel/board, Accept a job, wait (a 3 h trip is about 1.5 real minutes), see credits rise and the starmap ring move, press Refuel.

## 3. Live link
The usual site address ending in `/lazy-freight/`, plus `?speed=120`.

## 4. Known issues, NOT verified
- I could NOT run `npm run check` (no installed packages, no network here). Not opened in a browser.
- I did run: the 27 new and the 29 universe tests with a stand-in test runner (all pass), and a strict type check of `src/game`, `src/universe`, `src/ui/panel.ts`. NOT type-checked here: the `src/render/index.ts` change, `src/ui/index.ts`, `src/main.ts` (they need Three.js). The green Actions run and Andy's click-test are the real proof.
- Job time limits (12 to 48 h) are NOT enforced in 4a.
- The starmap's teal ring is still a fixed 25 ly, not the real fuel.
- No saving: reloading the page starts a new game.
- With high `?speed`, short trips finish almost instantly.

## 5. Settings: `src/game/settings.ts`
STARTING_CREDITS (200); FUEL_PER_LY (2 fuel per light year); MIN_FUEL_PER_TRIP (1); REFUEL_PRICE_PER_UNIT (2 credits); TRAVEL_SECONDS_PER_LY (480 = 8 min per ly); SAME_SYSTEM_TRIP_SECONDS (20); MAX_TRIP_SECONDS (4 h); MAX_SPEED. Ship numbers: `ships.ts`. Funny lines: `debriefs.ts`. Edit a number, save, rebuild.

## 6. For Agent 3 (3b)
`game.state.currentJob` (full job, or null), `travelStartMs`, `travelEndMs` (game time, ms). `game.progress()` returns `{ fraction 0..1, remainingMs, totalMs }` or null. `game.clock.now()` is game time, `game.clock.speed` the speed. `game.subscribe(fn)` tells you when a job starts or ends. `startUi()` returns the `Game`.

## 7. For Agent 5
Panel shows: credits, fuel, location, current job with "arrives in" and progress, mission board with Accept or blocked reason, last debrief, Refuel. It calls only `game.accept(jobId)`, `game.refuel()`, reads `game.getBoard()`, `game.state`, `game.progress()`, `game.lastArrival`, and calls `game.update()` ~4 times a second.

## 8. For Agent 6: save this (`GameState`)
`{ credits, fuel, shipId, currentDockId, currentJob (full job or null), travelStartMs, travelEndMs }`. Also save the seed. Times are game ms; the clock starts at real "now" when the page loads, so on load shift the saved times by the same offset.

## 9. The change inside src/render
`src/render/index.ts` only: new `setCurrentSystem(systemId)` on the returned object. It rebuilds the starmap around the new system and updates `state.currentSystemId`.

## 10. Suggestions (not built)
- Per-dock fuel prices and outpost discounts.
- A free emergency refuel if fuel and credits both run out (rare dead end).
- Hide a job after it is done so it cannot be repeated.
- Make the starmap ring show the real fuel range.
