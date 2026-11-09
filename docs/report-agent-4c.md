# Agent 4 report, part 4c: ranks and outposts with perks

## 1. What was built
All in `src/game`, plus the test page. **Ranks:** three categories (cargo, passengers, tours), three funny ranks each (e.g. Box Pusher > Crate Wrangler > Freight Baron). Delivering jobs of a kind moves you up. A higher rank unlocks bigger-paying jobs of that kind and adds +0% / +5% / +10% pay. A job above your rank is blocked with the new code `rank-too-low` and the text "Needs rank X in cargo (you are Y)." **Outposts:** buy one where you are docked (stations are never for sale), price from the universe (5,100 to 39,800 credits). **Perks I chose** (both for the whole star system of the outpost): **20% cheaper fuel** and **+10% pay on jobs that end there**. Rank-ups and buying print funny lines.

## 2. How to check it
Open `/game-debug.html`. Section 5 "Ranks": press "TEST: +4 cargo jobs done" and watch cargo become rank 2. Section 6 "Outposts": pick an OUTPOST in the dock list (section 4), teleport (TEST), press "TEST: add 50000 credits" twice, press Buy: perks show 20% / +10%. Set fuel 0 and credits 10 and press Refuel: it buys 6 fuel instead of 5. Reload: everything is still there.

## 3. Live link
The usual address ending in `/lazy-freight/`, plus `game-debug.html`.

## 4. Known issues, NOT verified
- I could NOT run `npm run check` here (no installed packages). I ran: all test files (game 27, 4b 38, new 4c 22, ui 28, save 32, universe 29) with a stand-in runner, all pass; a strict type check of `src/game`, `src/universe`, `src/save`, `src/ui/logic.ts` and the debug page script; and a headless browser click-through of `/game-debug.html` (built with esbuild, not Vite): ranks, buying, cheaper refuel, reload keeps everything, new game clears it. No console errors.
- NOT checked: the real Vite build, the main game page, phones. Actions plus Andy's click-test are the proof.
- Passive income (in the design doc) is NOT built. It needs a timestamp, and `shiftTravelTimes` in `src/save` only moves trip times, so offline time would be counted wrongly. Suggestion for Agent 6 or the Lead.
- The outpost's own `perks` field in the universe is unused; I use settings numbers so every outpost is the same.
- Balance (sample): a new player can take a job at 199 of 200 start docks and on about 92% of boards. Cheapest outpost costs about 5,100 credits, the dearest about 39,800, against job rewards of 800 to 4,000, so the top outposts take many jobs. Check in the balance pass.
- The debug page saves in its own browser keys (`gamedebug.`), never the real save.

## 5. Settings
`settings.ts`: `RANK_JOBS_NEEDED`, `RANK_MAX_REWARD`, `RANK_REWARD_BONUS_PERCENT`, `OUTPOST_PRICE_FACTOR`, `OUTPOST_FUEL_DISCOUNT_PERCENT`, `OUTPOST_DELIVERY_BONUS_PERCENT`. Names: `ranks.ts`. Funny lines: `debriefs.ts` (`RANK_UP_LINES`, `OUTPOST_LINES`).

## 6. For Agent 5 (part 5c)
API: `game.getRanks()` (rows: `label`, `jobsDone`, `rankNumber`, `rankName`, `nextRankName`, `jobsToNext`, `rewardBonusPercent`, `maxReward`), `game.getOutpostOffer(dockId)` (`isOutpost`, `owned`, `price`, `canBuy`, `reason`, `perks`), `game.buyOutpost(dockId)` (gives `price` and a funny `line`, or `{ ok: false, reason }`), `game.getOwnedOutposts()`, `game.getPerks()`. **New block code `rank-too-low`**: add it to `SHORT_REASONS`; suggested wording "Rank too low" (until then the UI shows "Not available"). Board cards already show the real payout (the bonus is in `job.reward`); `BoardEntry` also has `baseReward` and `bonusPercent`. After a delivery, `Arrival.rankUp` says if you ranked up (the line is already in the debrief).

## 7. For Agent 6
New state fields, all defaulted in `normalizeState`: `completedJobs: { TRADE, PASSENGER, TOUR }`, `ownedOutposts: string[]` (dock ids), `outpostCount`. `SAVE_VERSION` unchanged: old saves load with rank 1 and no outposts. `loadState` drops outposts that do not exist in this seed.

## 8. For Agent 3 / Agent 8
Owned outposts: `game.getOwnedOutposts()` (dock id, name, system). Nothing to draw is required.

## 9. Suggestions (not built)
- Passive income per outpost (needs a save-safe timestamp).
- A rank screen and an "own it" mark on the starmap (5c).
