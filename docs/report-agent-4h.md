# Report: Agent 4, stage N2 (one shared world seed, ?dev=1, carrying over other-seed saves)

## What was built
- **Locked seed.** `planStart` (src/save/startup.ts): a normal address ignores `?seed=`; the seed is `WORLD_SEED` (12345). `?dev=1&seed=N` starts a new game on N (developer). `?dev=1` alone continues a save on another seed as it is (never moved, nothing written). New pure helpers `devFlagFromAddress`, `devSeedFromAddress`.
- **Carry-over.** `migrateSave(save, toSeed?)` (src/save/migrate.ts) now also moves a save of ANOTHER seed to the target seed, with the same "move + refund" rule as the universe v1 -> v2 move: credits, ships, upgrades, paint jobs, job counts/ranks kept; trip cancelled with its fuel back; outposts sold back (stored price, else 20,000 estimate); explored places forgotten; start dock of the world seed. The migrated save is written back at once, so the message shows ONE time (`MESSAGE_REBUILT` + the outpost line). `SAVE_VERSION`, universe version and keys unchanged.
- **Explorer rank:** it is computed from the explored places, so a moved save loses its Explorer rank (same as the v1 -> v2 move). Not a separate stored number.
- **NEW GAME** (src/ui/index.ts, `forgetSavedGame` in src/save): after "Really start over?" the saved game is deleted and the page reloads on the world seed. With `?dev=1` it keeps the dev seed. The "New random universe" choice and the "UNIVERSE SEED" line are removed from the menu (src/ui/gamemenu.ts, minimal edit; `NewGameChoice` is now just "same").
- **Import:** `inspectImport`/`applyImport` judge a file against the world seed, not the page seed. A file from another seed gets `WARN_OTHER_SEED` (new wording: "will be moved ...") and a new field `otherSeed: boolean` on the result for Agent 5's confirm text. Export of a developer save keeps its own seed.
- **Developer pages** (`debug.html`, `planets.html`, `game-debug.html`, `models.html`) still use `?seed=` without the flag (my decision; they never touch the real save). `game-debug.html` section 12 plants a made-up seed-777 save in the real game's storage, to try the carry-over.
- Docs: README (testing aids), WHERE-TO-LOOK.

## How to check
Live: `?seed=777` shows the normal system; `?dev=1&seed=777` another one. Debug page section 12, then the normal page: 19,345 credits (12,345 + 7,000 refund) and the rebuilt-universe message. NEW GAME gives 200 credits. Andy checked all of these.
Tests: new `tests/world-seed.test.ts` (24; whole load path, raw pre-paint save on another seed, once-only message, untouched world-seed save writes nothing, dev mode, NEW GAME, import). Updated 4 start-up tests in `tests/save.test.ts` and 1 in `tests/save-transfer.test.ts` that assumed `?seed=` changes the universe.

## Known issues / not verified
- A developer save on seed 777 is moved by the next NORMAL page load (that is the rule). Use `?dev=1` to keep working on it.
- `?seed=` is still mentioned in a comment in src/render/settings.ts (not mine to edit).
- Local stand-in runner: 3 `save-transfer` tests fail only because the stand-in lacks `toBeTruthy` / `APP_VERSION`; `audio` has 1 old failure; `agent6c` needs the real runner. Real result = GitHub Actions (branch check was green).
- Other tabs of the game open on the old code can write their own seed back (same as before).

## For the next agents
- Agent 5: menu has no seed line or random-universe choice any more; use `otherSeed` on the import result for the confirm text (`WARN_OTHER_SEED` is a placeholder wording).
- Test links need `&dev=1` for any `?seed=`.
