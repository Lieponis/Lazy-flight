# Agent 4 report, part 4b: safety net, three ships, passengers and tours

## 1. What was built
All in `src/game`, plus the test page. **Safety net:** `game.isStuck()` and `game.emergencyRefuel()` (free, 20 fuel, funny line, only when stuck). **Ships:** Cargo Hauler, Passenger Liner (1500 cr), Scout (1200 cr); buy at any dock, switch free, each ship keeps its own fuel. **Passengers and tours** are playable with a cabin; tours fly straight to the last stop and the stops on the way appear in the arrival debrief. **Test page** `/game-debug.html` (own game, plain text and buttons).

## 2. How to check it
Open `/game-debug.html`: add credits (TEST), buy and switch to the Liner, pick a dock with tours in the list, teleport (TEST), accept a tour, fast-forward (TEST), read the debrief. Then set fuel 0 and credits 10: "Stuck? YES", Emergency refuel works; with credits 5000 it refuses.

## 3. Live link
The usual address ending in `/lazy-freight/`, plus `game-debug.html`.

## 4. Known issues, NOT verified
- I could NOT run `npm run check` here (no installed packages). I ran: 38 new tests plus the old game, ui and universe tests with a stand-in runner (all pass), a strict type check of `src/game`, the new page script and `src/ui/logic.ts`, and a headless browser click-through of `/game-debug.html` (built with esbuild, not Vite): buy, switch, teleport, accept a tour, fast-forward, debrief, stuck, emergency refuel, refusal. No console errors.
- NOT checked: the real Vite build, the main game page, `/debug.html`, `/models.html`, phones. Actions plus Andy's click-test are the proof.
- Balance: in my sample, 29 of 44 tours need more than the Liner's 70 fuel, so many tours say "too far for this ship's tank". The Scout has the tank but only 2 seats.
- You can be blocked only by cabin or cargo (not fuel) at a dock: that is not "stuck"; switching ship or waiting for a new board helps.

## 5. Settings
`settings.ts`: `EMERGENCY_REFUEL_AMOUNT` (20 fuel). `ships.ts`: price, cargo, cabin, tank, description per ship. Other numbers as in 4a. Funny lines: `debriefs.ts` (goods, passengers, tours, emergency).

## 6. For Agent 5 (part 5b)
API: `game.getShipCatalog()` (rows: `ship`, `owned`, `active`, `canBuy`, `reason`, `canSwitch`, `fuel`), `game.buyShip(id)`, `game.switchShip(id)`, `game.isStuck()`, `game.emergencyRefuel()` (gives `units` and `line`). Failures give `{ ok: false, reason }`. **No new block codes**: the old `tank-too-small` is the "too far for this ship's tank" case (its text is now "Too far for this ship's tank: needs N fuel, the tank holds M."); `SHORT_REASONS` is unchanged. Suggested short wording: "Too far for this tank". Show the emergency button only when `isStuck()` is true, in the Jobs menu header; Shipyard = a list from the catalog with Buy and Switch.

## 7. For Agent 6
New state field: `ownedShips: { [shipId]: { fuel } }` = ships you own that are NOT active (the active ship is `shipId` + `fuel`). Old saves without it: call `game.loadState(saved)` (or `normalizeState`): it defaults to `{}`, repairs bad numbers and unknown ships.

## 8. For Agent 3 / Agent 8
Active ship id: `game.state.shipId` ("cargo-hauler", "passenger-liner", "scout"). Others owned: `Object.keys(game.state.ownedShips)`.

## 9. For part 4c
Rank and outpost perks (fuel discount) can hook into `refuel()` in `rules.ts` and `emergencyRefuel` stays free. `game.ts` is the place for new Game methods. State additions need a default in `normalizeState`.

## 10. Suggestions (not built)
- Lower `FUEL_PER_LY` or raise the Liner's tank so tours are playable more often.
- Let a ship "stuck by cabin or cargo" switch ships for free anywhere (already true) and show a hint in the menu.
