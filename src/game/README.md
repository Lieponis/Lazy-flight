# src/game

Game rules (Agent 4, parts 4a and 4b): state, ships, trade/passenger/tour contracts, fuel, travel time, arrival and pay,
refuel, the safety net (stuck + emergency refuel), buying and switching ships.
No drawing code. It may use `universe`; it must never import `render` or `ui`.

- `settings.ts`: ALL the rule numbers, with plain comments.
- `ships.ts`: the three ships (ids match Agent 8's models). `debriefs.ts`: the funny lines.
- `rules.ts`: plain functions (accept, arrive, refuel, stuck, emergency refuel, distance to time and fuel).
- `fleet.ts`: owning, buying, switching ships. `state.ts`: the state and `normalizeState` for old saves.
- `game.ts`: the `Game` object the menus talk to. `clock.ts`: game time and `?speed=`.
