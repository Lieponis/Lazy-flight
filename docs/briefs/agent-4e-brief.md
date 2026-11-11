# Agent 4 brief, stage U2: game and saves on universe v2 (fewer docks)

You are Agent 4 (Gameplay). Branch: work on `universe-v2` (NOT main): `git fetch && git checkout universe-v2`. It holds Agent 2's finished universe v2 (docs/report-agent-2b.md on that branch: read it fully). Also read docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-fewer-docks.md (Andy's decisions and the old-save rule: source of truth), docs/report-agent-4d.md, docs/report-agent-6a.md (saving). One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Report: docs/report-agent-4e.md. Free flight and combat are permanently out.

## Goal
Make the whole game correct and green on universe v2, and keep it playable end to end. Then merge `universe-v2` into `main` (only after `npm run check` and Actions-equivalent checks pass; if you cannot merge, tell the Lead).

## Do
1. Start dock: add ONE helper `startDockOf(seed)` in `src/universe` (first of `docksOf(seed, startSystem)`; no change to generation, no new random streams). This is the only allowed edit in src/universe. Use it everywhere a "start dock" is needed (new game, fallback in autosave, debug pages). Add a test, and keep the universe fingerprint tests green.
2. Fix everything in `src/game` that assumes every planet is a dock (use `docksOf` / `getDock`). A job starts and ends at docks only. A system with one dock must work.
3. Fix the 13 failing tests listed in the Agent 2 report (balance-sim 5, game 3, game4b 4, game4c 1). Fix the cause, not the test, where the game was wrong; update a test only where it hard-coded the old universe (specific jobs, planet 0 as dock). Never weaken a test to make it pass: say what you changed in the report.
4. Save migration (src/save), exactly per docs/plan-fewer-docks.md "Old saves (move + refund)": new field `universeVersion` (a save without it counts as 1; current is `UNIVERSE_VERSION`). Version 1 saves: keep credits, ranks, ships, upgrades; place the ship at `startDockOf`; cancel any job in flight (cargo returns, no penalty); remove owned outposts and refund each at its purchase price (store the price paid from now on; for old saves use the base formula or a flat estimate, and tell Andy which); clear the delivered-job list. Keep `lazy-freight.*` save keys. Expose a one-time message "The universe was rebuilt. Your credits and ships came with you." (the UI shows it; Agent 5/you wire it in `src/ui/index.ts` minimally). Tests: v1 save with a job in flight and 2 outposts migrates correctly, v2 save loads untouched, garbage save does not crash.
5. Minimal safety edits so the live game does not crash or offer impossible things (NOT a redesign; visual work is U3 by Agents 3/5): fix the places Agent 2 listed (`src/ui/index.ts` start dock, `src/render/index.ts`, `systemview.ts`, `flight.ts`, `docked.ts`, `src/ui/titlescene.ts`, `src/models.ts`, `src/game-debug.ts`). Rule: planets without a dock must not be selectable as a place to go; everything must still draw. Layer rules stay (render never imports game or ui).
6. `/game-debug.html` must work with a one-dock system and with a v1 save (a button or a pasted old save is fine).
7. Outposts: there are about 3x fewer docks. Report how many docks within reach offer an outpost, and the first-outpost time from `npm run balance`. Do NOT retune prices; give data to the Lead (Agent 6 rebalances in U4).

## Allowed / not allowed
Allowed: src/game, src/save, tests, minimal glue edits listed in step 5, `startDockOf` in src/universe, docs. Not allowed: changing generation in src/universe, new features, new art, changing anything Andy decided.

## Andy checks (live after merge)
New game starts at a dock with a full job board; accept and deliver a job; buy fuel; planets without docks cannot be chosen as destinations. Old save: load the game on a device with a v1 save, see the message, credits and ships still there. Note: until U3, the system view may look sparse or odd with 10 planets; that is expected.
