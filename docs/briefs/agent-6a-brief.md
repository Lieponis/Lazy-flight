# Agent 6 brief, part 6a: Saving and loading

You are Agent 6 (Save / QA / Balance), part 6a: SAVING ONLY. Method: read docs/design-doc.md, docs/CONVENTIONS.md, docs/status.md and the reports of Agents 4a, 4b, 5a, 5b first. Work on the CURRENT `main` of the repo (not an old zip; old copies are stale). One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-6a.md. Free flight and combat are permanently out.

## Goal
Reloading the page must continue the game. Today a reload starts a new game.

## Do
1. **What to save** (Game state only; the universe is never saved, it comes from the seed): seed, `game.state` (credits, fuel, location/dock, active ship `shipId`, `ownedShips`, current job and progress, clock/time slot), plus a version number. Nothing the UI or render keeps (they redraw).
2. **Where:** browser localStorage, `src/save`, one key, JSON. Wrap every read/write in try/catch (private windows or blocked storage must not crash the game: play on without saving and show a small notice).
3. **When:** after every state change (accept, arrival, buy, switch, refuel), and when the page is hidden/closed. Not every frame.
4. **Loading:** at start, if a valid save exists, use `game.loadState(saved)` (repairs bad numbers, unknown ships, old saves without `ownedShips`). If a flight was in progress, the game resumes the flight screen (5a already supports this). `?seed=NUMBER` in the address = start a new game with that seed (and replace the save); no parameter = continue the save, or random seed if none.
5. **Version and corruption:** a save with a wrong version or broken JSON is ignored (never crash), the broken one is kept under a backup key once.
6. **Menu:** a small SETTINGS/MENU item (UI file, same style as the Jobs menu) with NEW GAME (asks "Really start over?" first) and a line showing the seed. Keep it minimal; ask Andy before adding anything else.
7. **Tests:** save then load gives identical state; broken/old/wrong-version saves; storage that throws; mid-flight save; determinism of the universe after load.
8. `npm run check` must pass. Deliver by whatever method Andy can use (direct push to main if you have GitHub access, otherwise one zip of ONLY changed files plus the report).

## Allowed
src/save, small glue in src/ui/index.ts, a menu file in src/ui, tests, docs. Read-only for src/universe, src/render, src/game (ask the Lead if a change there is needed).

## Andy checks (after a green Actions run)
Play a job, reload mid-flight: the flight continues. Reload when docked: same credits, fuel, ship, dock. Buy a ship, reload: still owned. NEW GAME resets. Open in a private window: game still plays. Phone too.
