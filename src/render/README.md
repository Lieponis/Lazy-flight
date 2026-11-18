# src/render

Everything you see. Reads data from `universe`; `universe` never reads from here.

- `index.ts` starts everything (`startRender`) and switches between the two screens.
- `settings.ts` the easy settings: seed, start system, the map's numbers (`MAP_*`: 60,000 star pixels, 5,000 diamonds, 10,000 tappable stars, sky size and speed).
- `starmap.ts` screen 1: the galaxy map (see "The galaxy map" below). `systemview.ts` screen 2: star, planets, docks.
- `input.ts` drag / zoom / tap. `hud.ts` + `hud.css` the plain HTML label and buttons.
- `helpers.ts` small pure functions (tested). `state.ts` what is selected right now. `start.ts` picks the start system.

Part 3c: `docked.ts` is the home screen (ship parked at its dock, camera above it). Its camera maths is pure and lives in `dockedcam.ts`.

## The galaxy map (stage G5a)

- The map shows the 60,000 stars nearest to where you are, one pixel each; stars inside the ship's reach get a diamond too (at most 5,000); a tap picks the nearest of the 10,000 closest stars and the camera flies to it. The label shows name, type, distance and the 5 nearest neighbours.
- The stars are asked for ONCE each time you arrive somewhere (not per frame) through a `MapSource` (`galaxy/mapdata.ts`). The app builds it in `src/mapsource.ts` (the only place the map touches universe code; the render layer gets plain lists and plain functions). `startRender(renderer, parent, { seed, mapSource })`.
- Behind the stars is the sky seen from where you stand: a soft glow plus 60,000 dots, built from the universe's own density (`galaxy/universefield.ts`, fed by plain functions from the glue), rebuilt only when you enter another sky cell (`galaxy/skycell.ts`), a few milliseconds per frame; the old sky stays until the new one is ready.
- `?mapstats=1` shows the developer counters (stars, diamonds, tappable, sky build time, frame time); `?reach=NUMBER` forces the diamond reach.
- `galaxy/` also holds the first galaxy prototype (`galaxy-map-preview.html`, a stand-in galaxy, online only, kept as a developer page).

## The background dots (stage G5a)

`backdrop.ts` keeps the plain dots behind the system view, flight, docked and the models page. Each system has its own pattern (`systemSkySeed` in `helpers.ts`), the same every time; decoration only. `starfieldPositions(count, radius)` without a seed gives the old pattern.

## The preview build

`src/previewboot.ts` is the first import of `src/main.ts` and of every developer page. In a build made with `VITE_PREVIEW=1` it keeps the page's saves apart from the live game's (`preview-v3:` in front of every key, `src/previewstorage.ts`) and shows a small PREVIEW tag. Without the flag it does nothing.
