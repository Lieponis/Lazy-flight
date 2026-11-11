# src/game

Game rules (Agent 4, parts 4a, 4b, 4c, 4d, 4e and 4f): state, ships, trade/passenger/tour contracts, fuel, travel time, arrival and pay,
refuel, the safety net (stuck + emergency refuel), buying and switching ships, ranks and outposts with perks, ship upgrades, docks-only universe.
No drawing code. It may use `universe`; it must never import `render` or `ui`.

- `settings.ts`: ALL the rule numbers, with plain comments.
- `ships.ts`: the three ships (ids match Agent 8's models). `debriefs.ts`: the funny lines.
- `rules.ts`: plain functions (accept, arrive, refuel, stuck, emergency refuel, distance to time and fuel).
- `fleet.ts`: owning, buying, switching ships. `state.ts`: the state and `normalizeState` for old saves.
- `game.ts`: the `Game` object the menus talk to. `clock.ts`: game time and `?speed=`.
- `ranks.ts`: rank names and progress (3 ranks per category: cargo, passengers, tours). `outposts.ts`: price, buying, perks.
  Rank 2 and 3 unlock bigger-paying jobs (reason code `rank-too-low`) and add a small pay bonus. An outpost gives cheaper fuel
  and bonus pay on jobs ending in its star system. All numbers are in `settings.ts`; funny lines in `debriefs.ts`.
- `upgrades.ts`: four upgrade tracks (fuel tank, hold and cabin, efficient engines, passenger comfort), 5 levels each, kept per ship.
  `shipStats(state, shipId)` gives the REAL numbers of a ship (shipyard numbers plus upgrades): always use it, never `getShip(id).fuelTankSize`
  directly, for anything the player experiences. All numbers and prices are in `settings.ts`.
- Universe v2 (4e): not every planet has a dock. A job starts and ends at a DOCK; use `docksOf` / `getDock` (never `generateDock` on any planet,
  never "planet 0"). The start dock of a new game is `startDockOf(seed)` from `src/universe`. Old saves are moved by `src/save/migrate.ts`.
  Outposts remember the price paid (`outpostPrices`), which is what a later rebuild refunds.
- Free travel and exploring (4f): `freetravel.ts` (`checkFreeTravel`, `startFreeTravel`, `settleFreeArrival`, strand protection, emergency refuel while floating),
  `explore.ts` (explored list, discovery credits, Explorer rank), `location.ts` (docked / floating in space / flying). The state has three new fields:
  `spacePlanetId` (null = docked; otherwise the planet WITHOUT a dock you float at; `currentDockId` is then your last dock), `freeTrip` (a trip with no job on its way,
  sharing `travelStartMs` / `travelEndMs` with jobs) and `explored` (star system id -> bits of the planets arrived at; its keys are the explored systems).
  Menus talk to `game.canFreeTravel(id)`, `game.freeTravel(id)`, `game.getExplorer()`, `game.lastFreeArrival` and `game.whyNotDocked()`. While floating there are no jobs,
  no refuel and no shop (funny plain-text reasons); switching ship and the emergency refuel work. Job arrivals explore too (`Arrival.discovery`, `newSystem`, `newPlanet`, `explorerRankUp`).
  Numbers: `settings.ts` (discovery 50 to 100 credits, Explorer thresholds 50 and 200 discoveries, +0/10/20% discovery bonus, `MAX_EXPLORED_SYSTEMS`). Explorer never changes job pay or job ranks.
