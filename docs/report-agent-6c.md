# Agent 6 report, part 6c: comfort rule fix, balance with upgrades, final QA

Live: https://lieponis.github.io/Lazy-flight/ · all commits on `main` · `npm run check`: **494 tests pass** · Actions green (one red run in between, see section 6).

## 1. Part 0: no Passenger Comfort for a ship without a cabin (src/game, Lead approved)
- `upgradeBlock` refuses "comfort" for a ship whose cabin is 0, with the reason "This ship has no cabin, so passenger comfort does nothing.". `getUpgradeOffers` leaves that row out, so the Cargo Hauler has **3 tracks / 15 levels** and the Scout and Liner have 4 / 20.
- New `upgradeTracksOf(shipId)` in `src/game`. A test checks that it agrees with the Shipyard's `upgradeTracksFor` and with the 0/15 vs 0/20 counts. The simulator asks the game for offers, so it follows the rule automatically. `/game-debug.html` lists the offers from the game too.
- A comfort level already bought on a Hauler through the debug page stays in the save. It does nothing and is hidden.

## 2. Part A: balance with upgrades (simulator, 8 seeds, 100 game hours, medians)
The players now buy upgrades: **sensible**, **casual** (back 0–3 h after landing), **spender** (no reserve), **lazy** (one ship, buys at 2× the price), plus a new **planner** (saves for the first outpost, then upgrades). Run: `npm run balance -- 30 1 100`.

| player | 1st upgrade | 1st tank / hold / engines / comfort | a full track | all tracks, one ship | credits at 100 h (without → with upgrades) |
|---|---|---|---|---|---|
| sensible | 2.2 h | 2.2 / 3.6 / 3.9 / 8.3 h | 76 h | 97 h | 407,000 → 30,000 |
| planner | 9.1 h (after the outpost) | 9.1 / 9.8 / 9.8 / 9.8 h | 75 h | 96 h | 407,000 → 32,000 |
| casual | 14.9 h | 14.9 / 23.5 / 32.9 / 41.4 h | not in 100 h | not in 100 h | 64,000 → 2,600 |
| spender | 2.1 h | 2.1 / 3.9 / 5.0 / 8.6 h | not in 100 h | not in 100 h | 25,000 → 23,000 |
| lazy | 2.6 h | 2.6 / 3.6 / 4.2 / – (Hauler) | 65 h | 90 h | 146,000 → 71,000 |

| player | credits/hour without → with | fuel spent (100 h) | tour lines too far for the tank |
|---|---|---|---|
| sensible | 4,391 → 5,880 (+34%) | 23,100 → 18,900 | 29% → 1% |
| casual | 781 → 846 (+8%) | 4,600 → 4,400 | 16% → 2% |
| spender | 4,220 → 5,183 (+23%) | 22,400 → 18,900 | 30% → 1% |
| lazy | 1,618 → 2,902 (+79%, a bigger hold lets the Hauler take more cargo jobs) | 15,700 → 17,100 | – |

- **Targets met:** the first level comes about one session after the first ship (first ship about 1.5 h, first upgrade about 2.2 h). The last levels are a long-term goal (a full track after about 65–76 h, a whole ship after about 90–97 h). Credits no longer pile up unused (407,000 → about 30,000 at 100 h).
- **Nothing becomes trivial or locked:** rank limits still block 4–5% of board lines. Jobs are still mostly cargo, passengers and tours in the same mix. No ship is locked out.
- **Upgrades vs outposts:** cheap first levels compete with outposts. Buying every upgrade at once pushes the first outpost to about 30–40 h. Saving first (the planner) gets it at 9.1 h, and the planner is no slower on upgrades afterwards. This is a player choice, not a problem.
- **Emergency fuel:** with upgrades, the no-reserve spender sometimes spends down to 0 and gets stuck. Every time, emergency fuel gets it going again (a test checks stuck = emergency refuels). Players who keep a small reserve are never stuck.
- **Price variants tried** (same runs): ×1.5 and ×2 make full tracks unreachable in 100 h. A "cheaper start" (1,000 / 3,000 / …) changes almost nothing.
- **DECISION (Andy, 2026-11-11): keep the prices** (1,500 / 4,000 / 9,000 / 18,000 / 35,000) and the percents. No game number was changed in 6c.
- **Stacking rule checked** (tests): rank + outpost + comfort are added on the plain reward, top **+50%** (10 + 10 + 30). Comfort never adds to cargo jobs. Rank limits use the plain reward (6b-1).

