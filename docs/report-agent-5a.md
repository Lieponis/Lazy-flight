# Agent 5 report, part 5a: docked-screen menus

## 1. What was built
In `src/ui/`: a status strip at the top (credits, fuel number and bar, location; "EN ROUTE TO …" in flight). A bottom bar: JOBS and MAP in the docked view, and SYSTEM | GALAXY with CLOSE on the maps; hidden in flight. A Jobs menu (dock name, Refuel button with its cost, Close, Esc, job cards with blocked reasons, scrolls inside). An arrival card (DELIVERED, reward, funny line, Dismiss or tap outside). Look: dark panels, teal and amber lines, VT323 pixel font. Agent 4's temporary panel and Agent 3's temporary buttons are gone. 20 new tests in `tests/ui.test.ts`, plus a check that `src/render` never imports `src/game` or `src/ui`.

## 2. How to check it
Open the live page with `?speed=120`. Then: JOBS (cards, Refuel, Close or Esc), Accept, watch the flight, see the arrival card, dismiss it, MAP (System and Galaxy, Close).

## 3. Live link
The usual site address ending in `/lazy-freight/` (add `?speed=120` for testing).

## 4. Known issues, and what was NOT verified
- Verified: `npm run check` here (build plus all 124 tests), a headless click-through at 360×740, 740×360 and 1280×800 sizes, a green Actions run, and Andy's click-test (steps B to H in the brief, including a real phone held upright and sideways).
- Not measured: how the font looks on very old phones. Only one real phone was tried.
- Fixed during the work: the arrival card and buttons stayed hidden after a flight, because the render layer reports "docked" a moment before it swaps the screen. `src/ui` now uses the screen name and the game's job, not `api.isFlying()`.
- Trip times on the cards show the real wait (game time divided by `?speed`).
- The flight HUD still uses its old font (left alone on purpose).
- With a sideways phone, about one job card fits on screen at a time (the list scrolls).

## 5. Font
VT323, SIL Open Font License 1.1. File `src/ui/fonts/VT323-Regular.woff2`, license `src/ui/fonts/OFL-VT323.txt`. No new libraries.

## 6. For Agent 4 (part 4b)
Each card is built by `jobCardText()` in `src/ui/logic.ts` from a `BoardEntry`: `job.kind`, `amount`, `itemName`, `destinationDockId`, `stops` (tours show "(N stops)"), `totalDistance`, `reward`, `blurb`, plus `fuelNeeded`, `tripSeconds` and `block` (`code` and `text`). A new block code needs a short wording in `SHORT_REASONS` (unknown codes show "Not available", plus the game's own text). New fields (rank, ship) go in `JobCardText`, `jobCardText()` and `jobsmenu.ts`. The refuel button uses the `refuel(state)` preview. The emergency refuel can be another button in the Jobs menu header.

## 7. For Agent 5 (part 5b, Shipyard & Ranks)
Add a button in `navbar.ts`, a new overlay class like `jobsmenu.ts`, a new name in the `Overlay` type in `logic.ts`, and open and close it in `index.ts`. Overlays only stay open in the docked view (`overlayAllowed`).

## 8. For Agent 6
Nothing new needs saving: the UI keeps no state of its own. Menu logic is plain functions in `logic.ts` (easy to test). On loading a save in mid-flight, `startUi` already starts the flight screen.

## 9. Changes outside src/ui
- `src/render/docked.ts`: removed the "Map" button and its `onMap` option.
- `src/render/starmap.ts`: removed "Back to dock" (kept "Open system").
- `src/render/systemview.ts`: removed "Back to dock" and "Back to map" and their options.
- `src/render/index.ts`: removed the wiring for those options.
- `src/render/hud.css`: restyled the title, label and "Open system" button to match, using `--ui-*` CSS variables. They move clear of the top strip and bottom bar via `--ui-top-reserve` and `--ui-bottom-reserve`.
- `src/render/flight.css`: the flight title moves down under the status strip (one line). Nothing else in flight changed.
- `src/main.ts`: one comment. `tests/ui.test.ts`: new. Deleted `src/ui/panel.ts` and `panel.css`.
- No 3D scene was changed.

## 10. Suggestions (not built)
- Use VT323 in the flight HUD too, for one consistent look.
- Show the fuel-range warning on blocked cards as "Refuel to take this" with a shortcut button.
- A small "new jobs in 12m" countdown at the bottom of the Jobs menu.
