# Agent 5 brief, part 5d: Upgrades panel in the Shipyard

You are Agent 5 (UI/UX). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/proposal-ship-upgrades.md (APPROVED), docs/report-agent-4d.md (section 6 is your API), docs/report-agent-5b.md, docs/report-agent-5c.md, docs/report-agent-7a.md if it exists. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH); offer options A/B/C for the panel layout before building. The only report is docs/report-agent-5d.md. Free flight and combat are permanently out. Push to main if you have GitHub access.

## Goal
The player can see and buy ship upgrades, and every menu shows the REAL numbers (with upgrades), not the base numbers.

## Do
1. **Upgrades panel.** Opened from each owned ship's card in the Shipyard (an UPGRADES button; keep the Shipyard's existing BUY / SWITCH behaviour). Four rows (Fuel Tank, Hold & Cabin, Efficient Engines, Passenger Comfort): name, level n/5 as a small bar, the effect of the next level (`effect` text from the API), next price, BUY LEVEL button, or MAX. Blocked states use the API's `reason` in short plain words ("Need 3,200 CR more", "Not during a flight", "Max level"). Purchase shows the funny `line` in the shared message card (`popup.ts`). Works for the active ship and for other owned ships (API takes a ship id).
2. **Real numbers everywhere.** Agent 4 reports these places still read base numbers; switch them to the real ones: `src/ui/index.ts` (about lines 140 and 196: `getShip(...).fuelTankSize` becomes `game.getShipStats().fuelTankSize`; about line 197: `fuelCost(...)` becomes `tripFuelCost(game.state, ...)`), `src/ui/logic.ts` (about lines 260-262: shipyard stats become `entry.stats`). Search for any other place that shows tank, cargo, cabin or fuel burn and fix it too. Status strip fuel bar, Jobs menu (fuel needed, blocked reasons), Shipyard cards, refuel button, cockpit fuel (the glue already passes fuel and tank: make sure the tank value is the real one).
3. Phone upright and sideways: scrolling list, big buttons, nothing cut off, page never scrolls.
4. Tests for the plain functions in `logic.ts` style (panel text, blocked reasons, real vs base numbers). `npm run check` must pass.

## Allowed / not allowed
Allowed: src/ui, tests, docs, the small `FlightInfo` fuel glue in `src/ui/index.ts`. Not allowed: src/game, src/render, src/universe, src/save. Anything missing in the API goes to the Lead.

## Andy checks (after a green Actions run)
With `?speed=100000` earn credits (or use the main game), open SHIPYARD, UPGRADES: buy a level of each track; the Jobs menu, status strip and refuel button show the new numbers; switch ship and see its own levels; a blocked purchase says why; reload keeps everything; phone upright and sideways.
