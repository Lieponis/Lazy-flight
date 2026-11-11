# Agent 4 brief, stage L1: paint jobs (liveries) in the game rules and the save

You are Agent 4 (Gameplay). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/report-agent-8-liveries.md (the API note), docs/report-agent-4f.md, docs/report-agent-4d.md (ship upgrades), docs/report-agent-6a.md (saving). One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Report: docs/report-agent-4g.md. Agent 3 works in src/render at the same time (stage F2a); you must NOT touch src/render, src/ui or menus.

## Andy's decisions (2026-11-11)
- Each extra paint job costs a SMALL PRICE (Lead proposes 500 credits each; "standard" is always free). Andy can change the number: tell the Lead the value you chose in `settings.ts`.
- Built together with the new gameplay (free travel). No other livery rules were given. Cosmetic only: no gameplay effect.

## Do
1. Catalog: the game must know which paint jobs exist per ship. The render layer owns the art and the list (`liveriesFor(shipId)` in `src/render/assets`), but `src/game` must not import render. So duplicate only the ids in `src/game` (a small table: ship id -> ["standard", ...3 ids]) and add a TEST that fails if this table differs from `liveriesFor` (a test may import both).
2. State/save: each owned ship keeps its owned paint jobs and the one it wears (default: owns "standard", wears "standard"). The active ship's pair lives with `shipId`; non-active ships in `ownedShips` (as for fuel). New fields with defaults in `normalizeState`; unknown ids repair to "standard"; old saves load; `SAVE_VERSION` and `lazy-freight.*` keys as in 6a. Test an old save (pre-L1) through the WHOLE load path (a crash like the F1 one must not repeat).
3. Rules/API: `game.getLiveryCatalog(shipId)` (rows: id, name, description, owned, worn, price, canBuy, reason), `game.buyLivery(shipId, liveryId)`, `game.setLivery(shipId, liveryId)` (free once owned; standard always available), `game.currentLivery(shipId)`. Buying works only when docked (at a dock) and with enough credits, for any ship you own (not only the active one). Plain-text failure reasons, in the game's funny tone for the funny ones. Buying a ship starts with "standard".
4. Names/descriptions come from the render list, so the game stores only ids; give the UI (Agent 5, later) what it needs: price, owned, worn.
5. Tests: buy, wear, switch, can't buy twice, can't buy without money or while floating at a scenery planet, standard always free, switch ship keeps each ship's livery, save round-trip, old save, unknown id.
6. `/game-debug.html`: a small "Paint jobs" section to buy and wear so Andy can test before the Shipyard picker exists.
7. `npm run check` green; Actions green. Balance: tell the Lead how much of a ship's income one paint job costs; do not retune anything.

## Allowed / not allowed
Allowed: src/game, src/save, tests, /game-debug.html, docs. Not allowed: src/render, src/ui, new screens, changing anything Andy decided.

## Andy checks
On `/game-debug.html`: buy a paint job (credits drop by the price), wear it, switch ship and back, reload: choices are kept; try to buy without money or twice: refused with a plain text.
