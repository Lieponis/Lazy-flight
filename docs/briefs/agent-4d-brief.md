# Agent 4 brief, part 4d: ship upgrades (rules and state)

You are Agent 4 (Gameplay). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/proposal-ship-upgrades.md (APPROVED by Andy: the design source), docs/report-agent-4b.md, docs/report-agent-4c.md, docs/report-agent-6a.md, docs/report-agent-6b.md, docs/CONVENTIONS.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-4d.md. Free flight and combat are permanently out. Push to main if you have GitHub access.

## Goal
Credits get a long-term use: four upgrade tracks (fuel tank, hold/cabin size, efficient engines, passenger comfort), five levels each, per ship.

## Do
1. State: per owned ship, an upgrade level 0..5 for each track. New field with defaults in `normalizeState`; old saves load at level 0; bad numbers repaired; no change to `SAVE_VERSION` unless truly needed. The active ship and `ownedShips` structure must keep working (UI and saving depend on them).
2. Rules (pure logic in `src/game`): effective tank, cargo, cabin and fuel-per-ly from base plus levels (formulas and prices in `settings.ts`, using the starting numbers in the proposal). Passenger comfort raises pay on passenger and tour jobs only. Decide the exact order in which it combines with rank and outpost bonuses (additive on the plain reward is the proposal); tell Andy plainly what you chose. Fuel is clamped when a tank changes.
3. Make sure the whole job path uses the effective numbers: board filtering and block reasons (fuel, cargo, cabin), accept, trip fuel cost, refuel price/amount, emergency fuel, arrival pay, debrief. The 6b rules stay: accept checks the job without bonuses; delivered jobs do not return.
4. API for Agent 5: `game.getUpgradeOffers(shipId?)` (per track: level, max, next price, effect text, `canBuy`, `reason`), `game.buyUpgrade(shipId, track)` returning `{ok:false, reason}` on failure (no credits, max level, job in flight, unknown ship). Short wording for each failure reason in plain text; a funny line for each purchase in `debriefs.ts`.
5. Extend `/game-debug.html`: show upgrades of the active ship, buy a level (with the TEST credits button), see the effective numbers change.
6. Tests in the style of tests/game4b.test.ts and tests/game4c.test.ts: levels and prices, each effect, clamping fuel, order of bonuses, old-save loading, determinism, failures. Update the balance simulator (`tests/sim`) so it still runs (it may ignore upgrades for now; say so).
7. `npm run check` must pass.

## Allowed / not allowed
Allowed: src/game, src/game-debug.ts, game-debug.html, tests, docs. Not allowed: src/render, src/universe, src/ui (Agent 5 builds the panel next), src/save rules (state defaults only).

## Andy checks (after a green Actions run)
`/game-debug.html`: buy a level of each track on the active ship and see the numbers change; switch to another ship and see its own levels; too little credits and a max-level purchase are refused with a clear reason; reload keeps everything.
