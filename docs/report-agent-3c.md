# Agent 3 report, part 3c: the docked view

## 1. What was built
The docked view is now the home screen. The game starts in it, and every arrival ends in it (after the approach animation, the ship is parked at the destination dock).
- OUTPOST: the ship stands on a landing pad (blinking corner lights) on a small curved planet, so the surface curves away to a horizon. The outpost building, a mast and two crates stand beside the pad.
- STATION: the ship rests on a bay platform joined by a corridor to the station, with the planet large below and the sun in the sky.
- Colors, dock kind and names come from the universe. Camera: above the ship looking down, drifts slowly, drag to turn, pinch or scroll to zoom. No cockpit, no Orbit/Cockpit button.
- One temporary button "Map" (opens the system view). A temporary "Back to dock" button was added to the system view and the starmap. The old 3a label and buttons are hidden while docked, except the dock name text and "Map".
- Camera maths is a pure helper (`dockedcam.ts`) with 11 tests.

## 2. How to check it
Open the live page with `?speed=120`. Drag, zoom, press Map and Back to dock, accept a job, watch the flight, check the docked view at the destination.

## 3. Live link
The usual address ending in `/lazy-freight/`, plus `?speed=120`.

## 4. Known issues and NOT verified
- Verified by Andy's click-test on the live site (Actions run green): home screen at start, drag and zoom, Map and Back to dock, flight and arrival at the destination dock (name matched the panel), phone check, and he saw both an outpost and a station docked view.
- I could not run `npm run check` or open a browser in my workspace. I ran the camera and flight tests offline with a stand-in test runner.
- Not re-confirmed by Andy in 3c: starmap and `/debug.html` (see Andy's reply). Phone frame rate was judged by feel only.
- Ship, pad, building and station are plain rough shapes; Andy dislikes the ship look (3d).
- The expanded trade panel can still cover the docked view on a phone; it starts folded there.

## 5. Settings (`src/render/settings.ts`)
DOCKED_CAMERA_ANGLE_DEG 28 (how steeply it looks down; the height follows from angle and distance); DOCKED_CAMERA_DISTANCE 14; DOCKED_ZOOM_MIN 6 and DOCKED_ZOOM_MAX 40; DOCKED_ANGLE_MIN_DEG 8 and DOCKED_ANGLE_MAX_DEG 80 (how low and high you can drag); DOCKED_DRIFT_SPEED 0.04 radians per second (0 = no drift).

## 6. For Agent 5
- Render API: `showDocked(dockId)` (home), `showSystem(id)`, `showStarmap()`, `setCurrentSystem(id)`, `startFlight(info)`, `endFlight()`, `isFlying()`. `state.get().screen` is "docked", "starmap", "system" or "flight"; `state.get().dockedDockId` is the dock the ship is parked at.
- Temporary buttons to replace: "Map" in the docked view (`DockedScreen.enter` in `docked.ts`), "Back to dock" on the system view (`systemview.ts`, `refreshHud`) and on the starmap (`starmap.ts`, `refreshHud`). They use the plain label and buttons in `hud.ts`.
- Call `api.showDocked(dockId)` after closing a menu; arrival and start already do it.

## 7. For Agent 3 (part 3d, pixel look)
`docked.ts` (pad, building, mast, crates, platform, corridor, ground and station planet), `ship.ts` (ship), `systemview.ts` (`makePlanetMesh` now has a `detail` argument, `makeOutpost`, `makeStation`). All use flat vertex colors with four brightness steps; blinking lights are plain materials.

## 8. Every change outside src/render
Only `src/ui/index.ts`: one line `api.showDocked(game.state.currentDockId)` at start (before `syncFlight()`), plus a comment edit. Inside src/render I also changed `index.ts`, `state.ts`, `starmap.ts`, `systemview.ts`, `flight.ts`, `hud.css` and `settings.ts` (small additions).

## 9. Suggestions (labeled, not built)
- Suggestion: show credits, fuel and location on the docked view (Agent 5's status strip).
- Suggestion: a landing animation when the approach ends, instead of the cut to the docked view.
- Suggestion: small details per dock kind (fuel tanks at outposts, ships passing a station).
