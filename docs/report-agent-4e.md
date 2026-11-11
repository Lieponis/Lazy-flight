# Agent 4 report, stage U2 (4e): game and saves on universe v2 (fewer docks)

Branch `universe-v2`. **Merged to main: NOT YET** (waiting for the green branch check, see section 4).

## 1. What was built
- **`startDockOf(seed)`** in `src/universe` (the only edit there): first dock of the system nearest the middle. New game, autosave fallback, the UI and the debug pages all use it. No generation change, no new random stream.
- **`src/game`** needed almost no change: it already used `getDock` (null for planets without a dock). New: `outpostPrices` in the state (the price you paid for each outpost; whole credits; old saves load with `{}`), and `OUTPOST_REFUND_ESTIMATE = 20000` in `settings.ts`.
- **Old-save move + refund** (`src/save/migrate.ts`, wired into `planStart`). New field `universeVersion` in the save (missing = 1, current = `UNIVERSE_VERSION`); `SAVE_VERSION` and the `lazy-freight.*` keys are unchanged. A version 1 save keeps credits, ranks, ships, upgrades and fuel. The ship goes to the start dock. A job in flight is cancelled and **the fuel it burned comes back** (my choice, "no penalty"). **Each outpost is refunded the price paid, or a flat 20,000 credits for old saves** (they never stored a price; old prices ran from about 5,100 to 39,800). The delivered list is cleared. The moved save is written back at once, so the message shows once: "The universe was rebuilt. Your credits and ships came with you." (+ "Your outposts were sold back for N credits." when there were outposts). It uses the existing toast, no UI change needed. A version 2 save loads untouched; a damaged one is repaired or set aside as before.
- **Safety edits, glue only:** `src/ui/index.ts` (start dock), `src/render/index.ts`, `docked.ts`, `flight.ts` (`getDock`, a planet without a dock is "not found"), `systemview.ts` (a planet without a dock is drawn as plain scenery and cannot be picked; label says "Tap a planet with a dock"), `src/models.ts`. `titlescene.ts` and `planets.ts` already work (decorative). Layer rules unchanged.
- **`/game-debug.html`:** start dock from `startDockOf`; dock list shows planets and docks per system; new section 9 "Old saves": a button that turns the current game into a version 1 save and loads it, plus a box to paste a real old save. Works in a one-dock system.

## 2. Tests (24 new in `tests/game4e.test.ts`, 2 in `universe-v2.test.ts`)
Start dock (real, same every time, full board of 6 on 40 seeds); jobs only at docks (4 seeds); a one-dock system plays a whole job; v1 save with a job in flight and 2 outposts moves correctly (every field); stored price refunded; v2 untouched; garbage never crashes; `planStart` moves once. **Existing tests changed (none weakened):** the 13 failures all hard-coded the old universe. `balance-sim`, `game`, `game4b`, `save` and `tests/sim` used "planet 0" as the start dock, now `startDockOf`; the samplers looped over all planets, now over docks; `game4c` "jobs that end in the system" picked a 40-unit job, now picks one the Hauler can carry; `save` key list gained `universeVersion`.

## 3. How to check it (Andy)
Open `/game-debug.html`: button "TEST: turn this game into an OLD save and load it" shows the message, credits +40,000 (2 outposts), no outposts, back at the start dock. Reload: still there, no second message.

## 4. Known issues, NOT verified
- I could not run `npm run check` or the Vite build here, and Three.js is not installed, so **the render glue edits are checked by eye only** (small, listed above). Everything else: strict type check plus my stand-in runner, all pass (game 27, 4b 38, 4c 22, 4d 27, 4e 24, save 33, ui 51, universe 29, universe-v2 21, balance-sim 11, layer-rule 1, settings 3, and 7 render-helper files 120). Not run: assets, lens, planetlook, title (need Three), agent6c (needs a real runner); audio has 1 failure that Agent 2 saw on main too. Headless browser: debug page, new game, one-dock system, old save by button and by paste, reload, no errors. **The real game page, phones, and Actions are not verified.**
- **Merge:** Actions only runs on `main`, so I added `.github/workflows/check.yml` (Andy approved): it runs `npm run check` on every non-main branch and never publishes. I merge after it is green.
- Until U3, the system view with up to 10 planets may look sparse; expected.

## 5. Data for the Lead (no prices retuned)
- **Outposts within reach (25 ly of the start), 8 seeds:** 79 to 110 docks, of which 32 to 61 are outposts; cheapest 5,000 to 10,200; 0 to 8 cost under 10,000; median price about 22,000 to 27,000.
- **First outpost (`npm run balance`, 40 h):** planner 11.1 h (33 jobs), sensible 29.0 h (76 jobs), spender 27.1 h (55 jobs), casual and lazy never. Planner was 9.1 h on the old universe (6c).
- **Boards a new player cannot use:** 20 of 300 seeds have no takeable job on the first board (old universe: 28 of 300); 9% of boards near the start are dead for a new Hauler (old: 7%). Not a new problem, but a lazy first hour is possible. Suggestion for U4: guarantee one starter job on the first board.

## 6. For the next agents
- **U3 (Agents 3/5):** planets without a dock are scenery; the start system may have 1 dock. `api.state.selectedPlanetId` is only ever a dock planet now.
- **U4 (Agent 6):** the simulator uses `startDockOf`; add a migration check on a real old save from a phone.
