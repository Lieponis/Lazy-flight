# Agent 5 report, stage F2b (5f): screens for free travel, the Explorer rank and paint jobs

## 1. What was built (src/ui, CSS and ui tests only)
Andy chose each look from A/B/C first, then checked "matches" on his phone.
- **FLY HERE** (Andy chose B: facts on the card, one tap). On the system map's planet card, for any dock or scenery planet, it shows "Fuel N · left N/N · trip time" (fuel left on arrival), "NEW SYSTEM: +N CR" when it pays discovery credits, and a FLY HERE button. All numbers come from `game.canFreeTravel(id)`; a refusal shows the game's text in red, never hidden. One tap calls `game.freeTravel(id)`; the existing `syncFlight` starts `api.startFlight` (now with the worn livery). The numbers refresh on every game change. Galaxy map: no separate button. A star's docks are reached with its "Open system" and then the planet card, which keeps it simple.
- **Floating at a planet without a dock** (Andy chose C: nearly empty screen, one button; he placed it **top right, under the status strip**).
  - **WHAT NOW?** opens: FLY SOMEWHERE (`api.leaveFloating()`, then this system's map), SHIPYARD, JOBS & FUEL (a "NO DOCK HERE" card with `game.whyNotDocked()`), EMERGENCY FUEL (only when `game.isStuck()`), MENU & RANKS, STAY & ENJOY. Sideways the choices sit in two columns.
  - The status strip says "IN SPACE AT <planet> · <system>".
  - The maps' CLOSE and Esc go back to floating (`api.showFloating`), not to a dock.
  - The Shipyard and MENU work while floating. Buying refusals there show the game's planet-naming line.
  - Reload while floating comes back floating with WHAT NOW? (Agent 3's glue line).
  - While WHAT NOW? shows, the fading notes start below it (body class `ui-whatnow-on`).
- **Free arrival note:** after a free trip, once the arrival picture is on screen (docked, or floating), a fading note shows `game.lastFreeArrival`: the funny line, "New system! +N CR for discovering it." or "A new planet for your logbook.", and "EXPLORER RANK UP: <name>!". **Fixed during testing:** the floating scene counts as "flying" for the render API, so the note waits for `screen === "docked"` or `api.floatingPlanetId() !== null` instead.
- **Explorer row:** the 4th card on the Ranks screen, in the job-rank style. It shows the rank name, RANK n/3, a progress bar (from `EXPLORER_DISCOVERIES_NEEDED`), "N more discoveries to …", the discovery bonus, and the systems and planets seen, plus a hint line. The Delivered card also shows an Explorer rank-up from a job ("DELIVERED · RANK UP!").
- **Camera button** (Andy chose a pixel eye): restyled **from `src/ui/theme.css` only**, without editing render. The selector is `.fh-button[title$=" view"]`. It hides the emoji, draws a pixel eye with box-shadow squares, and adds a small "VIEW" label. It still cycles Orbit, Free and Cockpit.
- **Paint jobs** (Andy chose A: a list inside the ship card).
  - Owned ships have ACTIVE or SWITCH on their own row, then UPGRADES and **PAINT n/4** side by side.
  - Each row shows the ship's picture in that paint (`shipPictures([id], {id: livery})` with `pictureKey`), the name and line from `liveriesFor(shipId)`, and WORN / WEAR / BUY · 500 CR, or a grey button with `row.reason`.
  - BUY then asks "Wear it now?" (WEAR NOW or LATER). The card picture shows the worn paint.
  - `api.setShip(id, game.currentLivery(id))` runs at load and on every game change, and both `startFlight` calls pass `livery`, so the pad, flight and floating all wear it.
- **Sound for free trips** (`src/ui/sound.ts`): flight sounds now play for free trips too. The launch phase is multiplied by `SCENERY_TIME_FACTOR` (imported from `src/render/floatmath`) when the trip starts at a planet without a dock, and the approach when it ends at one, the same rule as `flight.ts`. The sounds themselves are unchanged. The guard test (`launchSeconds:` counted once in flight.ts) still passes.
- **Hints:** on the Jobs menu when nothing on the board is takeable: "No jobs for you? Fly somewhere new: MAP, tap a planet, FLY HERE. New star systems pay discovery credits." On the Explorer card: "Every new star system and planet counts…". WHAT NOW? shows the funny "no dock" line. There is still no tutorial system, so there are no first-time-only hints.
- **Tests:** 11 new tests in `tests/ui.test.ts` (FLY HERE text, arrival note, Explorer row, WHAT NOW? choices, floating controls and overlays, strip wording, no-jobs hint, paint rows). Two old exact-shape tests were updated for the new `whatNow` field.

## 2. Verified
- `npm run check`: 683 pass. Actions green for e9d0f7b and 96be205. cd41b66 was stuck in GitHub's queue during the GitHub Actions/Pages outage of 2026-11-11, about 20:48 UTC; it was restarted with an empty commit.
- Headless browser at 390×844, 360×640 and 844×390: FLY HERE to scenery; floating; arrival note with discovery credits; WHAT NOW? and the refusal; reload while floating; Explorer row; paint refusal while floating; fly back to a dock; buy and wear paint (credits −500, the ship wears it on the pad); the page never scrolls.
- Andy on his phone, upright and sideways: all of steps 2 to 6 "matches" (FLY HERE, floating and WHAT NOW?, refusal, reload, Explorer, paint buy, wear, pad and flight, camera button).

## 3. Known issues and notes for the Lead
- The flight-sound timing for free trips was checked in code and tests, not by ear.
- The camera button styling depends on the render button's class and title ending in " view". If Agent 3 changes them, the old emoji button comes back (nothing breaks).
- Floating uses `screen === "flight"` plus `game.state.spacePlanetId` (no trip). `api.isFlying()` is true while floating, so the UI uses the game state for this.
- At very high `?speed=` the card shows "0s" trip time (true wait). The animation still takes its minimum time.
- No first-time hint after the first docking: that needs a stored "seen" flag (save or Agent 6 area). Suggestion below.

## 4. Changes outside src/ui
`tests/ui.test.ts` and this report. Nothing in src/render, src/game, src/universe, src/save or src/main.ts.

## 5. Suggestions (not built)
- First-time tutorial hints with a stored "seen" flag (needs a small save field).
- A small "+N CR" ka-ching for discovery credits (a sound change, Agent 7).
- A FLY HERE shortcut on the galaxy map for a star's main dock.
