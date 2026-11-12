# src/render

Everything you see. Reads data from `universe`; `universe` never reads from here.

- `index.ts` starts everything (`startRender`) and switches between the two screens.
- `settings.ts` the easy settings: seed, start system, map size.
- `starmap.ts` screen 1: nearby stars. `systemview.ts` screen 2: star, planets, docks.
- `input.ts` drag / zoom / tap. `hud.ts` + `hud.css` the plain HTML label and buttons.
- `helpers.ts` small pure functions (tested). `state.ts` what is selected right now. `start.ts` picks the start system.

Part 3c: `docked.ts` is the home screen (ship parked at its dock, camera above it). Its camera maths is pure and lives in `dockedcam.ts`.
