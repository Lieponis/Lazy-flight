# Agent 3 report, part 3b: the flight view

## 1. What was built
When a job starts, the screen shows the flight: the Cargo Hauler (low-poly, built in code) hovers over the origin dock and leaves, a white flash, a warp tunnel (streaking stars and rings), a second flash, then the destination planet and its dock grow and the ship slows to a stop. Text shows the destination, a progress bar, "Arrives in … (at clock time)" and a funny ship-computer line (15 lines, changes every 25 s). A button switches ORBIT (camera circles the ship) and COCKPIT (inside the ship, with a simple frame and dashboard). When the game says the job ended, the approach finishes and the system view of the destination appears.
Everything is decided by the real travel times, so opening or returning to the tab mid-flight shows the right phase. If the flight ended while the tab was hidden, the animation is skipped. Short trips are squeezed in proportion. 16 new tests (`tests/flightplan.test.ts`).

## 2. How to check it
Open the live page with `?speed=120`, accept a job, watch launch, warp, approach, arrival. Press the view button. Switch tabs and return.

## 3. Live link
The usual address ending in `/lazy-freight/`, plus `?speed=120`.

## 4. Known issues and NOT verified
- Verified by Andy's click-test on the live site (desktop and phone): launch, warp, text, both views, approach, arrival, tab switch, a short trip, starmap, system view, `/debug.html`. GitHub Actions run was green.
- I could not run `npm run check` or open a browser in my workspace. I ran the flight-phase logic and its tests offline with a stand-in test runner.
- Phone speed was judged by feel only; no frame-rate numbers. Only one phone and browser were tried.
- Andy does not like the ship and cockpit look yet (to be redone later).
- Same-system jobs never showed up on the boards, so the 20-second case was tested with a short trip at `?speed=30` instead.
- Tour jobs fly straight to the last stop (the starter ship cannot take tours).

## 5. Settings (`src/render/settings.ts`)
FLIGHT_LAUNCH_SECONDS 5 (take-off length); FLIGHT_APPROACH_SECONDS 10 (approach starts this long before arrival); FLIGHT_MIN_WARP_SECONDS 3 (shortest warp shown; below launch+this+approach everything is squeezed); FLIGHT_DOCKED_HOLD_SECONDS 0.6 (pause after docking); FLIGHT_LINE_SECONDS 25; TUNNEL_STREAKS 140 (fewer = lighter); TUNNEL_RINGS 12; TUNNEL_SPEED 70. Computer lines: `flightlines.ts`.

## 6. For Agent 3 (part 3c, pixel look)
`ship.ts` (ship shapes and colors, `shadedGeometry` bakes flat brightness), `cockpit.ts` (frame; it re-lays out for any window shape: bottom 15% dashboard, side pillars that get thinner in tall windows), `tunnel.ts` (streaks and rings), `flight.ts` (scene, camera, planets at each end, HUD), `flightplan.ts` (phases, pure). Planets and docks reuse 3a's `makePlanetMesh`, `makeOutpost`, `makeStation` at 7x size. The white flash is an HTML layer (`.flight-flash` in `flight.css`).

## 7. For Agent 5
The flight HUD is plain HTML built in `flight.ts` and styled in `flight.css`: title top left, progress bar, text box, one view button at the bottom. Keep it under about 150 px tall so the trade panel (top right, up to 210 px from the bottom) never overlaps it. The 3a label and buttons are hidden during flight (`hud.setVisible`).

## 8. For Agent 6
Nothing is saved by the flight screen. It reads `game.progress()` each frame, so a loaded save with a running job simply resumes (glue calls `syncFlight()` at start). Behavior mid-flight: right phase at once; finished while hidden: straight to the system view.

## 9. Every change outside src/render
Only `src/ui/index.ts`: a `syncFlight()` function that calls `api.startFlight(...)` when a job starts and `api.endFlight()` when it ends. Inside src/render I also touched 3a files: `index.ts` (startFlight, endFlight, isFlying, flight camera in resize), `systemview.ts` (added `export` to four functions), `hud.ts` (`setVisible`), `state.ts` (screen name "flight"), `helpers.ts` and `settings.ts` (additions).

## 10. Suggestions (labeled, not built)
- Suggestion: redo the ship and cockpit look in 3c (Andy's note).
- Suggestion: add same-system jobs to the universe, or note they do not exist.
- Suggestion: let the player tap the planet during approach to see the dock name.
- Suggestion: a "skip animation" button for repeat players.
