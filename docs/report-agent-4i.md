# Report Agent 4, stage G4 ("4i"): game and save layers on universe v3

Branch: `universe-v3` only (nothing went to main). Last commit of this stage: see `git log` (2a82479 plus this report).
Check run (green): https://github.com/Lieponis/Lazy-flight/actions/runs/44074215234 : type check of `src/universe`, `src/game`, `src/save` clean; 20 test files, 539 tests passed; balance-sim 3.5 s.
Andy's three checks: all passed (Actions green; start-dock board screenshots "Clear"; moved old save "Good").

## 1. What was built
- `docs/universe-v3-game-api.md` for Agents 3 and 5 (step 1).
- `src/game` and `src/save` ported to universe v3: system ids are numbers, dock/planet/job ids are text, `explored` keys are the system number as digits. Old-shape ids match nothing (`isLegacyId`).
- New in `Game`: `getBoardSummary()`, `getPlaceInfo()`, `nearbySystems(count=40)`, `nearbyDocks(count=12)`; `BoardEntry.reach` (`now` / `refuel` / `never`) and `reachText`. Nearby lists are by count (nearest N), one `NearCache` per game.
- Reward curve (the only change in `src/universe`, see section 3).
- Explored cap raised to 100,000 (section 7).
- Save migration to universe version 3 (section 6), also for imported save files.
- `.github/workflows/check-game.yml` (only on `universe-v3`, plus a new `tsconfig.game.json` that limits the type check to the three folders). Existing workflows untouched. The old "Check a branch" workflow still fails on this branch because render/ui are not ported; expected.
- Test page `src/game-debug.ts` (touched although not in the allowed list: Andy's checks 2 and 3 use it, and it imported the removed `listSystemsNear`): ported, job board now has a "Can the ship do it?" column and a summary line.
- Tests: new `tests/game4i.test.ts` (30 tests), real old-save fixtures `tests/fixtures/old-saves/` (made by main's code: v2 job in flight with Scout/upgrades/paint/ranks/two outposts, v2 free trip with 290 explored, v2 floating, v1 plain), ported agent6c, balance-sim, game, game4b-g, save, save-transfer, world-seed, tests/sim/explorer-sim, helper `tests/helpers/near.ts`.

## 2. API facts (short; full list in the API doc)
- Start: "Bimvik Deep JR62R-MT37", dock `44776692551/2`, `WORLD_SEED` 12345. Jobs come from the 12 nearest docks by count; 6 jobs per board.
- Fuel: 2 per ly, Hauler tank 60 = 30 ly range. `reachOf(state, ly)`: `now` (fuel is there), `refuel` (fits the tank, not the current fuel), `never` ("Too far for this ship: needs 62 fuel, the tank holds 60.").
- Far docks (nearest other dock 70 to 250 ly): board still shows 6 greyed cards, `getBoardSummary().message` and `getPlaceInfo().remoteMessage` explain, free travel refuses with a sentence, strand protection unchanged. No crash, no empty screen without a message. Tested at the rim.

## 3. Reward curve (touched in `src/universe`, tell the Lead)
Touched exactly: `settings.ts` (new constants `REWARD_FULL_PAY_LY = 50`, `REWARD_SLOWDOWN_LY = 25`), `jobs.ts` (new `paidDistance()` and its use in the reward calculation), `index.ts` (export `paidDistance`). Time limit and fuel still use the real distance. Passengers and tours follow the same rule. The pinned job-board fingerprints in `tests/universe-v3.test.ts` did NOT change (the sampled boards have no job over 50 ly), so no re-pin was needed.

`paidDistance(d) = d` up to 50 ly, then `50 * sqrt(1 + (d - 50) / 25)` (joins smoothly, slope 1 at 50 ly).

Example rewards (trade, 20 units at price 10; passenger, 3 seats), before -> after:

| ly | trade before | trade after | passenger before | passenger after | paid ly share |
|---|---|---|---|---|---|
| 5 | 140 | 140 | 155 | 155 | 1.00 |
| 10 | 200 | 200 | 245 | 245 | 1.00 |
| 25 | 380 | 380 | 515 | 515 | 1.00 |
| 35 | 500 | 500 | 695 | 695 | 1.00 |
| 50 | 680 | 680 | 965 | 965 | 1.00 |
| 100 | 1280 | 1119 | 1865 | 1624 | 0.87 |
| 300 | 3680 | 2070 | 5465 | 3050 | 0.55 |
| 650 | 7880 | 3080 | 11765 | 4565 | 0.38 |

## 4. Boards (new Cargo Hauler, rank 0, full tank; 48 boards per place, slot sample)
| place | jobs | doable | boards with 1+ | boards with 2+ | jobs "never" | trip ly min/median/max |
|---|---|---|---|---|---|---|
| start | 288 | 146 | 46 | 38 | 5 | 0 / 8.5 / 34.8 |
| centre | 288 | 140 | 43 | 38 | 0 | 0 / 2.1 / 9.5 |
| middle | 288 | 97 | 44 | 30 | 76 | 0 / 24.9 / 135.6 |
| rim | 288 | 5 | 5 | 0 | 280 | 0 / 157.3 / 646.5 |

Rim: almost nothing is doable with this ship. This is Andy's decision (long-range ship later, "suggestion" below); the player is protected by the messages and by free travel and refuelling rules.

## 5. First hour
- Start dock: at least 2 doable jobs in every sampled time slot of a week (tested). At slot 0: two trade jobs, 5.1 ly, 223 and 206 credits.
- At least one of those leads to a dock that also has something doable (tested each sampled slot).
- Honest finding: "at least 2 doable at EVERY dock within 100 ly" cannot be guaranteed because job generation (other parts of `src/universe`) is off limits. Measured over the 4,000 docks within 100 ly, five slots: 93 to 94% of boards have 1+ doable, 74 to 75% have 2+, and about 1.5% (53 to 70 boards) are dead ends where every doable job leads to a board with none. Tests pin "88% / 68%" as floors. Free travel avoids true dead ends.
- Options for the Lead (suggestion): let the universe layer guarantee one short, cheap job per board; or accept the numbers above.

## 6. Migration (as report-agent-2e section 10)
Every save with universe version below 3, from another seed, or holding an old-shape id is moved: ship to `startDockOf(WORLD_SEED)`; job and free trip cancelled, fuel back (up to the tank); outposts refunded (`outpostPrices`, else the estimate); explored, discoveries, delivered list cleared; credits, fuel, ships, upgrades, paint, ranks, completed counts and times kept; `universeVersion: 3` stored; message "The universe was rebuilt..." once (plus the outpost refund sentence). Same for imported files (`src/save/transfer.ts`). `SAVE_VERSION` stays 1.
Tests (`game4i`, whole load path via `planStart` on a memory storage): job in flight (credits +26,400 refund, Scout, upgrades, paint, ranks, counts kept, job null, explored empty, fuel back); free trip with 290 explored; floating; v1 plain; two loads in a row (message once, nothing written the second time); mislabelled version 3 with old ids; current save untouched (same object); garbage dock id lands at start; imported file; old ids through `loadState`. Also game4f and save/save-transfer.

## 7. Explored cap
`MAX_EXPLORED_SYSTEMS` 20,000 -> 100,000 (the dense centre reaches a new system about every minute). Plain object form kept: about 17 bytes per entry, 1.7 MB full (tested under 2.2 MB, under 5 s to clean and write); under the 5 MB browser limit. After the cap new systems are not recorded and pay nothing. Known cost: `recordArrival` copies the object per arrival (O(n)). Suggestion: a compact form later if anyone really reaches 100,000.

## 8. balance-sim
11 tests in 3.5 s on CI (under 10 s). It still proves: pay per fuel and per hour stays inside the intended band for the Hauler and Scout on the start region, upgrades and rank bonuses do not break the economy, no strand loops. It does NOT prove balance for the middle or the rim.

## 9. Work list for G5 (not done here)
- Agent 3 (render): replace `listSystemsNear` in `src/render/index.ts`, `starmap.ts`, `start.ts`, `systemview.ts`, and in `src/models.ts`, `src/planets.ts`; use `game.nearbySystems` / `nearbyDocks`. `three` types need `npm install` (local type check only).
- Agent 5 (ui): `BoardEntry` has `reach` and `reachText` (show "can do now / needs fuel / too far"); show `getBoardSummary().message` and `getPlaceInfo().remoteMessage`; `tests/ui.test.ts` builds `BoardEntry` without them and imports `listSystemsNear`; also fix `ui-savefile`, `ui-names`, `title`, `floatpick`, `earthlike`, `planetlook` tests.
- Existing tests still failing outside my files: `ui.test.ts`, `ui-savefile.test.ts`, `render-helpers` and friends (they use removed functions).

## 10. Risks and suggestions
- Risk: 1.5% dead-end boards and thin rim boards; messages cover them.
- Suggestion: a late long-range ship (200+ ly jump) so the rim becomes playable.
- Suggestion: a rescue/tow at far docks instead of only refusing.
- Suggestion: universe layer guarantees one short job per board.
- Suggestion: compact explored form if the 100,000 cap is ever reached.
