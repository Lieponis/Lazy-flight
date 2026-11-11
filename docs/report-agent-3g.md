# Report: Agent 3, stage 3g / F2a (3D views for free travel, render only)

**Not run here:** `npm run check` and Three.js cannot run in my workspace. Proof = green Actions runs (all 3g runs green, last one after "docks use the same arrival easing") + Andy's click-tests. Offline: stand-in type check + pure tests (`tests/floatmath.test.ts`, `tests/floatpick.test.ts`).

## Built
- **Floating scene** ("in space at this planet"), Andy chose layout **A "Hovering above"**: huge planet straight below the ship (its 7c look, rings, clouds), its star far away lighting it, starfield. **The ship circles the planet** (one lap about 2.5 min, nose along the surface) and **rolls slowly**. No station, no landing. The planet's own light is painted on, so instead of spinning the planet we turn planet and star together (light stays right). Rings are tilted so the plane stays 26+ units from the ship (tested).
- **Camera button cycles** Orbit (auto, no touch) > Free (drag rotate, wheel/pinch zoom, shift/right-drag or two fingers pan, double-tap reset) > Cockpit. While flying (not floating) it stays Orbit / Cockpit. Icon is a **placeholder camera (Andy: Agent 5 will restyle)**.
- **Free trips** use the same launch, warp, arrival; work from and to planets without a dock. Leaving follows Andy's schematic (start in orbit, pitch up, curve away, straighten level before warp). Arriving is the mirror (hold the warp view, nose slightly down, flatten into the orbit). Trips to or from such planets take **1.6x longer** phases (`SCENERY_TIME_FACTOR`). Arrivals at **docks** also hold the warp view first, then ease in (`arriveEase`).
- **Continuous camera:** any jump of the wanted camera spot (new phase, new flight, other view) is kept as an offset that fades in about 1 s; roll and cockpit tilt are eased; planet keeps its circling angle at launch. Camera glides to warp height before warp and back after.
- **Tap empty space in the system view = tap the star** (back to the star view). Selection otherwise unchanged.
- **Liveries:** `buildShipModel(shipId, liveryId?)` passes `{livery}` (missing/unknown = standard). `docked.setShip(id, livery?)`, `flight.setShip`, `api.setShip(id, livery?)`, `FlightInfo.livery?`, `shipPictures(ids, liveries?)` + `pictureKey()` in `src/ui/shippreview.ts`. Test: every livery of all 3 ships builds. **Nothing in the game picks a livery yet** (Agent 5/4).
- **Preview** `?floatpreview=1`: A/B/C layout buttons, `<` `>` through planets (gas giant, ringed, rocky, ice mixed), TRIP (planet to planet, 40 s pretend trip), TO DOCK, TRIS counter. Does not touch the save.

## API for Agent 5 (`src/render/index.ts`, ids are strings)
`api.showFloating(planetId): boolean`, `api.floatingPlanetId(): string | null`, `api.leaveFloating()` (goes to that system's view), `api.startFlight(info)` (origin/destination may be a planet WITHOUT a dock), `api.endFlight()` (ends floating if the destination has no dock, else docked), `api.setShip(id, livery?)`. State: floating uses `state.screen = "flight"` plus new `state.floatingPlanetId` (no new screen name, `src/ui/logic.ts` unchanged).

## Glue edited in `src/ui/index.ts` (the only non-render file besides `shippreview.ts`)
1. `placeName(id)` (dock name, else planet name). 2. `syncFlight()` also starts a flight for `game.state.freeTrip` (origin `fromId`, destination `toId`, no job text) and ends it when the trip is gone. 3. `refresh()`: `flying` is also true while `freeTrip` is set. 4. At page load, if `spacePlanetId` is set and no trip runs: `api.showFloating(spacePlanetId)`. Nothing else.

## Triangles (floating scene)
Not measured on a device (Andy did not send a TRIS reading). By construction: planet 320 (`FLOAT_PLANET_DETAIL` 3) + clouds up to 320 + rings (2 to 5 bands) + star 80, **roughly 700 to 1,300**, plus the ship (Agent 8 budget). Real number: TRIS in `?floatpreview=1`.

## How to check
Live: https://lieponis.github.io/Lazy-flight/ . `?floatpreview=1` (and `?float=A|B|C`). `/models.html?asset=scout&livery=rescue-red`. NOTE `?seed=` starts a NEW game and replaces the save.

## Phone checklist
Open `?floatpreview=1`: step `>` to a ringed planet, press the camera button to Free, drag and pinch (no page scroll, no cut-through); press TRIP and watch for smooth, jump-free camera; read TRIS.

## Known issues / not verified
- Frame rate and TRIS on a real phone; touch controls of Free view on a phone (desktop mouse checked by Andy).
- **Flight sound** (`src/ui/sound.ts` copies flight timing) does not know the 1.6x phases of free trips: may drift for those trips. For Agent 5/7.
- Layouts B and C are unused leftovers (Andy chose A); delete when convenient. Starfield does not turn with the circling (suggestion: turn it too).
- Flaky `tests/universe-v2.test.ts` (not mine, 5 s limit on Actions): suggestion to give it a longer limit. One 3g run was red because the sound test counts `launchSeconds:` in `flight.ts` (fixed; keep that rule).
- Suggestions: pick a livery in the shipyard; a free-trip arrival card.
