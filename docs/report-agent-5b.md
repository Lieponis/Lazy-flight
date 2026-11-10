# Agent 5 report, part 5b: Shipyard and emergency refuel

## 1. What was built
- **Shipyard** (`src/ui/shipyard.ts`): a third bottom button, JOBS · SHIPYARD · MAP (docked view only; name and placement chosen by Andy). Each card shows a small pixel picture of the ship (`shippreview.ts`: each model is drawn once into a 96×64 picture, then the temporary 3D renderer is thrown away), name, description, cargo, cabin and tank, the price ("OWNED" if you own it) and that ship's fuel. Buttons: BUY, SWITCH, or an "ACTIVE" label. Blocked buttons show short reasons ("Need 1,300 CR more", "Not during a flight"). After BUY it asks "Switch to it now?" with SWITCH NOW or LATER (Andy's choice). After a switch, SEE IT closes the menu so the new ship is visible on the pad.
- **Emergency fuel** (`jobsmenu.ts`): a red EMERGENCY FUEL button in the Jobs header, shown only when `game.isStuck()`. It shows the game's funny line, or the reason when it fails.
- **Messages** (`popup.ts`): one shared message card in the arrival-card style. A tap outside or Esc closes it.
- "Too far for this tank" added for `tank-too-small`. The Passenger Liner tank changed from 70 to 100 (`src/game/ships.ts`, that one number).
- Tests: 9 new tests in `tests/ui.test.ts` (ship cards, short reasons, the emergency button rule, shipyard visibility). Two tests in `tests/game4b.test.ts` updated from 70 to 100.

## 2. Verified
- `npm run check` on the current `main` (including the newer starport and asset work): 245 tests pass, and the build succeeds. GitHub Actions run for commit 4744120: green.
- Headless browser at 360×740 and 740×360: buy, switch (the docked ship changes), and emergency fuel on a dock where the game reports "stuck" (+20 fuel, line shown). The page never scrolls.
- Andy on his phone (upright and sideways): bought the Liner by playing jobs, switched both ways, saw free switching with fuel kept per ship, and checked layout and scrolling.
- **Not verified by Andy:** the emergency button in normal play. Being "stuck" is rare, because short same-system trips usually need no fuel. It was tested only in the headless browser.

## 3. Notes for others
- The glue already calls `api.setShip` on every game change, so switching redraws the docked ship. No render change was needed.
- How this was delivered: Andy had no computer access, so the change was committed and pushed straight to `main` from a Claude session (GitHub app installed on Lazy-flight). The first package zip was NOT used: it held older copies of files that the "fix starport" commit had changed. Future agents: build on the current `main`, not an old package.
- For Agent 6 (saving): the UI keeps no state of its own. The ship pictures are a cache that is redrawn after a reload.

## 4. Changes outside src/ui
`src/game/ships.ts` (Liner `fuelTankSize` 70 to 100), `tests/game4b.test.ts`, `tests/ui.test.ts`. Nothing in src/render or src/universe.

## 5. Suggestions (not built)
- A small "you could switch to a ship that fits" hint on job cards blocked by cabin or cargo size.
- Show each ship's total trip range ("range about N LY") on its card.
