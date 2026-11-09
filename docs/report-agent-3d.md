# Report: Agent 3, part 3d (Integration)

**1. What was built.** Agent 8's models are now used everywhere: the player's ship (by id), outposts (tinted by planet colour) and stations (camera inside the bay), in the docked view, the system view markers and the flight. New flights: station take-off along the planet's surface then a widening orbit, speed-up, shake, warp (10 s); outpost take-off per Andy's schematic (10 s); station arrival as the reverse, turn round in the bay, chase camera, drop-out shake (16 s). The whole ship always fits the picture on any window shape (camera steps back, or the view widens inside a bay). Old shapes are kept with a comment. Models are disposed when leaving a dock. Catalog rows set to INTEGRATED.

**2. How to check.** Green GitHub Actions run, then click-test: dock at an outpost and a station, take off, fly, arrive; open the system view, /models.html, /debug.html. Test with `?ship=passenger-liner` or `?ship=scout`.

**3. Live link.** The game's GitHub Pages link (same as before).

**4. Known issues / not verified.** I could not run `npm run check` or Three.js myself; proof is the green run plus Andy's click-tests. Outpost approach has no arrival shake (left as Andy approved). Cockpit view while leaving a station does not show the planet. Reloading starts a new game.

**5. Settings** (`src/render/settings.ts`). Bay camera: `DOCKED_BAY_*` (margin 0.7, zoom min 4.5, angles 18-65, sway 0.14). Fit: `SHIP_FIT_MARGIN` 1.1, `SHIP_FIT_MAX_FOV` 100. Flames 0.15 parked, 1 flying, 3 warp. Profiles: `STATION_EXIT`, `OUTPOST_EXIT`, `STATION_ENTRY`, `FLIGHT_CHASE_CAMERA`, `FLIGHT_LAUNCH_SECONDS` 10, `FLIGHT_APPROACH_SECONDS_STATION` 16, `FLIGHT_ARRIVAL_SHAKE_SECONDS` 1.8, `FLIGHT_SHAKE_*`. Scales: `SYSTEM_OUTPOST_SCALE*`, `SYSTEM_STATION_SCALE`.

**6. For Agent 5.** Call `api.setShip(shipId)` (already wired in `src/ui/index.ts`; unknown ids fall back to "cargo-hauler"). `FlightInfo.shipId` is optional. To preview a ship use `?ship=<id>`.

**7. For Agent 3 (3e).** Restyle materials and effects (flames, warp flash, shake) in `flight.ts`/`settings.ts`; redo the cockpit frame (Andy dislikes the old ship/cockpit look).

**8. For Agent 8 (change request, not edited).** Coriolis Starport has a face cutting across the inside of the bay.

**9. For Agent 6.** Phone checks: ship never cropped (upright and sideways), docked drag/pinch, take-off and arrival smoothness, frame rate in the system view.

**10. Changes outside src/render.** `src/ui/index.ts` (ship wiring only: `setShip` calls and `shipId` in the flight info); `tests/integration3d.test.ts`; `docs/ASSET-CATALOG.md` status column.

**11. Suggestions (not built).** Arrival shake for outposts; per-ship camera distances; sound for the warp flash.
