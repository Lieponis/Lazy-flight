# Agent 5 report, part 5c: Ranks and Outposts screens

## 1. What was built (all in src/ui and tests)
Placements were chosen by Andy (multiple-choice questions before building).
- **Rank-blocked jobs:** `rank-too-low` added to `SHORT_REASONS` ("Rank too low"). Cards show "✕ NEED RANK: <name>", worked out from the plain reward the same way the game does (`requiredRankIndex` on `baseReward`), plus the game's full sentence.
- **Ranks screen** (`ranks.ts`, overlay `"ranks"`), opened from **MENU → RANKS & OUTPOSTS**, so the bottom bar keeps 3 big buttons. One card per category (cargo, passengers, tours) shows: rank name, RANK n/3, a progress bar, "N more jobs to <next>", jobs delivered, the pay bonus and the biggest job allowed. Below them: **YOUR OUTPOSTS**, with each owned outpost and its perks.
- **Outpost panel** at the top of the Jobs list (it scrolls with the cards). At an outpost for sale, it shows the price, the perks (fuel -20%, pay +10% on jobs ending in that system) and BUY OUTPOST. BUY asks "BUY THIS OUTPOST?" (YES, BUY or CANCEL), the same two-step style as NEW GAME. When owned, the panel says "YOUR OUTPOST" with the perks. Stations show no panel. Failures give a short reason ("Need 1,200 CR more").
- **Visible perks:** the Refuel button shows the discounted price plus "(-20%)". Job cards ending in a system where you own an outpost get an amber "+10% OUTPOST" tag next to the reward.
- **Messages:** the purchase uses the shared message card (`popup.ts`) with the game's funny `OUTPOST_LINES`. A rank-up shows on the Delivered card: the title becomes "DELIVERED · RANK UP!", plus the line "RANK UP: <name> (<kind>)". The funny rank line is already inside the debrief.
- 18 new tests in `tests/ui.test.ts`, for the plain functions in `logic.ts` (`neededRankText`, `rankRowText`, `rankUpLine`, `outpostPanelText`, `shortOutpostReason`, `perksText`, `ownedOutpostLine`, the discount on `refuelButton`, the bonus on `jobCardText`).

## 2. Verified
- `npm run check` on current `main`: 316 tests pass, and the build succeeds. GitHub Actions run for commit 0ce5df3: green.
- Headless browser at 360×740 and 740×360: rank-blocked card; buying with the confirm step; Refuel "(-20%)"; the "+10% OUTPOST" tag; the Ranks screen; the rank-up Delivered card; reload keeps the outpost and ranks. The page never scrolls.
- Andy on his phone (upright and sideways): blocked rank, Ranks progress after a job, buying an outpost (credits earned with `?speed=100000`), the perks, and reload.

## 3. Known issues and notes
- `/game-debug.html` TEST credits do NOT reach the real game: that page saves under its own keys (by Agent 4's design). Andy earned credits by playing with `?speed=100000`. **Suggestion:** a test-only way to add credits to the real save, if the Lead wants faster click-tests.
- Job cards still show the total reward (rank and outpost bonus included, as `job.reward` already does). The tag marks only the outpost part.
- Not changed: src/render, src/game, src/universe, src/save.

## 4. For other agents
- The new screen pattern is the same as before: a class like `ranks.ts`, a name in the `Overlay` type, opened from `index.ts`. `GameMenu` now takes an optional 5th argument, `onRanks`.
- Agent 6: the UI keeps no state of its own. Ranks and outposts are already in the save (Agent 4's fields).

## 5. Suggestions (not built)
- An "owned" marker on the starmap and system map for systems with your outposts (needs src/render).
- Show on the Ranks screen which job on the current board would move each rank forward.
- A test-only credits option for the real game (see section 3).
