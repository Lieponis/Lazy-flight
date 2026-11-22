# Agent 3 report, stage "3q": far place markers at their true place

Live build: https://lieponis.github.io/Lazy-flight/ (main, CI green on `3q: the plan target is drawn at its real place too`). Andy checked it on his iPhone ("Matches", twice) and chose **A** for the flight-plan target.

## What changed
- **Far places are where they really are.** Home, outposts, recent docks and starred places beyond the drawn stars are drawn at the exact spot their real position projects to on the map picture. They move with the sky like the stars do, and are never pushed to the edge. A far place that is behind the camera or off the picture is simply not drawn (turn the map to find it).
- **Not tappable, no star under them.** The marker pictures are plain overlays that let every touch through; the tap picks only from the tappable stars (the 10,000 nearest), which a far place is never part of.
- **Same pictures, dimmer, constant size.** The same house / flag / star / hollow square, drawn at half strength (`MAP_FAR_MARK_OPACITY = 0.5`) so near and far differ. The size comes from the picture itself, so it does not shrink with the distance. No names for far places (the brief's option A); suggestion, only if Andy wants it: a short name when a far marker is near the middle of the picture.
- **Limit raised.** Up to 16 place markers at once (was 8, with at most 4 far ones on the edge): far ones no longer crowd the edge, so the separate far limit is gone. The most important kinds still come first (start, outposts, starred, recent).
- **The plan target (Andy's pick: A).** The target is drawn at its real place too, at full strength, with its label ("DEMO TARGET, 1,240 ly") beside it. Nothing at the edge. When the target is off the picture, no marker and no label are shown (turn the map towards it; the dashed plan line still shows the way). Option **B** (one edge marker with name and distance, the 3n look) is still there as `?maptarget=b`, or `MAP_TARGET_MODE = "B"` in `settings.ts`. Andy first saw B and asked for the target to sit in space like the other icons, then asked to keep the label: A does both.

## How
- `routemath.ts` (pure): `trueSpot` (the plain projection, null when behind the camera or off the picture), `TargetMode`, `parseMapTarget`.
- `routelayer.ts`: far places go through `putTrue` (true spot, dim) and near ones keep `put` as before; the target uses `putTrue` for A and the old pinning for B; `counts().far` counts the far markers drawn.
- `markeroverlay.ts` / `routeglyphs.ts`: `MarkSink.add(name, x, y, dim?)`; the overlay sets the opacity once per marker, not per frame.
- `starmap.ts` / `index.ts`: the `?maptarget=a|b` word, and the stats line now shows `edge option A|B` and `far N`. `settings.ts`: `MAP_PLACE_MAX = 16`, `MAP_FAR_MARK_OPACITY`, `MAP_TARGET_MODE = "A"`; `MAP_PLACE_EDGE_MAX` removed. Not touched: `src/universe`, `src/game`, `src/save`, saves.

## Speed (60 fps)
Andy's iPhone screenshot (`?mapplan=20&mapstats=1`, map on screen): **FRAME 16.7 ms (60 fps), JS 0.0 ms, 6 draw calls, 1,876 triangles**; plan of 20 hops with 1,031 dashes, 7 markers drawn. Honest limit: at that moment **0 of the markers were far ones** (the screenshot shows `far 0`), so I have no frame number with far markers on screen. A far marker costs the same as a near one (one projection and one overlay picture, at most 16 places plus the plan's markers, all positions only), so I expect no change, but it was not measured with far markers in view.

## Can far places be reached? (zoom-out)
Yes, by turning the map, not by zooming out. The zoom-out limit is short (Andy's screenshot: 50 ly, bubble 195 ly), so you cannot zoom out to see a place 1,240 ly away. But a marker is drawn where its direction points, however far it is, so turning the map until it points that way brings it on the picture. Andy's screenshot shows the target 1,240 ly away on the picture with a 50 ly zoom limit. No change to the zoom limit was needed. Suggestion (not built): a "show far places" helper that turns the map towards the next far place.

## Testing aid (Safari only)
`?mapplan=20&mapstats=1` shows a made-up plan with a far starred place, a far outpost and a far target (nothing saved). `&maptarget=a|b` picks the target option. Never use `?dev=1&seed=N` on the phone.

## Tests
`farmarkers.test.ts` (CI, real three.js): a far marker's position equals the real projection (several places, 20,000 ly away included, never on the border); off-picture and behind-the-camera far places are left out, not pinned; turning the camera in one-degree steps the marker follows the projection and leaves the picture instead of sliding; far markers are dim and near ones are not; the marker size does not depend on the place; near places behave as before; the target under A (nothing at the edge, true place with its label when on the picture, nothing behind the camera) and under B (edge marker with the label, as in 3n), A is the default; the marker layers contain no tap or selection code, the pictures have `pointer-events: none`, and the tap picks only from the grid of tappable stars. `routemath.test.ts` +4 (`trueSpot`, `parseMapTarget`; run locally, 50 pass). `routelayer.test.ts` adjusted (limit of 16, far places no longer pinned, the B-edge tests now ask for B). CI is the real check: this workspace has no real three.js or vitest (pure parts run with a stand-in, types checked).

## Known issues and limits
- Seen only through Andy's answers and one screenshot, never on a real screen myself.
- Dimming applies to the default finer marker layer. In the old `?mapicons=chunky` testing mode the far markers are at their true place but not dimmer.
- Under A there is no cue at all for where the target is while it is off the picture, and its distance is not shown then. Suggestion: only if Andy misses it.
- Far markers have no names (suggestion above).