## 3. Part B: final QA
**Headless Chrome on the built site** (desktop 1280×800 and 1920×1080; phone 360×740, 390×844 and 740×360), all with no console errors:
- **Title screen:** PLAY and the Enter key work.
- **Upgrades:** bought in the Shipyard. The Hauler shows UPGRADES 0/15 and no comfort. Reload keeps the levels, and the strip shows the bigger tank (60/78).
- **Sound settings:** the speaker button's mute and the MUSIC slider are remembered after a reload. They are saved under their own key and survive NEW GAME.
- **Speaker button:** visible in flight, while MENU is hidden in flight (as designed).
- **Reload mid-flight with upgrades:** the flight continues ("In warp").
- **Old save** (without upgrades, outposts, ranks, delivered list or other ships): loads, and all new fields are filled with defaults.
- **Every screen at every size:** Jobs, Shipyard, MENU, Ranks and Map open and close, and the page never scrolls.
- **Cockpit fuel with upgrades (5d "not verified"):** checked. The glue passes the real tank and the upgraded burn, and a test checks the screen numbers (78/78 at take-off, the fuel left at arrival).
- Liveries and new planet looks are not in the game yet, so not tested.

**Regression tests added** (`tests/agent6c.test.ts`, `tests/balance-sim.test.ts`): comfort rule; stacking rule; cockpit fuel with upgrades; sound timing guard (fails if `src/render/flight.ts` changes how it picks phase lengths and `src/ui/sound.ts` does not follow); bonk class-name guard (`.ui-notice`, red `.ui-panel-title` in the Jobs menu, popup and stylesheet); stuck → emergency fuel with upgrades.

**Tool upgrade:** `npm audit` went from 6 weaknesses to **0**. The new versions are Vite 6 → 8, Vitest 2 → 5, and vite-node 6 as its own dev tool for `npm run balance`. It needed no code changes, only package files. `npm run check` is green. The built game (a full job, warp, delivery), `/models.html`, `/game-debug.html` and `/debug.html` all load in a headless browser with no errors.

**Clean-up (Lead approved):**
- The `tunnel` field in `flight.ts` is renamed `warp`; I checked that the warp still draws.
- Removed dead code, proved unused: `tunnelStreakData` (plus its own test), `FLIGHT_LAUNCH_FAR`, `FLIGHT_APPROACH_FROM_STATION`.
- `README.md` and `docs/WHERE-TO-LOOK.md` refreshed: title screen, speaker, SETTINGS, `src/audio`, `tests/sim`, and the name Lazy Flight.
- Left alone on purpose: `UNIT_NAME` and `RING_SPIN_MAX` in `src/render/assets/style.ts`. Nothing reads them, but they are Agent 8's documented style constants.

## 4. Phones
- **iPhone Air (Safari):** Andy's checklist below (step 2 of the 6c chat). Result: see section 7.
- **Android: NOT verified.** Andy has no Android phone available. The same goes for Firefox and desktop Safari (7a's list). The automatic sound checks (first tap, hidden tab, return after an app switch) run only on real devices; headless Chrome has no real audio output.

## 5. For the next agents
- `npm run balance -- HOURS TRIPSCALE UPGRADEHOURS` prints all tables. The strategies are in `tests/sim/balance-sim.ts`.
- If you change flight phase lengths in `src/render/flight.ts`, update `src/ui/sound.ts` too. The guard test tells you.
- Liveries (saved field with default) and planet looks: add a save/reload check to `tests/agent6c.test.ts` when they land.

## 6. Known issues and honesty
- One red Actions run (commit 3f89d70): the new upgrade-buying spender got stuck once, and the old test said "never stuck". I had pushed without seeing the failure. I fixed it 2 minutes later (39a87a1) with a truer test (stuck is always rescued). The live site was not affected, because a red build is not published.
- Small, no action needed: an invalid `?seed=abc` stays in the address bar; at 200×200 the top strip is cramped.

## 7. Andy's checks
- Balance decision: keep prices (done).
- Phone checklist on iPhone Air: _result to be filled in after Andy's reply._

## 8. Suggestions (not built)
- Show the pay-bonus split (rank / outpost / comfort) on job cards (5d's suggestion). Players can't see why a passenger job pays +50%.
- An "upgrades first or outpost first?" hint in the tutorial text, since the order changes the first outpost from about 9 h to about 35 h.
