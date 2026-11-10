# Agent 6 report, part 6b: QA and balance pass

## 1. What was done
- **Balance simulator** (`tests/sim/`, test-only, never shipped). It plays automatic games with the real `src/game` rules on a fake clock at speed 1: 8 seeds × 4 player types (sensible, casual, spender, lazy). Run: `npm run balance`. A small version runs in `npm run check`.
- **Balance numbers changed (Andy decided, Lead approved):** `TRAVEL_SECONDS_PER_LY` 480 → **60** (1 min per light year). Passenger Liner price 1,500 → **2,500**. Scout 1,200, outpost prices and Liner tank 100 are unchanged.
- **Bug 6b-1 fixed (Lead approved, `src/game/game.ts`):** the board showed a job as takeable, but ACCEPT refused it ("Needs rank …") because your own rank or outpost bonus pushed its pay over the rank limit. `Game.accept()` now checks the job without bonuses. The bonus is still paid on arrival.
- **Bug hunt** in a headless Chrome on the built site. No other bugs found (section 4).
- **README** rewritten: the current game, live link, GitHub Desktop publishing, testing aids, `npm run check`, `npm run balance`.
- **Tests:** 328 in total (6 new for the simulator and QA, 1 new for saving, 4 existing ones updated to the new Liner price).

## 2. Final balance numbers (real rules after the change, 30 game hours per run, medians of 8 seeds)

| player | credits/hour | jobs/hour | avg trip | first ship | first outpost |
|---|---|---|---|---|---|
| sensible (back at every landing) | ~4,000 | 2.7 | 22 min | **1.5 h** (3 jobs) | **9 h** (23 jobs, ~11,000 cr) |
| casual (back 0–3 h after landing) | ~490 | 0.7 | 18 min | 7.7 h | not within 30 h |
| spender (buys at once) | ~3,600 | 2.2 | 27 min | 1.5 h | 13.6 h |
| lazy (biggest reward, buys nothing) | ~1,750 | 2.3 | 20 min | — | — |

Before the change, sensible: 2.5 h average trip, first ship after about 10 h, first outpost after about 50 h.
Andy's targets were a first ship after about 2 hours and a first outpost after about 8 hours.

Ranks (sensible): cargo rank 2 / 3 after 1.4 h / 5.5 h; passengers 9 h / 13 h; tours 7.5 h / 13 h. Rank limits block about 5% of board lines, so ranks matter without walling the player in.

## 3. Known gaps checked
- **Outposts "too cheap" (4c):** no. Prices run 5,100–39,900 (median about 22,700). You can only buy where you dock, and about 4 in 10 stops are outposts. The first outpost comes after about 23 jobs.
- **Tours vs Liner tank 100:** 32% of tours are still too far. That's about 1–3% of board lines. Kept as is (Andy).
- **Emergency fuel in normal play:** never needed. Stuck 0 times in all simulated games and in 5,048 "one job, then spend your credits" tries. It stays a pure safety net (tests in `tests/balance-sim.test.ts`).
- **Rank gating:** useful (see above).

## 4. Bug hunt (headless Chrome, built site)
Passed with no console errors:
- Reload after every action type: accept, arrival, refuel, buy ship, switch ship, buy outpost.
- Reload in every flight phase (launching, warp, approaching): the flight continues.
- A tab hidden for 5 hours: the trip landed and was paid.
- Double-clicking ACCEPT: one job only.
- NEW GAME both ways ("New random universe" resets credits, ships, outposts and ranks).
- Blocked storage and broken saves (6a).
- `?seed=` with letters, empty, negative, 0, huge, or given twice: no crash. Invalid values are ignored.
- `?speed=` with 0, negative, letters, 1e9 or 100000: no crash.
- Window sizes 2560×1440, 1024×1366, 390×844, 360×740, 740×360, 320×480 and 200×200.
- An old mid-flight save made with the long trip times: loads, lands and pays (test).

Small things, no action needed:
- An invalid `?seed=abc` stays in the address bar. It's harmless and ignored.
- At 200×200 the top strip is cramped.

## 5. Open items for the Lead
1. **Repeat jobs (`src/game` or `src/universe`, needs your OK).** This was a known issue; with short trips it now happens often. A job you delivered shows up again, and can be taken again, if you return to the same dock within the same 6-hour board window. In the simulation it happened 12–17 times per 8 runs: the same A→B job paid again after a quick B→A hop. Fix idea: remember the ids of jobs delivered in the current board period and hide them from that board. Alternative: shorten `JOB_BOARD_REFRESH_SLOTS`.
2. **Nothing to spend on later.** An attentive player has about 100,000 credits after 30 hours, and after a few outposts there is nothing left to buy. This is a suggestion for a later phase.
3. **Not verified:** real phones (frame rate, touch, Safari private mode). Andy has the checklist.

## 6. Housekeeping
- `package-lock.json`: waiting for Andy's approval, then I commit it (it pins tool versions).
- Old zip files to delete by hand (about 1 MB, no longer needed):
  - main folder: `agent-3c-package.zip`, `agent-3d-package.zip`, `agent-4b-package.zip`, `agent-5a-package.zip`, `agent-8-package.zip`
  - `docs/briefs/`: `lazy-flight-for-agent-3b.zip`, `lazy-flight-for-agent-4.zip`, `lazy-flight-for-agent3.zip`, `lazy-flight-for-agent3c.zip`
- `npm run check` is the one command (build + all tests). GitHub Actions runs the same steps.

## 7. Files changed
`src/game/settings.ts`, `src/game/ships.ts`, `src/game/game.ts` (accept fix), `tests/sim/*` (new), `tests/balance-sim.test.ts` (new), `tests/save.test.ts`, `tests/game4b.test.ts`, `tests/ui.test.ts`, `README.md`, `docs/status.md` (two number notes), `package.json` (`balance` script).
