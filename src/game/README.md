# src/game

Game rules (Agent 4, part 4a): state, starter ship, trade-job contracts, fuel, travel time, arrival and pay, refuel.
No drawing code. It may use `universe`; it must never import `render` or `ui`.

- `settings.ts`: ALL the rule numbers, with plain comments.
- `ships.ts`: ship data. `debriefs.ts`: the funny lines.
- `rules.ts`: plain functions (accept, arrive, refuel, distance to time and fuel).
- `game.ts`: the `Game` object the panel talks to. `clock.ts`: game time and `?speed=`.
