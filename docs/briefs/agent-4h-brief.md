# Agent 4 brief, stage N2: lock the world seed, developer flag, old saves on other seeds

You are Agent 4 (Gameplay / saves). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-unique-names-world-seed.md (source of truth), docs/report-agent-2c.md, docs/report-agent-4e.md (move + refund), docs/report-agent-6e.md (save file import), src/save/startup.ts, src/save/migrate.ts, src/save/transfer.ts. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Explain technical words in one sentence. Report: docs/report-agent-4h.md. Combat never; no new features.

## Goal
Everyone plays in the ONE shared universe (`WORLD_SEED`, exported from `src/universe`, value 12345). A player cannot change the seed. Developers can still test other seeds with a flag. Saves that belong to another seed are carried over (not lost).

## Do
1. **Seed lock in `planStart`** (`src/save/startup.ts`): the seed of a new game is always `WORLD_SEED`. `?seed=NUMBER` in the address is honoured ONLY together with `?dev=1` (a pure function `devFlagFromAddress`, tested); without the flag it is ignored (no error, no message). A fresh game or a bad save starts on `WORLD_SEED`. Remove the use of `randomSeed()` (keep the function only if a test needs it; mark it unused).
2. **Saves on another seed** (old test saves, saves made with `?seed=` or "New random universe"): treated like a universe change. Reuse the existing "move + refund" path (`migrateSave`): keep credits, ranks, ships, upgrades, paint jobs, Explorer rank counts? NO: the explored list belongs to the old universe, so clear explored systems and planets (keep the rank only if the rank is stored separately; say what you did); ship goes to `startDockOf(WORLD_SEED)`; a job in flight is cancelled (fuel given back); outposts refunded at the price paid (flat 20,000 for ones without a stored price); delivered-job list cleared; the save is rewritten with `seed: WORLD_SEED`; show the same message once ("The universe was rebuilt. Your credits and ships came with you."). Saves with seed 12345 are untouched (names change, ids do not).
   - In dev mode (`?dev=1`) with an explicit `?seed=`, behave as today (new game with that seed, replaces the save), and make sure a developer save on another seed is NOT silently moved on the next normal load: say how you handle this (the developer can always reload with `?dev=1&seed=N`; a normal player never sees it).
3. **Save file import** (`src/save/transfer.ts`): a file with another seed goes through the same move + refund rule (instead of only a warning); the confirm text should say so (words are Agent 5's; give them a flag/field to show). Same-seed files unchanged. Tests for import of a seed-777 file.
4. **Menu logic:** in `src/ui/gamemenu.ts` / `src/ui/index.ts` make the SMALLEST edit that removes the "NEW RANDOM UNIVERSE" choice and the seed line (NEW GAME keeps the "Really start over?" step and starts the world seed again). Agent 5 polishes the wording in N3; say exactly which lines you touched.
5. **Developer links:** every place that builds or documents a `?seed=` link for the game page needs `&dev=1` (debug pages `/debug.html`, `/planets.html`, `/game-debug.html`, `/models.html` are developer pages and may keep `?seed=` without the flag: say what you decided and make it consistent). Update docs/WHERE-TO-LOOK.md and the README testing aids list (`?dev=1&seed=N`, `?dev=1&reach=N` etc.).
6. **Tests (through the whole load path):** normal address with `?seed=777` -> still world seed; with `?dev=1&seed=777` -> seed 777; save on seed 777 + normal address -> moved and refunded; save on seed 12345 -> unchanged; garbage save; two loads in a row (message once); import of other-seed file; the old Explorer lists and paint jobs survive correctly; `npm run check` and Actions green; `npm run offline-check` if available.

## Allowed / not allowed
Allowed: src/save, src/game (only if the carry-over needs it), the smallest edits in src/ui/gamemenu.ts and src/ui/index.ts as above, debug pages' link text, tests, README, docs. Not allowed: src/universe, src/render, new features, changing the save file format version beyond what is needed (say if you needed to).

## Andy checks (live, after the merge)
1. Open the normal game link with `?seed=777` added: you still get the shared universe (no change).
2. Open with `?dev=1&seed=777`: a different universe (developer mode).
3. MENU > NEW GAME has no "random universe" choice.
4. With a save made on seed 777 (Agent 4 will give you a quick way, for example via `/game-debug.html`), open the normal link: credits and ships come with you, the rebuilt message shows once.
