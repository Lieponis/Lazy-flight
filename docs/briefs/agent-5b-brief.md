# Agent 5 brief, part 5b: Shipyard and emergency refuel

You are Agent 5 (UI/UX). Same method as 5a: read docs/design-doc.md, docs/CONVENTIONS.md, docs/status.md, docs/report-agent-5a.md, docs/report-agent-4b.md first. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Deliver one zip; the only report is docs/report-agent-5b.md. Free flight and combat are permanently out.

## Do
1. **Emergency refuel button** in the Jobs menu header. Shown ONLY when `game.isStuck()` is true. Press calls `game.emergencyRefuel()`, shows the funny `line` it returns, refreshes fuel. Failure `{ok:false, reason}` shows the reason.
2. **Shipyard screen** (new overlay, same style as the Jobs menu: `jobsmenu.ts` as the pattern, new name in the `Overlay` type, new button in `navbar.ts` next to JOBS and MAP, docked view only). A list from `game.getShipCatalog()`: ship name, a small preview picture (build the model once, render to a small canvas, see `thumbnail()` in src/models.ts), description, cargo/cabin/tank numbers, price, fuel of that ship if owned. Buttons: BUY (if `canBuy`), SWITCH (if `canSwitch`), "ACTIVE" label on the current one. When disabled, show the `reason` in short plain words. Success/failure messages via the same style as the arrival card.
3. After SWITCH or BUY+SWITCH the docked view must show the new ship (the glue already calls `api.setShip`; verify it also fires on switch, fix in `src/ui/index.ts` if not).
4. **Short wording:** add "Too far for this tank" for `tank-too-small` in `SHORT_REASONS`.
5. **Balance change decided by Andy:** Passenger Liner tank 70 -> 100 in `src/game/ships.ts` (this one number only). Update any test that checks 70.
6. Mobile: both new elements must work on a phone upright and sideways (scrolling lists, big enough buttons).
7. Tests for the new logic in tests/ui.test.ts style (plain functions in logic.ts).

## Allowed
src/ui, tests, docs, and the one number in src/game/ships.ts. Not allowed: src/render, src/universe, other src/game files.

## Andy checks
Green Actions run, then with `?speed=120`: Shipyard opens and closes; buy the Liner (needs credits; use /game-debug.html first if poor? No: play a few jobs or use the TEST credits button on /game-debug.html only); switch ships and see the new ship docked; run fuel to 0 and credits low to see the emergency button appear and work; phone upright and sideways.
