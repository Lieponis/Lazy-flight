# Agent 3 report, stage NAV-2 ("3n"): the flight-plan line and place markers on the galaxy map

Live build: https://lieponis.github.io/Lazy-flight/ (main, CI green on `3a76543`). Andy checked the line, the markers, the far target and the smooth icons on his iPhone; his last word was "Perfect".

## What was built

- **The plan line** from the ship through every hop, thin and bright, in three looks: A plain, **B dashed (Andy's choice, the default)**, C dim line with moving dots. A dim "rest" line runs from the last drawn hop to the target when the plan has more hops than are drawn (40 at most).
- **Markers.** Amber square for a stop, amber ring with a white centre for a refuel stop, white-yellow diamond for the target, green house (start dock), teal flag (owned outpost), yellow star (starred), grey-blue hollow square (recent dock). Each has a one-pixel dark edge so it reads over stars and the sky. In a crowded spot the target wins, then places, then refuel stops, then plain stops. At most 8 places are marked at a time, at most 4 of them pinned to the edge. No label per marker.
- **A far target** (beyond the drawn 60,000-star ball, off the picture, or behind the camera) becomes an **edge marker**. How: the target's place is projected with the camera; a point behind the camera is flipped so it points the right way; the result is pushed to the edge of a safe rectangle (the title on top and the bottom bar are measured by `Hud.freeRows()` twice a second and kept clear). Its words ("NAME, 1,240 ly") are ordinary pixel-font text next to it, on the side that points into the picture, never over the tapped-star label. The camera's far limit is stretched to the plan's reach so the line itself is never cut.
- **Camera help:** `RenderApi.showMapRoute()` opens the map and frames the ship plus the first 4 hops, never beyond the zoom-out limit.
- **Markers as a finer layer** (after Andy's "all icons shake when rotating the view"). See "The shake" below.

## Files

- New in `src/render/`: `routemath.ts` (pure maths), `routeglyphs.ts` (the little pictures as text rows), `routelayer.ts` (line, dashes, dots, marker positions), `routetag.ts` (words next to the target), `markeroverlay.ts` (the finer marker layer), `route.css`.
- Edited in `src/render/`: `starmap.ts`, `hud.ts` (`freeRows`), `settings.ts` (`MAP_ROUTE_*`, `MAP_PLACE_*`, `MAP_TURN_SMOOTH_MS`), `index.ts` (new `RenderApi` methods), `input.ts` (optional turn easing, off).
- **Glue lines (smallest edits):** `src/mapsource.ts` (`makeNavForMap`: system id to position); `src/ui/index.ts` (`mapNav`, `pushMapPlaces()` keyed on dock, recent, starred, outposts, and the `?mapto` testing aid). Agent 5k wired `setMapRoute` / `showMapRoute` (SHOW ON MAP) on top.
- Not touched: `src/universe`, `src/game`, `src/save`, workflows, `src/render/flight.ts` literals.

## Numbers (Andy's iPhone, Safari, `?mapstats=1`, start region, 20-hop plan, look B)

FRAME 16.7 ms (60 fps), JS 0.1 to 0.4 ms, draw calls 9 to 15 (6 without a plan). Measured with the markers drawn inside the picture. **Not re-measured** after the finer layer: it removes the marker draw calls and moves at most about 60 small elements per frame.

## The shake (found with Andy's help)

Andy's video showed the icons shaking while the map turned; the stars looked steady. Measured from the video: icons and stars move in step, so it was not a timing fault. Cause: the stars are 3D shapes, so their edges slide smoothly; a marker drawn as a fixed pixel picture inside the small picture can only jump a whole big pixel. Tried first: easing the camera's follow of the finger (60 and 120 ms): no change for Andy, so it is **off** (`MAP_TURN_SMOOTH_MS = 0`, `?mapturn=60|120` still tries it). Fixed by: markers are small hard-edged enlargements laid over the map and placed on the screen's own fine pixels (every texel a whole number of device pixels, so they stay chunky and crisp). The target's words follow the exact spot. Checked in real Chrome at phone pixel ratio here; on the phone by Andy.

## Testing aids (Safari only; the home-screen app cannot take `?words`)

`?mapplan=N` made-up plan of N hops and places · `?mapto=far|NUMBER` real plan to a far star, not saved (glue) · `?mapline=a|b|c` line look · `?mapicons=chunky|fine` · `?mapturn=MS` · `?mapstats=1` developer counters (shows PLAN, markers, dashes, icons, turn easing).

## Tests

82 new: `routemath` 46, `routelayer` 12, `mapturn` 13, `markeroverlay` 11. CI (`npm test`, then deploy) green on `3a76543`. Honest note: this workspace has no real three.js or vitest, so locally I ran them with a small stand-in and type-checked; CI is the real check.

## Known issues and limits

- Not confirmed on a real screen: the framing after FLIGHT PLAN, SHOW ON MAP, and plans beyond about 20 hops (dim rest line).
- The dashes are thin and a little faint over the dense star field (optional: longer dash share, brighter colour).
- The finer markers are page elements above the picture, so they skip the pixel look's colour palette (colours exactly as written) and are not part of the picture itself. They sit under the HUD panels and under the target words, and are hidden when the map is left.
- Markers closer than 6 picture pixels hide one another, so a crowded stretch can pop markers in and out.

## Next agent needs to know

- `RenderApi`: `setMapRoute(route|null)`, `setMapPlaces(places)`, `showMapRoute()`; types `MapRoute`, `MapPlace`; helpers `routeFromPlan`, `placesFromRows`. Render imports nothing from game, ui or universe.
- Lesson: anything drawn as a bitmap inside the low-res picture moves in whole big pixels and looks steppy next to the 3D stars. Draw such things as a finer layer.

## Suggestion (not built)

- Make the dashes longer or brighter if the line gets lost over dense stars.
- The one- and two-pixel "dot" stars still step in whole pixels; if they ever bother Andy while turning, the same finer-layer idea does not apply (they are thousands), so it would need a different approach.
