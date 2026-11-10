# Agent 6 report, part 6a: saving and loading

## 1. What was built
- **Saving (`src/save`)**: the player's progress is kept in the browser's storage under one key, `lazy-freight.save`, as JSON. The save holds a version number (1), the seed, the real time and game time of the save, and `game.state`. That is credits, fuel, active ship, `ownedShips`, dock, current job and trip times. The universe is never saved; it is rebuilt from the seed.
- **When it saves**: once when the page starts, then after every game change (accept, arrival, refuel, emergency fuel, buy, switch), and when the page is hidden or closed. It never saves every frame.
- **Loading**: when the page opens, a good save continues: same universe, credits, fuel, ship(s) and dock. A flight in progress continues on the flight screen. Time that passed while the page was closed counts, and a trip that ended in the meantime is paid with the arrival card. `game.loadState()` repairs bad numbers, unknown ships and old saves without `ownedShips`. A saved dock or destination that does not exist in the universe sends you to the start dock or drops the job.
- **Start rules**: `?seed=NUMBER` in the address starts a new game with that seed and replaces the save. Afterwards `?seed=` is removed from the address, so a reload continues the game instead of restarting it. With no `?seed=`, the game continues the save. With no save at all, it starts with seed 12345.
- **Broken or wrong-version saves** never crash the game. Each one is copied once to `lazy-freight.save.broken`, the game starts fresh, and a small notice says "The old save could not be read."
- **Blocked storage** (private window, full storage) never crashes the game either. You play on without saving, a small notice appears at the top, and the menu says "Saving is off in this browser".
- **MENU** (`src/ui/gamemenu.ts`): a small MENU button sits at the right end of the top strip, docked only (Andy's choice). It opens a panel in the Jobs-menu style with the universe seed, the saving status and NEW GAME. NEW GAME asks "Same universe" or "New random universe" (Andy's choice), then "Really start over?". "Same universe" keeps the seed and resets everything else.
- **Tests**: 32 in `tests/save.test.ts`: save then load gives an identical state; mid-flight save and resume through to payment; broken JSON, wrong or missing version, bad seed and missing dock; old saves without `ownedShips`; bad numbers and unknown ships; storage that throws; start rules; time shifting with `?speed=`; autosave on change and on hide; the universe is identical after load. There are also 3 render tests (section 5). In total, `npm run check` passes with 280 tests.

## 2. How to check it
Open the live game with `?speed=600` so trips take seconds.
1. Accept a job, then reload during the flight: the flight continues.
2. Wait for the arrival, then reload: same credits, fuel, ship and dock.
3. Buy a ship in SHIPYARD, then reload: you still own it.
4. MENU → NEW GAME → SAME UNIVERSE → YES, START OVER: 200 credits, starter ship, same seed.
5. Open the game in a private window: it plays and shows the "saving is off" notice.
6. Do the same on a phone.

## 3. Live link
https://lieponis.github.io/Lazy-flight/ (add `?speed=600` for testing).

## 4. Verified, and NOT verified
- Verified here: `npm run check` (build plus 280 tests). I also ran a headless Chrome on the built site at 1280×800 and 360×740. It covered ?seed start and address clean-up, accepting a job, reloading mid-flight (same job, flight screen), arrival after the reload (credits paid), a docked reload with an identical strip, MENU → NEW GAME → SAME UNIVERSE, blocked storage (notice, no crash) and a broken save (backup kept, notice). No console errors.
- NOT verified: real phones, Safari or iPhone private mode, and the GitHub Actions run. Andy's checks after a green Actions run are the proof.

## 5. Changes outside the brief
- **`src/render`, approved by the Lead**: `startRender(renderer, parent, options?: { seed?: number })`. A given whole-number seed is used. Anything else keeps today's behaviour (`?seed=` from the address, otherwise 12345). This takes one new pure helper `resolveRenderSeed()` in `src/render/helpers.ts` and about 6 lines in `src/render/index.ts`. Nothing else in render changed. Test: `tests/render-helpers.test.ts`, where the same seed gives the same universe through the new option.
- **`src/main.ts`** (3 lines): calls `chooseStart()` from `src/ui/index.ts`, the one place the seed is chosen, then passes that seed to both the render layer and the game.
- **`src/ui`**: `index.ts` (glue), `gamemenu.ts` (new), `statusstrip.ts` (MENU button), `logic.ts` (new overlay name `"menu"`), `theme.css` (menu and notice styles).
- `src/game` and `src/universe` were not changed.

## 6. For the next agents
- To change what is saved: add the field to `GameState` with a default in `normalizeState` (src/game). Old saves still load, because missing fields get defaults. Raise `SAVE_VERSION` in `src/save/save.ts` only if old saves can no longer be read; they are then set aside under the backup key.
- Trip times are game time. `shiftTravelTimes()` moves them onto the new clock on load, so `?speed=` testing and closed tabs both work.
- Testing tip: in the browser console, `localStorage.removeItem('lazy-freight.save')` gives a clean start.

## 7. Known issues and suggestions
- A shared link with `?seed=` replaces the receiver's save without asking. This follows the brief. Suggestion: ask "Start a new game with seed N?" when a save exists.
- `package-lock.json` is still not committed (the status file lists it for Agent 6, outside 6a).
- Suggestion: show the time of the last save in the MENU.
