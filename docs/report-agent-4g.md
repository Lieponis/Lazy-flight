# Report: Agent 4, stage 4g (paint jobs in the game rules and the save)

## What was built
- `src/game/liveries.ts` (new): the id table `LIVERY_IDS` (ship id -> "standard" + 3 ids), repair of saved data, the catalog, buying and wearing.
- State: `GameState.shipLiveries` (by ship id: `{owned, worn}`). Default (only "standard", wearing it) is not stored. Unknown ids and ships repair to "standard" or are dropped. `SAVE_VERSION` and all `lazy-freight.*` keys are unchanged.
- API on `Game`: `getLiveryCatalog(shipId)` (rows: id, owned, worn, price, canBuy, canWear, reason), `buyLivery`, `setLivery`, `currentLivery`.
- Rules: buy only at a dock (or inside a dock's planet) with 500 credits, for any ship you own, not the active one only. Wearing owned paint is free. Standard is always free. Refusals are plain text; floating at a planet without a dock names the planet.
- Price: **500 credits per extra paint job** (Andy's decision, 2026-11-11). Constant `LIVERY_PRICE` in `src/game/settings.ts`.
- Names and descriptions are NOT stored in the game; the UI gets them from `src/render/assets/liveries.ts` by id.
- `/game-debug.html` section 11 "Paint jobs": per owned ship, buy / wear / "Try buy" (shows refusals).
- Tests: `tests/game4g.test.ts` (23). Includes the id-table-vs-`liveriesFor` check, buy, wear, switch, no double buy, no money, floating, ship switching, save round trip, an old pre-paint save through the whole load path, bad data.

## How to check
Open `/game-debug.html`, section 11. Andy checked: refusal at 200 credits, buy 5000 -> 4500, wear, second ship keeps its own paint, survives reload.

## Balance note for the Lead
500 cr = about 6 minutes of a sensible player's income (~5,000 cr/h), about 1 hour for a casual player (~511 cr/h). Scout 1,200, Liner 2,500, first upgrade 1,500. All 9 extra paint jobs = 4,500. Nothing retuned.

## Deviation / suggestions
- Stored in a separate `shipLiveries` map (like `shipUpgrades`), not inside `ownedShips`, because the active ship is not in `ownedShips`.
- Suggestion: buying does not put the paint on; the UI can offer "Wear now" after a purchase.

## Known issues / not verified
- I can't run Three.js or Vite here; the cloud checks (green on branch and main) are the build proof.
- Pre-existing, not mine: `audio` test has 1 failure locally (also on main before), `agent6c` needs the real runner.
- Nothing in `src/render` or `src/ui` was touched. Whether the picture really changes colour is the render side's job (stage F2a).

## For the next agents
- UI: call `game.getLiveryCatalog(shipId)`, show name/description from `liveriesFor(shipId)` by `row.id`. Draw the active ship with `game.currentLivery(game.state.shipId)`.
- Use `row.reason` as the button's refusal text; it already names the planet when floating.
