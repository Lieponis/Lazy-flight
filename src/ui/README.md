# src/ui

The menus on top of the 3D picture (Agent 5, part 5a). Plain HTML and CSS, no libraries.

- `index.ts` starts everything and connects the game (`src/game`) to the screens (`src/render`).
- `statusstrip.ts` the top strip: credits, fuel (number and bar), location. Always visible.
- `navbar.ts` the bottom bar: JOBS and MAP (docked view), or SYSTEM | GALAXY and CLOSE (maps). Hidden in flight.
- `jobsmenu.ts` the Jobs menu (dock name, Refuel, Close, job cards).
- `arrival.ts` the "Delivered" card after a flight.
- `logic.ts` all words, numbers and "which button shows where" as plain functions (tested in `tests/ui.test.ts`).
- `theme.css` the look. Colours and font are CSS variables at the top (`--ui-teal`, `--ui-amber`, ...).
- `fonts/` the VT323 pixel font (SIL Open Font License 1.1, see `OFL-VT323.txt`).

To add a new screen with its own button (for example the Shipyard in 5b): add a button in `navbar.ts`,
a new overlay like `jobsmenu.ts`, a new name in the `Overlay` type in `logic.ts`, and open it from `index.ts`.
