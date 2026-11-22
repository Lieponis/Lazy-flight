# Agent 3q brief: far place markers at their TRUE place, not pinned to the screen edge (Andy 2026-11-22)

Build on CURRENT main. One step at a time with Andy (Step N of M / DO max 3 / LOOK FOR / REPLY WITH). Visual work: A/B/C options, Andy answers "matches / does not match". Lean. Never touch save data. Tests stay green. Suggestions labelled "suggestion".

## Andy
"Icons like home / recently visited / starred systems are flowing around the edges if they are too far from my current position. I would rather they showed just as a relative position, as a non-clickable item, in the whole space."

## Lead's finding (3n, src/render/routelayer.ts, routemath.ts, routetag.ts)
A place beyond the drawn 60,000-star ball, off the picture, or behind the camera is pinned to the screen edge (EdgeSide, pickPlaces with MAP_PLACE_MAX / MAP_PLACE_EDGE_MAX) with a name tag, so while the map turns these markers slide around the edge. Near markers (inside the drawn stars) already sit where their star is.

## Wanted
1. Home (start dock), outposts, recent docks, starred places: draw each at its REAL position on the map, also when it is far outside the drawn stars, like a distant beacon in the real galaxy. No pinning to the edge, no sliding along the border: when you turn the map the marker moves with the sky exactly like the stars do.
2. Far markers are NOT tappable (no selection, no travel menu) and have no star under them. Near markers keep today's behaviour (tappable where the star is tappable).
3. Keep them readable: constant small size (not shrinking to nothing with distance), the same glyphs and colours as now (house, flag, star, recent), a dimmer look than near markers so near and far differ. Name text only when the player taps nothing needed: suggestion, ask Andy: A = no names for far markers; B = a short name appears when the marker is near the middle of the picture.
4. If a marker is behind the camera or outside the picture it is simply not shown (turn the map to find it). Options for Andy to pick (show A/B on his phone):
   A: nothing at the edge at all (pure true positions);
   B: true positions, plus ONE small edge arrow only for the current flight-plan TARGET (the plan needs it; the flight plan's far target should keep its edge marker with name and distance, as Andy accepted in 3n).
   Default B.
5. Check the map still reaches those places: the zoom-out limit may stop short of very far places; if so tell Andy plainly and propose one of: allow more zoom-out, or a "show far places" helper (suggestion, not built without Andy).
6. Performance: far markers go through the existing finer overlay layer; keep 60 fps on Andy's iPhone (?mapstats=1), report the numbers.

## Check
A test that a far marker's screen position equals the projection of its real position (no clamp) and that it is not in the tappable list; the flight-plan target still gets its edge marker under option B. Andy's eye test: turn the map around slowly from the start dock with a far starred system; the marker moves with the stars and does not slide along the border.

## REPLY WITH (max 10 lines)
What changed, live link, which options Andy picked, 60 fps numbers, and whether far places are reachable by zoom-out.
