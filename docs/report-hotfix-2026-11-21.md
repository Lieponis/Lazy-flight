# Hotfix 2026-11-21: installed iPhone app crashes on every start

**Verdict: fixed on main; Andy plays again (confirmed 2026-11-21 19:32).** His old save could not be rescued (see "What happened on Andy's phone").

## Cause
Andy was docked at Crooked Cove Outpost (Hobploo 9T6VR-7427 I), a dock 620 ly above the galaxy's middle plane where stars are sparse.
While the title screen shows, the galaxy map prepares its sky in the background and asks for the nearest 60,000 stars.
From that sparse spot the star search started with a huge ball that reached deep into the dense disc, so it gathered **3 million stars** to keep 60,000.
That took 9 to 13 s and about **390 MB** of memory, and iOS closed the app every time.

Measured in Chromium at phone size, with his save state (fuel 11/140, a far destination, recent and starred places):

| build | title after | memory |
|---|---|---|
| before 224d654 | 9.5 s | 386 MB |
| 224d654 (status bar) | 10.9 s | 386 MB |
| hotfix | 1.9 s | 33 MB |

Commit 224d654 (status bar, canvas size) is **not** the cause. No resize loop was found, and the canvas size is normal.
Route planning was not the cause either: with his ship, it takes 50 to 100 ms.

## Changes
- `src/universe/galaxy/systems.ts`: the nearest-stars search starts from the denser of "here" and "the disc's middle plane below", and grows gently. The answer is exactly the same, without the overshoot.
- `src/game/route.ts`: a flight plan has a work limit (`MAX_PLAN_QUERIES` = 400 questions; normal plans use 50 or fewer). When the limit is reached, the plan shows the hops found so far.
- `src/ui/index.ts`, `src/ui/navtarget.ts`: no flight plan is computed during start-up; it starts 3 s later, or as soon as the player opens it. A stored destination that is not a real place is dropped, and so is one the planner fails on.
- `src/rescue.ts`, `src/main.ts`: the SAFE START screen. It opens after 2 starts in a row that did not keep running for 20 s, or with `?rescue=1`. It clears only `lazy-flight.nav-target` and offers SAVE FILE DOWNLOAD and START GAME. It runs before any heavy code.
- `pwa-mode.txt` = `retire` (kill switch): the old offline helper removes itself within about 1 s of the next open. It also reloads the app from the network, so the fixed version arrives without Andy doing anything. Tested: old helper to kill switch to the fixed build on the next launch.
- `tests/hotfix-boot.test.ts`: 23 tests covering the crash place, the work limit, bad destinations and the SAFE START decision. All 1,353 tests pass.

## What happened on Andy's phone
- The kill switch did **not** reach his installed app. He tried 5 openings plus an iPhone restart, and every time the old stored copy crashed before it switched. The old helper serves the game from its own box first, and it never got the few seconds it needed to fetch the new sw.js.
- He has no Mac, so Safari's Web Inspector could not copy the save out. He removed the app and added it again, so the save inside the app is gone.
- He imported `lazy-flight-save-rebuilt-2026-11-21.json`, which I built from his 18 Nov save file (`tests/fixtures/old-saves/andy-live-2026-11-18.json`) plus what he reported: Crooked Cove Outpost, 26,054 CR, fuel 11. It was moved to universe v3 through migrateSave and checked with inspectImport and planStart. Jobs he did after 18 Nov are not counted. He confirmed it loads and runs at Crooked Cove.

## For the next agent
- Offline play is OFF (`pwa-mode.txt` = `retire`). Turning it back `on` is a Lead and Andy decision. Since this fix, a crashing version shows SAFE START on its third start, and that screen still registers the helper, so updates can land.
- Suggestion: the helper could check the network for a new version before serving the stored game page, so a version that crashes at start-up can still be replaced.
- Suggestion: the map still asks for 60,000 stars. Places far above the disc (1,500 ly or more) are now slow but not memory-heavy. Agent 3 could lower the count there.
