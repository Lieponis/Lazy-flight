# Agent 6 report, stage G6 (6h): is universe v3 safe to merge?

**Verdict: `MERGE READY`.** Two balance points are below for Andy to decide later; they don't block the merge.

**In plain words:** your real save from today, and the four old example saves, load on the new galaxy and keep everything they should:
- credits, ships, upgrades, paint jobs and ranks are kept
- the ship moves to the new start dock
- a job or trip that was under way is cancelled
- outposts are paid back
- the "universe was rebuilt" note shows once and stays quiet afterwards
- importing the save file gives exactly the same game

The installed offline app updates safely from today's live game to v3:
- the new version downloads quietly in the background
- the update note waits until the ship has landed
- after REFRESH, all of the game is the new version and the old stored copy is gone
- the credits are kept

The far-dock message is fixed. Bulge systems and close disc/bulge pairs work. The balance check found no blocker: players can always hop outward. A first ship now comes much sooner than the 2 hours you chose earlier (about 25 minutes), which is your decision for later.

## Checks
| # | check | result |
|---|---|---|
| 1 | Automatic checks on GitHub | PASS at cf3ce4c ([branch](https://github.com/Lieponis/Lazy-flight/actions/runs/44232567715), [game layer](https://github.com/Lieponis/Lazy-flight/actions/runs/44232567773), [preview](https://github.com/Lieponis/Lazy-flight/actions/runs/44232627640)) and again with my changes on top of G7b step 2, a8af333 ([branch](https://github.com/Lieponis/Lazy-flight/actions/runs/44243933979), [game layer](https://github.com/Lieponis/Lazy-flight/actions/runs/44243933983)) |
| 2 | Old saves through the real start path and the import path | PASS (5 of 5, table below) |
| 3 | Offline app update path (main → v3), offline checks on both builds | PASS for everything a robot can check; 1 robot limit (below) |
| 4 | Far-dock text | FIXED + 2 tests |
| 5 | Balance sanity (world seed, 3 players, 30 h) | no blocker; 2 points for Andy |
| 6 | Agent 2's spot checks (bulge `getSystem`, close disc/bulge pairs) | PASS |
| — | All automatic tests on the branch with my changes | 1,195 pass |

## Old saves (`tests/merge-6h-oldsaves.test.ts`, real `planStart` → migrate → `Game` → `loadIntoGame`, then the save-file import path)
| save | credits | ships | trip | ship lands | "rebuilt" note | import |
|---|---|---|---|---|---|---|
| **Andy's live save, 2026-11-18** (universe 2, Liner + Scout + Hauler, upgrades, 3 paint jobs, rank 3 ×3) | 37,554 → 37,554 | all 3 kept, Liner still active | docked | start dock | once, then quiet | same |
| v1-plain | 3,456 → 3,456 | Hauler | docked | start dock | once, then quiet | same |
| v2-floating | 253 → 253 | Hauler | was floating → docked | start dock | once, then quiet | same |
| v2-free-trip-explored (290 explored) | 2,500 → 2,500 | Hauler | free trip cancelled | start dock | once, then quiet | same |
| v2-job-in-flight (2 outposts) | 8,123 → 34,523 (refund 26,400) | Hauler, Scout | job cancelled | start dock | once, then quiet | same |

Upgrades, paint jobs (owned and worn) and ranks are equal to the old save in every row. The second load writes nothing. Andy's file is stored as `tests/fixtures/old-saves/andy-live-2026-11-18.json` (game data only).

## Update path of the offline app
The offline test robot from 6f/6g (`tests/offline/`, `npm run offline-check`) is now on this branch. It runs the built game in a headless Chromium. Results:
- **main (today's live build, helper version `a0ef0d72ef2b`) → v3 (`3c7dc917daa6`):**
  - the two helper versions differ, so phones will see the update
  - the new version downloads during a trip, and the note stays hidden until landing
  - after REFRESH: page and main script are v3, only the new box is left, and credits are kept (746 → 746)
- **Each build alone:** these checks pass on both:
  - first visit stores one full box
  - offline reload asks the server for no game files
  - offline play: jobs, a paint job, a free trip, reload gives the same game
  - an update between two versions
  - old saves offline
  - wiped copy gives the friendly page
  - save file export, import, undo, and garbage refused
  - kill switch (a real "retire" build)
- **Robot limit (both builds, not a game fault):** at phone size the robot cannot spot a scenery planet on the small system map, so it doesn't fly there. Every phone screen opens offline without errors, and offline free trips are proven at desktop size.
- **Only a real phone can prove:**
  - that iOS hands the new version to the INSTALLED app (home-screen icon)
  - the airplane-mode relaunch after the update
  - that the old app's storage is the one the new version reads

### Andy's phone checklist (right after the merge, about 2 minutes)
1. Open the **installed** Lazy Flight app (home-screen icon) with internet on. Wait 30 s while docked, then tap **REFRESH** when the update note shows.
2. Tap **PLAY**: the "universe was rebuilt" note appears, with your credits and your 3 ships.
3. Switch on **airplane mode**.
4. Close the app fully (swipe it away), then open it again.
5. Tap **PLAY**: the game starts with the same credits. Switch airplane mode off.

## Balance (world seed, 30 game hours, existing simulator)
| player | credits per hour | jobs | average trip | first ship | first outpost | stuck |
|---|---|---|---|---|---|---|
| sensible | 5,909 | 148 | 11 min | 0.4 h (Scout) | not in 30 h | 0 |
| spender | 5,447 | 118 | 14 min | 0.4 h (Scout) | 16.9 h | 0 |
| lazy (never buys) | 3,597 | 133 | 7 min | — | — | 0 (12.5 h of waiting for a new board) |

- **Hopping outward works:** for the 200 docks nearest the start (out to 26 ly), the nearest dock in another system is 1.0 to 8.4 ly away (median 4.5 ly), always far inside the Hauler's 30 ly range.
- **Boards at the start region** (200 docks × 4 boards, new Cargo Hauler): 0 doable jobs 8%, 1 job 18%, 2 or more 73%. That matches Agent 4 (93% have 1+, 74% have 2+).
- **Point for Andy 1:** **the first ship now comes after about 25 minutes**, where you chose about 2 hours (6b, universe v2). Trips are shorter in the new galaxy (11 min average) and docks are closer, so money comes faster. Options:
  - (a) keep it
  - (b) raise the Scout price, for example 1,200 → 3,000
  - (c) lower the pay per light year
  **Decided 2026-11-18 (Andy, Lead OK): all ship prices ×2.94.** Scout 1,200 → 3,528 CR, Passenger Liner 2,500 → 7,350 CR, Cargo Hauler stays free. Simulator: first ship after about 2.8 h (sensible player), about 5,285 CR per hour. Tests updated; all 1,195 pass.
- **Point for Andy 2:** a player who never buys a ship waits a lot: 12.5 of 30 hours, because many jobs need a cabin and the Hauler has none. Options:
  - (a) keep it (buying a ship is the answer)
  - (b) a hint on the empty board, such as "a ship with seats could take these"

## What I touched (branch universe-v3 only)
- `src/game/game.ts` (the allowed text fix): the far-dock message now reads "Nothing here is within reach of this ship. [The other docks in this system are just as far from everything.] The nearest dock in another system is X ly away; a full tank takes you Y ly." The middle sentence appears only when the system has other docks. Before, it said "The next dock is X ly away" even with a dock at 0 ly in the same system.
- `tests/ui.test.ts`: the example sentence was updated to the new wording.
- New: `tests/merge-6h-oldsaves.test.ts` (old saves, import, far-dock text, bulge spot checks) and `tests/fixtures/old-saves/andy-live-2026-11-18.json`.
- New: `tests/offline/` (the offline robot from 6f/6g), the script `npm run offline-check`, and Playwright 1.63.0 as a dev tool (`package.json`, `package-lock.json`).
- No workflow was changed. The offline robot is not in Actions yet: it takes about 5 minutes, and its phone-size free trip still has the robot limit above.

## Noticed, not checked
- `npm audit` lists new warnings in dev tools after adding Playwright: not looked at.
- At 320 px wide (very small phones), "UPGRADES 0/15 ▼" and "1x NORMAL" are cut (seen in 6g on main; not rechecked on v3).

## Suggestions
- Suggestion: after the merge, add `npm run offline-check` to the "Check a branch" workflow, once the phone-size planet finding is fixed.
