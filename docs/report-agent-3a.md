# Agent 3 report, part 3a: Starmap and System View

## 1. What was built
- **Starmap:** the 185 systems within 35 light years of the start system, drawn as chunky colored diamonds (generator's star colors), a simple starfield, a teal fuel-range ring (25 ly), drag to rotate, scroll or pinch to zoom, tap a star for a white marker and a text label (name, star type, distance, in or out of range). Button: "Open system".
- **System view:** star in the middle, planets on orbit lines, gas giants clearly larger, each planet with its dock: an OUTPOST (small building with a pointed roof on the surface) or a STATION (small box with blue wings, slowly circling the planet). Tap a planet for its name, type, dock kind and dock name. Button: "Back to map".
- **Start:** seed 12345, system nearest the middle of the galaxy (Kopipex). `?seed=NUMBER` in the web address also works (suggestion, built because it was tiny).
- **Pixel look:** same chunky stretch, flat colors with four brightness steps baked in (no lights). The picture now fills the whole window in any shape (about 57,600 pixels, so 320x180 in a 16:9 window).
- **Tests:** 17 small tests for the helper code. The cube page is replaced; `/debug.html` is unchanged.

## 2. How to check it
Open the live page, drag, zoom, tap a star, press "Open system", tap a planet, press "Back to map".

## 3. Live link
The site address ending in `/lazy-freight/` (the one Andy used for the click-test).

## 4. Known issues and what was NOT verified
- Verified by Andy's click-test on the live site (desktop browser and phone): starmap, drag, zoom, tap, Open system, docks visible, planet labels, Back to map, `/debug.html`. GitHub Actions run was green.
- I could not run `npm run check` or open a browser in my workspace. I only ran the helper code and the universe code offline.
- Phone speed was judged by feel only; no frame-rate numbers were measured.
- Fuel range is one fixed number (`FUEL_RANGE_LY`), not real fuel.
- Planets are not to scale and orbits are spaced evenly on purpose, for readability.
- Tapping the star itself in the system view does nothing.

## 5. For Agent 3 (part 3b): the code, in `src/render/`
- `index.ts`: starts everything (`startRender`), switches screens, runs the frame loop, resizes to the window.
- `settings.ts`: seed, start system, fuel range, map radius, tap size, star count.
- `starmap.ts`: screen 1. `systemview.ts`: screen 2 (`makeOutpost`, `makeStation`, `makePlanetMesh` are the shapes to restyle).
- `input.ts`: drag, zoom, tap. `hud.ts` + `hud.css`: the plain HTML label and buttons.
- `helpers.ts`: pure helper functions (tested). `state.ts`: what is selected. `start.ts`: picks the start system.
- Planet colors are baked into vertex colors with no lights. Dithering, palette limit and vertex wobble go on top of this.

## 6. For Agent 4 and Agent 5
- `startRender(renderer, parent)` returns `{ state, showStarmap(), showSystem(id) }`.
- Read the selection: `api.state.get().selectedSystemId` (star on the map) and `.selectedPlanetId` (planet and dock id, same id for both). `.screen`, `.currentSystemId`, `.viewedSystemId` are there too. `api.state.subscribe(fn)` tells you when anything changes.
- The current system is fixed at the start system for now. Traveling will need a way to change it (Agent 4).
- The HUD text and buttons in `hud.ts` are temporary; Agent 5 can replace them.

## 7. Suggestions (labeled, not built)
- Suggestion: let Andy restyle outposts and stations in 3b (bigger stations, ring or dome shapes, or free CC0 models).
- Suggestion: tap the star in the system view to show its type.
- Suggestion: draw a faint line from the current system to the selected star on the starmap.
- Suggestion: add `package-lock.json` after the first local install, so builds are identical every time.
