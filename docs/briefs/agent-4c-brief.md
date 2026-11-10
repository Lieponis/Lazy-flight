# Agent 4 brief, part 4c: Ranks and outposts with perks

You are Agent 4 (Gameplay). Work on the CURRENT `main` of the repo (never an old zip). Read docs/design-doc.md, docs/CONVENTIONS.md, docs/OUT-OF-SCOPE.md, docs/status.md and reports 4a, 4b, 5b, 6a first. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-4c.md. Free flight and combat are permanently out. Max 3 ships, max 3 ranks per category in v1.

## Goal
Give the player long-term goals: ranks in job categories, and buying outposts (a home base) with small perks.

## Rules decided by Andy (design doc)
- Outposts are generated as part of the universe (every planet has an outpost on the surface OR a station in orbit). Buying one is the player's choice; the player can also just play jobs.
- A bought outpost is a plain stored whole number (count) plus the list of which dock ids are owned. It is a "home base". Nothing fancy.
- Perks for owned outposts must exist (small, e.g. fuel discount at that dock/system, extra job slot, bonus pay on jobs that end there). Pick 2 perks, tell Andy, keep numbers in `settings.ts`.
- Ranks: earned per job category (TRADE, PASSENGER, TOUR) by completed jobs/delivered value. 3 ranks each (names funny, in `ranks.ts`). Higher rank unlocks bigger jobs (amount/reward band) and a small reward bonus. Numbers in settings.

## Do
1. State additions in `GameState` with defaults in `normalizeState` (old saves must still load; do NOT change `SAVE_VERSION` unless needed; saving is in `src/save`, already working).
2. Rules in `src/game` (pure logic): rank progress, rank-gated jobs shown on the board with a clear block reason when rank is too low, outpost price (from the dock/planet via a formula, whole credits), `buyOutpost(dockId)`, perks applied in the existing reward/refuel rules.
3. API for Agent 5: `game.getRanks()`, `game.getOutpostOffer(dockId)`, `game.buyOutpost(dockId)`, `game.getOwnedOutposts()`, with `{ok:false, reason}` failures. Funny debrief lines for rank-ups and outpost purchase in `debriefs.ts`.
4. Extend `/game-debug.html` to show ranks, buy an outpost, and see perks (TEST buttons for credits as before).
5. Tests in the style of tests/game4b.test.ts: rank progress, gating, price, buying, perks, old-save loading, determinism.
6. `npm run check` must pass. Deliver by pushing to main if you have GitHub access, otherwise one zip of only changed files plus the report.

## Allowed
src/game, src/game-debug.ts, game-debug.html, tests, docs. Not allowed: src/render, src/universe (ask the Lead), src/ui (Agent 5 builds the screens in 5c from your API).

## Andy checks
Green Actions run, then /game-debug.html: complete jobs and see rank progress; buy an outpost and see a perk work; reload and everything is still there (saving works with the new fields).
