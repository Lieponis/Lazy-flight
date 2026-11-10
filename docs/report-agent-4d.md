# Agent 4 report, part 4d: ship upgrades (rules and state)

## 1. What was built
All in `src/game`, plus the debug page. **Four upgrade tracks, five levels each, per ship** (Andy's design): **Fuel Tank** (+10% tank per level), **Hold & Cabin** (+10% cargo and cabin per level), **Efficient Engines** (-6% fuel per light year per level), **Passenger Comfort** (+6% pay per level on passenger and tour jobs). Prices per level: 1,500 / 4,000 / 9,000 / 18,000 / 35,000. Each ship keeps its own levels; switching ships switches them. Every part of the job path uses the real numbers: board, block reasons, accept, fuel burned, refuel, emergency fuel, pay.
**My choices (Andy OK'd):** comfort is ADDED to the rank and outpost bonuses, all counted on the plain reward (never multiplied; top total +50%). A bigger tank does not refill itself. A hold upgrade never creates a cabin (Hauler stays at 0). Numbers are rounded to whole units, so the Scout's 2 seats become 3 at level 3.

## 2. How to check it
Open `/game-debug.html`, section 2: "TEST: add 50000 credits". Section 4 "Ship upgrades": press "Buy level" on each track and watch the line of numbers change (tank 60 -> 66, burn 100% -> 94% ...). Buy the Passenger Liner (section 3) and switch: it has its own levels. Set credits to 10: every row says "Costs ... credits". Buy the tank five times: "already at the highest level". Reload: all levels are still there.

## 3. Live link
The usual address ending in `/lazy-freight/`, plus `game-debug.html`.

## 4. Known issues, NOT verified
- I could NOT run `npm run check` here (no installed packages). I ran with a stand-in runner: game 27, 4b 38, 4c 22, **4d 27 (new)**, save 33, ui 42, universe 29, balance-sim 11, layer-rule 1, settings 3: all pass. Strict type check of `src/game`, `src/universe`, `src/save`, `src/ui/logic.ts`, the debug page and those tests: clean. Headless browser click-through of `/game-debug.html` (built with esbuild, not Vite): buy one level of each track, buy and switch ships, poor refusal, max-level refusal, reload keeps levels, no console errors.
- NOT checked: the real Vite build, the main game page, phones. Actions plus Andy's click-test are the proof.
- **Until Agent 5 builds the panel, the main game's menus still show BASE numbers** for tank and fuel burn (the status strip fuel bar, the flight fuel figure and the shipyard stats read `getShip(...)`/`fuelCost(...)`). The rules are correct; only the display lags. Nothing in the real game lets a player buy upgrades yet, so no one can see this.
- Balance simulator (`tests/sim`): runs unchanged and ignores upgrades (its players never buy any). Agent 6 should add upgrade buying.
- A player with a bigger tank may see "stuck" logic change only slightly; emergency fuel still stays a safety net.

## 5. Settings
`settings.ts`: `UPGRADE_MAX_LEVEL`, `UPGRADE_PRICES`, `UPGRADE_TANK_PERCENT_PER_LEVEL`, `UPGRADE_HOLD_PERCENT_PER_LEVEL`, `UPGRADE_ENGINE_PERCENT_PER_LEVEL`, `UPGRADE_COMFORT_PERCENT_PER_LEVEL`. Names: `upgrades.ts`. Funny purchase lines: `debriefs.ts` (`UPGRADE_LINES`).

## 6. For Agent 5 (part 5d, the Upgrades panel)
API: `game.getUpgradeOffers(shipId?)` returns 4 rows: `track` ("tank" | "hold" | "engines" | "comfort"), `name`, `level`, `maxLevel`, `nextPrice` (null at the top), `effect` (plain text of the next step, e.g. "Tank 100 -> 110 fuel"), `canBuy`, `reason`. `game.buyUpgrade(shipId, track)` gives `{ ok: true, price, level, line }` (line = funny text) or `{ ok: false, reason }`. `game.getShipStats(shipId?)` gives the REAL `cargoCapacity`, `cabinCapacity`, `fuelTankSize`, `fuelBurnPercent`, `comfortBonusPercent`. `getShipCatalog()` rows now also carry `stats` and `upgrades` (levels). **Replace these base-number reads with the real ones:** `src/ui/index.ts` lines about 140 and 196 (`getShip(...).fuelTankSize` -> `game.getShipStats().fuelTankSize`) and 197 (`fuelCost(...)` -> `tripFuelCost(game.state, ...)`); `src/ui/logic.ts` about 260 to 262 (shipyard stats -> `entry.stats`). `BoardEntry.fuelNeeded` and `.bonusPercent` already include upgrades. No new block codes. Failure reasons are short plain sentences ("Costs 4000 credits, you have 10.", "You cannot buy an upgrade during a flight.", "This upgrade is already at the highest level.", "You do not own this ship.").

## 7. For Agent 6
New state field `shipUpgrades: { [shipId]: { tank, hold, engines, comfort } }` (levels 0 to 5, only for owned ships; a ship with no entry is at level 0). Defaulted and repaired in `normalizeState`, so old saves load at level 0; `SAVE_VERSION` unchanged. Per-ship stored fuel is clamped to the real tank on load. For the balance pass: add upgrade buying to the simulated players and check prices. First-level price 1,500 is about the price of the Scout, the last level is 35,000 (a full track 67,500, all four on one ship 270,000).

## 8. For Agent 3 / Agent 8
Nothing to draw. Upgrade levels are in `game.state.shipUpgrades` if a badge per level is ever wanted (suggestion, not built).

## 9. Suggestions (not built)
- Show the pay bonus split (rank / outpost / comfort) on a job card.
- A small badge per upgrade level on the ship model.
