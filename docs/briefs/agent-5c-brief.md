# Agent 5 brief, part 5c: Ranks and Outposts screens

You are Agent 5 (UI/UX). Work on the CURRENT `main` of the repo (never an old zip). Read docs/design-doc.md, docs/CONVENTIONS.md, docs/status.md and reports 5a, 5b, 4c, 6a first. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-5c.md. Free flight and combat are permanently out.

## Do
1. **Rank-too-low wording.** Add a short reason for `rank-too-low` in `SHORT_REASONS` (e.g. "Need rank: <name>"). Job cards blocked by rank show it, and the rank the job needs.
2. **Ranks screen** (new overlay, Jobs-menu style, docked view only). Opened from a button; put it where it fits best on the bottom bar or inside MENU, and tell Andy your choice. Shows for each category (cargo, passengers, tours): current rank name, progress to the next, the pay bonus. Data from `game.getRanks()`.
3. **Outposts.** In the Jobs menu header or a small panel for the current dock (your choice, tell Andy): if the dock's outpost can be bought, show the offer (price, perks: 20% cheaper fuel, +10% pay on jobs ending there, for the whole star system) and a BUY button with the same two-step confirm style as NEW GAME. If owned, show "YOUR OUTPOST" and the perks. Use `game.getOutpostOffer(dockId)`, `game.buyOutpost(dockId)`, `game.getOwnedOutposts()`. Failures show the short reason.
4. **Visible perks.** On the Refuel button show the discounted cost when the dock's system has an owned outpost; on job cards ending in such a system show the bonus pay (small "+10%" marker). Read-only, from game data.
5. **Rank-up and purchase messages** use the shared message card (`popup.ts`) with the funny lines from `debriefs.ts`.
6. Phone upright and sideways: everything scrolls, buttons big enough, page never scrolls.
7. Tests in the tests/ui.test.ts style (plain functions in logic.ts).
8. `npm run check` must pass. Deliver by pushing to main if you have GitHub access, otherwise one zip of only changed files plus the report.

## Allowed
src/ui, tests, docs. Not allowed: src/render, src/game, src/universe, src/save (ask the Lead). Suggestions (starmap "owned" marker needs src/render) go in the report labelled "suggestion"; do not build them.

## Andy checks
Green Actions run, then with `?speed=600`: blocked job shows its rank; Ranks screen shows progress and updates after jobs; buy an outpost (earn credits by playing, or use /game-debug.html TEST credits in a separate tab, same browser); see cheaper refuel and +10% on cards; reload, everything still there; phone upright and sideways.
