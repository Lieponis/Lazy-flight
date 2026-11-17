# Report: Agent 3, stage G2 (galaxy map prototype: many stars, the sky seen from where you stand, phone speed)

**Not run here:** `npm run check`, the real Three.js page, a phone. Proof = green Actions runs (every G2 push was green, 37 to 53 s) + Andy's click-tests on the live page. Offline I ran: a stand-in type check, the 57 checks of `tests/galaxysky.test.ts` in a stand-in runner (real Vitest ran on Actions), the sky shader in headless WebGL2 (it matches the CPU version to 1/255 on every test view), and the timing scripts below in plain Node (cloud V8). **No number below comes from a phone.**

Live page (online only): https://lieponis.github.io/Lazy-flight/galaxy-map-preview.html

## Verdict: GO, with one phone check still open
- Everything the CPU has to do is small: nearest 60,000 stars 30 to 41 ms, tap grid 1 to 12 ms (first build), one tap 0.03 to 1.6 ms, "5 nearest" 0.1 to 0.3 ms, instance fill under 1 ms; the sky (glow + 60,000 dots) is about 0.4 to 0.65 s of work at the default size (up to 1.8 s at the largest), done in 6 ms slices per frame and swapped in when finished.
- The drawing is 4 draw calls (sky box, sky dots, near pixels, diamonds), 120,000 points and 8 triangles per diamond. In software rendering here it costs 41 ms with no diamonds and about 0.025 ms per diamond. **That says nothing reliable about a phone GPU**, so the go depends on Andy's FRAME line (checklist below). Until then use the caps in "Caps for phones".
- Nothing found that needs a different technique. The two things to watch on a phone: how long a sky rebuild takes (CPU; probably 3 to 6 times slower than here) and the draw time of 120,000 points.

## Built (all on the preview page; the game and its map are not changed)
- **Sky seen from where you stand:** an equal-area ring sphere (no cube), rebuilt only when you leave a sky cell. Two parts: a soft glow (ray-march of a stand-in galaxy density with dust, shaded on the GPU from two small textures) and single-pixel dots (60,000 or 150,000, placed by importance sampling from the same density, brightness squeezed so faint ones show). Dots that share a patch of sky with a real near star are removed.
- **Look C (Andy's pick):** 60,000 dots + faint glow, glow LOW / MEDIUM (default) / HIGH, patchy dust (option 2), no dust within 3,000 ly of the centre, soft haze at the rim.
- **Near stars:** the nearest 60,000 stars, each one a pixel (closer = brighter, fades to nothing at the edge of the ball so there is no visible edge); stars inside the ship's reach are diamonds (one instanced mesh), the same size in space everywhere (about 0.4 to 0.9 ly).
- **Reach:** AUTO (the shortest of 55 / 80 / 250 / 1,000 ly that holds at least 200 stars) or one of the four. (My reading of "there should be diamonds at the rim": not yet confirmed by Andy.)
- **Camera:** closest zoom 2.5 ly; farthest zoom follows the local star spacing (default NEAR = out to the nearest 1,000 stars: 13 / 53 / 170 / 822 ly at centre / start / middle / rim; MEDIUM = twice that; WIDE = 0.9 of the ball); the camera can always back off 12 ly around a tapped star.
- **Tap a star** (nearest 1,000 / 10,000 / 20,000 are tappable): the camera glides to it. Only two text lines exist: the tapped star and its 5 nearest stars. No per-star labels.
- **Counters:** place, near stars, camera, tap grid and last tap, "5 NEAREST", sky building / built, sky cell, frame (ms, fps, JS ms, draw calls, triangles, heap if the browser tells).

## Andy's decisions this stage
Sphere not cube; dots not squares; look C; dust option 2; no dust near the centre; haze at the rim; "rim matches, centre matches"; diamonds same size in space; diamonds at the rim for later ships; zoom out limited AND outer stars faded; tap to fly to a star; rim zoom limit much smaller ("Rim zoom matches"). **Still open:** whether AUTO reach is what he meant, whether centre and start zoom feel right, yes/no on my suggestion to shape the near stars like the galaxy (see Suggestions), and his phone numbers.

## Numbers (cloud machine, plain Node/V8; a phone CPU is slower, expect 3 to 6 times)
Stand-in galaxy: radius 50,000 ly, start at 16,667 ly from the centre. Star spacing 2 ly (centre), 8.6 ly (start), 30 ly (outer); the real rim is about 134 ly.

**1. Counts per density and reach.** All rows: **4 draw calls**, **120,000 points** (60,000 sky dots + 60,000 near pixels), 60,000 near stars made in 41 / 35 / 30 ms (2 / 8.6 / 30 ly), instance fill 0.0 to 0.7 ms (plain-array stand-in for the same arithmetic; the real Three calls are somewhat slower, still well under 5 ms).

| spacing | reach | stars within reach | diamonds with cap 2,000 / 10,000 / 20,000 | triangles (8 per diamond + 12 for the sky box) |
|---|---|---|---|---|
| 2 ly | 55 or 80 | 60,000 (all) | 2,000 / 10,000 / 20,000 | 16,012 / 80,012 / 160,012 |
| 8.6 ly | 55 | 1,085 | 1,085 / 1,085 / 1,085 | 8,692 |
| 8.6 ly | 80 | 3,404 | 2,000 / 3,404 / 3,404 | 16,012 / 27,244 / 27,244 |
| 30 ly | 55 | 34 | 34 / 34 / 34 | 284 |
| 30 ly | 80 | 93 | 93 / 93 / 93 | 756 |

At 2 ly the cap, not the reach, decides how many diamonds you get (5,000 diamonds = the nearest 5,000 stars, about 21 ly around you).

**2. Tapping** (spatial grid, about 4 stars per box; result equals testing every star on 300 random rays). First build is cold JIT; later builds are 0.3 to 1.6 ms. Re-measured after tap rule v2 (below): the same within noise, because the rule only chooses among the few stars already found in the circle.

| tappable stars | grid build (first) | one tap, average / worst | star tests per tap | 5 nearest |
|---|---|---|---|---|
| 1,000 | 0.8 ms | 0.03 to 0.07 / up to 1.2 ms | about 700 to 1,100 | 0.01 ms |
| 10,000 | 3.6 ms | 0.05 to 0.10 / up to 1.0 ms | about 1,500 to 2,500 | 0.05 ms |
| 20,000 | 8.8 ms | 0.07 to 0.10 / up to 0.9 ms | about 1,800 to 3,000 | 0.09 ms |
| 60,000 | 12.1 ms | 0.09 to 0.18 / up to 1.6 ms | about 2,500 to 3,800 | 0.3 ms |

A tap makes about 700 to 3,800 star tests (a star can be tested twice because the steps along the ray overlap), and this grows only slowly with the star count. Checking every star (what `starmap.ts` does now) would be 60,000 projections per tap.

**3. Sky build** (the glow ray-march at three sizes, then the dots, then colours; run in 6 ms slices, so no frame is blocked; the old sky stays until the new one is ready).

| place | glow 6.2K / 24.6K / 98.4K squares (ms) | dots 60,000 (ms) | dots 150,000 (ms) |
|---|---|---|---|
| centre | 75 / 283 / 1,180 | about 285 | about 700 to 840 |
| start | 92 / 364 / 1,474 | about 285 | about 700 to 840 |
| middle | 63 / 247 / 1,037 | about 285 | about 700 to 840 |
| rim | 27 / 105 / 509 | about 285 | about 700 to 840 |

Colour conversion 0.3 to 11 ms; removing dots near real stars 9 to 14 ms (60,000 dots; about 380 to 640 removed). Default (24.6K squares + 60,000 dots) at the start = about 665 ms of work. The page shows the real wall time as SKY BUILT; on a phone it will be several seconds, which is fine because the old sky stays. If it is too slow, the 6.2K size (about 90 ms) is the first thing to try.

**4. Frame cost in software rendering** (headless Chromium, SwiftShader on 2 CPU cores, 320 x 180 picture, a raw WebGL2 harness drawing the same buffers and shaders, **not the real Three.js page**). Software drawing is much slower than a phone GPU, so read these as "the most this could cost" for the GPU part. They say nothing about phone JavaScript.

| what is drawn (centre, reach 80) | frame ms |
|---|---|
| glow only | 2.5 |
| sky dots only (60,000 points) | 17.5 |
| near pixels only (60,000 points) | 21.9 |
| diamonds only: 250 / 500 / 1,000 / 2,000 / 4,000 | 6.7 / 12.5 / 24.9 / 48.3 / 94.4 |
| everything, 0 / 250 / 1,000 / 2,000 / 4,000 diamonds | 41 / 44 / 63 / 87 / 136 |

Full scene at the cases of table 1: 2 ly 2,000 / 10,000 / 20,000 diamonds = 85 / 255 / 418 ms; 8.6 ly 1,085 / 2,000 / 3,404 = 57 / 79 / 101 ms; 30 ly 34 to 93 diamonds = 37 to 42 ms. So on this machine 60 fps is not reachable even with no diamonds (41 ms = 24 fps), and the largest diamond count that fits 16.7 ms with everything else switched off is about 650. Both are software numbers. JS time per frame of the real page was not measured (the page's FRAME line shows it).

**5. When does the sky visibly change?** Compared the sky built at a point with the sky built 10 to 10,000 ly away (average of 4 directions: sideways, along the disc, toward the centre, up). "Glow" = average brightness change / share of the sky that changes by more than a tenth of the glow range. "Dots" = share of dots that move more than one screen pixel (0.28 degrees).

| distance moved | 10 | 30 | 100 | 300 | 1,000 | 3,000 | 10,000 ly |
|---|---|---|---|---|---|---|---|
| centre glow | 0 / 0 % | 0.1 / 0 % | 0.4 / 0 % | 1.3 / 0 % | 3.7 / 12 % | 9.8 / 31 % | 36 / 96 % |
| centre dots | 2 % | 25 % | 74 % | 93 % | 98 % | 100 % | 100 % |
| start glow | 0.1 / 0 % | 0.4 / 0 % | 1.3 / 0 % | 3.8 / 10 % | 8.6 / 17 % | 10.9 / 27 % | 21.5 / 73 % |
| start dots | 0 % | 2 % | 34 % | 80 % | 97 % | 99 % | 100 % |
| middle glow | 0.1 / 0 % | 0.2 / 0 % | 0.5 / 0 % | 1.6 / 6 % | 3.5 / 13 % | 4.6 / 17 % | 12.5 / 50 % |
| middle dots | 0 % | 0 % | 3 % | 68 % | 87 % | 96 % | 100 % |
| rim glow | 0 | 0 | 0 | 0.1 / 0 % | 0.2 / 0 % | 0.4 / 1 % | 1.0 / 3 % |
| rim dots | 0 % | 0 % | 0 % | 43 % | 77 % | 90 % | 99 % |

Reading it with "5 % of the sky changes visibly" as the line: the **glow** changes after about 500 ly at the centre, about 200 ly at the start, about 300 ly in the middle, and **not within 10,000 ly at the rim** (the rim looks out of the disc, so it is nearly the same everywhere). The **dots** move sooner: about 20 ly at the centre, 50 ly at the start, 150 ly in the middle and 150 to 200 ly at the rim. The sky is rebuilt when you leave a cell of 60 / 960 / 960 / 1,920 ly (about 4.5 % of the distance to the centre). So inside a cell the sky does not change at all; when you cross into the next cell it is rebuilt and swapped in, and the dots jump (a step of one start cell, 960 ly, moves 97 % of them). The player never sees the exact sky, so the only visible effect is that jump.

## Formulas (shader and code are the same; `src/render/galaxy/previewmath.ts`)
- **Pixel brightness:** `x = clamp(d / R, 0, 1)`; `b = (1 - 0.82 * x^0.6) * edgeFade(d, R)`; `d` = distance from the player in ly, `R` = radius of the near-star ball. Pixel size: 2 px if `d < 0.22 R`, else 1 px.
- **Edge fade:** `t = clamp((x - 0.7) / 0.3, 0, 1)`; `edgeFade = 1 - t^2 (3 - 2t)` (1 inside 70 % of the ball, 0 at the edge). Diamond colours use the same fade.
- **Ball radius:** `R = spacing * cbrt(3 N / (4 pi))` for N = 60,000 stars: 50 / 209 / 673 / 3,261 ly at centre / start / middle / rim.
- **Diamond size (ly across):** `0.6 * (0.55 + 0.3 * clamp(starSizeClass, 0.5, 3))`, the same in space everywhere.
- **Auto reach:** the first of 55, 80, 250, 1,000 ly whose ball holds at least 200 stars (else 1,000).
- **Zoom-out limit (distance from the player):** NEAR = min(0.9 R, distance of the 1,000th nearest star); MEDIUM = min(0.9 R, 2 x that); WIDE = 0.9 R. The camera distance is also limited so the camera itself never leaves that sphere (`maxOrbitDistance`), but can always go 12 ly around the target.
- **Tap (rule v2, 2026-11-17):** a ray from the finger through the grid, steps of 0.9 grid cell; the stars inside the tap circle (20 css px) are the candidates. Stars too faint to see (visibility below 0.15: `tapVisibility` = the brightness the picture draws them with) only count when no visible star is in the circle. The nearest candidate to the camera wins; candidates up to 1.25 times that distance compete on closeness to the finger (`SAME_DEPTH_RATIO`; 1 = plain nearest).
  - Old rule (v1, replaced): the closest star to the ray won, with a depth bonus worth at most 15 % of the tap radius: `angle + 0.15 x tolerance x (distance / farthest distance)`. A far star exactly on the ray beat a near star only 3 px off it (Andy's bug).

## How much is physics and how much is noise
- **Physics-like (one density function, the same for every viewer):** the band, the bulge, the arms and the dust lane as seen from your position (glow = a real ray-march: dimming by dust per colour channel, near stars cut out); where dots are likely (placement is importance-sampled from the same density: denser toward the band and centre); and the way all of it changes slowly with distance (table 5).
- **Hash noise:** the exact position and brightness of every dot (hash of the sky cell + a counter), the shapes of the dust lumps and the 150 ly sway of the lane, and the cloudiness of the stand-in density.
- **Not physics at all:** squeezing dot brightness (light^0.5) so faint dots show; the glow curve; the edge fade of the near ball.
- **So:** the large pattern ("which way is the centre, where is the band, is the sky dark here") is real to the model; every single dot is noise. The model itself is my invention (not Agent 2's), so it is only as true as `densityAt` will be.

## Caps for phones (proposal; numbers above are not phone numbers)
- **Diamonds:** default cap **5,000** (40,000 triangles), phone maximum **10,000**, desktop up to **20,000**. With AUTO reach the preview never needs more than 3,102 diamonds (start about 1,080 at 55 ly; middle 3,102 at 250 ly; rim 1,780 at 1,000 ly); only the dense centre (cap decides) and a long reach at the start (250 ly = 60,000 stars) fill the cap.
- **Tappable:** **10,000** (grid build about 4 ms, tap well under 2 ms). 20,000 and 60,000 also cost almost nothing, but only the nearest are useful to tap.
- **Near pixels:** 60,000 now; if Andy's FRAME line is slow, 30,000 is the next lever (the points cost the most in software).
- **Sky:** 60,000 dots and the 64 size (24.6K squares); 32 (6.2K squares) if rebuilds feel too slow.
- Change the numbers only after Andy's phone lines; the page buttons already let him try 2,000 / 5,000 / 10,000 / 20,000.

## What must change in the real map code (when the real generator arrives)
1. **`src/render/starmap.ts` (`StarMapScreen`).**
   - Data: `listSystemsNear(seed, origin, radius)` (everything inside a radius, full system objects) becomes a "nearest N stars, nearest first" call from Agent 2 that returns only id, x, y, z, colour, size class (N = 60,000; made once per position).
   - Drawing: the single octahedron `InstancedMesh` (size per star, `starmapStarSize`) becomes `NearLayers` (`src/render/galaxy/nearlayers.ts`): diamonds inside the reach (cap), a pixel for every star, same-size diamonds.
   - Backdrop: `starfieldPositions(STARFIELD_COUNT = 260, backdropRadius)` Points become `SkyView` + `SkyBuilder` / `DotsBuilder` (keyed on `skyCellOf(position)`, run in slices from the frame loop).
   - Camera: `new OrbitView(camera, host, 8, limits.maxDist, 52)` (closest 8) becomes closest 2.5; the farthest comes from `zoomOutLimit` + `maxOrbitDistance` each frame (not the fixed `starmapCameraLimits`); camera near 0.2, far = ball radius x 2.2 + 50.
   - Tap: `handleTap` projects every system and picks the nearest within `TAP_RADIUS_PX = 18` (one pass over all stars per tap) becomes `StarGrid.pick` (20 px in the preview); then `focusOn(star, 6 ly)`.
2. **`src/render/starmapradius.ts`.** `starmapRadius(reachLy)` (base 35, cap 75, pad 3) and `starmapCameraLimits` mix reach and picture size. The picture's radius must come from the star spacing (ball radius), and the reach must only decide how many stars become diamonds. Keep `parseReachParam`.
3. **`src/ui/index.ts` glue.** `const reachNow = () => game.state.fuel / Math.max(0.01, tripFuelCost(game.state, 100) / 100)` and the two `api.setReachLy(reachNow())` calls stay as they are, but the map must not size itself from the reach any more (item 2). The preview's AUTO reach is a preview-only convenience; the game passes the ship's real reach.
4. **HUD label.** `refreshHud` (`starLabelText`, `starmapHint`) keeps one label for the selected star and adds a short "5 nearest" line (as the preview does); never a label per star.
5. **`src/render/settings.ts`.** `STARMAP_RADIUS_LY` (35), `STARMAP_MAX_RADIUS_LY` (75), `STARMAP_RADIUS_PAD_LY` (3), `STARFIELD_COUNT` (260), `TAP_RADIUS_PX` (18): replaced or joined by diamond cap, tappable count, near total, zoom limits (names as in `previewmath.ts`).
6. **From Agent 2:** a `GalaxyField` (`sample` + `spacingAt`, in `src/render/galaxy/galaxyfield.ts`, to swap for `densityAt`) and the nearest-N call above. Render stays free of `src/game`, `src/ui` and `src/universe` imports (the layer test checks this), so the glue passes plain arrays in.
7. **Tests:** the existing starmap tests that use `starmapRadius` / `starmapCameraLimits` change with items 1 and 2; the preview's `tests/galaxysky.test.ts` (57 checks) moves along with the shared code.

## The game's own starfield and the sky function (not changed)
`starfieldPositions(count, radius)` in `src/render/helpers.ts` (not a `src/render/starfield` folder) draws 260 random points from a fixed seed (123456789), so **every** system, flight, dock and the map show the same pattern. It is used in `docked.ts`, `flight.ts`, `systemview.ts`, `starmap.ts` and `src/models.ts` (400 points).
- **Step 1, small, no physics:** give it an optional seed argument (default = today's number, so old calls give the same points) and pass a number made from the system's id or position. Each system then has its own pattern (decoration only: neighbouring real systems would look nothing alike, which real stars would not). About 10 lines.
- **Step 2, later, the physics:** replace the points by dots from the sky function for the system's galaxy position (a few thousand dots are enough at 320 x 180: 3,000 dots take about 15 ms, plus the glow at 6.2K squares, about 90 ms, in slices, once per system arrival). Neighbouring systems then look almost the same and the band, bulge and dust lane are in the right place; the pattern changes visibly only after the distances in table 5 (hundreds of ly). That is also what Elite Dangerous does.

## The online-only page pattern (Agent 1's rule: new files only, offline shows the friendly page)
Three small edits, nothing else outside new files: `vite.config.ts` gets the input `galaxymap: "galaxy-map-preview.html"`; `scripts/pwa/lib.mjs` gets `"galaxy-map-preview.html"` in `DEV_PAGES` (so the offline cache list leaves it out and the offline page appears instead); `tests/pwa.test.ts` adds it to the list of pages that must not register the service worker or the manifest. Everything else is under `src/render/galaxy/`, `src/galaxy-map-preview.ts`, `galaxy-map-preview.html`, `tests/galaxysky.test.ts`. The game's map, `src/universe`, `src/game`, `src/save`, `src/ui` are untouched.

## How to check (one minute on the phone)
Open https://lieponis.github.io/Lazy-flight/galaxy-map-preview.html. Press START.
1. Drag one finger around for 10 seconds, then pinch in and out: does the picture feel smooth, and does the zoom stop before the ball of stars shows an edge?
2. Tap 5 different stars: the camera flies to each one; the TAP line and the "5 NEAREST" line show up.
3. Press RIM, then CENTRE: watch SKY BUILDING / SKY BUILT; the old sky stays until the new one swaps in.
4. Read out: your phone model; the SKY BUILT, SKY CELL, FRAME and TAP lines; and "smooth / sometimes choppy / choppy".

## Known issues / not verified
- The real Three.js page, the real shaders in Three and phone speed were **not run here**. The sky shader was checked in headless WebGL2 against the CPU version (max difference 1/255); the frame numbers come from a raw WebGL2 harness, not from the page.
- JS time per frame of the page is unknown (the page measures it).
- The stand-in galaxy, its dust and the looks are tuned by eye, not by astronomy.
- A rebuild shows a small jump when it swaps in (suggestion below).
- Tap rule v2 is tested (57 checks in `tests/galaxysky.test.ts` incl. near beats far on one ray, near slightly off the ray beats far on it, nothing in the circle = nothing, faded loses to visible, grid = check-every-star on 900 rays) but, like all the page, has not run on a phone yet.
- The preview picks the tapped star only from the nearest `tap` stars (1,000 / 10,000 / 20,000).
- AUTO reach by place: centre 55 ly (all 60,000 stars inside, so the diamond cap decides), start 55 ly (about 1,080 diamonds), middle 250 ly (3,102), rim 1,000 ly (1,780). Andy has not yet confirmed that this is the diamonds-at-the-rim he meant.

## Suggestions (not built, not asked for)
- Suggestion: shape the near stars like the galaxy at the rim (a flat disc ending at the edge instead of a ball) so the zoomed-out cluster matches the sky. Needs Andy's yes/no.
- Suggestion: cross-fade the old and new sky when a rebuild finishes.
- Suggestion: build the glow on the GPU (one pass per sky texel in a shader) so a rebuild is a few ms instead of 0.1 to 1.5 s.
- Suggestion: give `starfieldPositions` a per-system seed now (step 1 above); it is cheap and every system gets its own sky.

## Notes for the next agents
- `GalaxyField {sample, spacingAt}` and the `StarProposal` for the dots are the only places the stand-in galaxy is used; swap them for Agent 2's `densityAt`.
- The sky is built from the cell centre, not from the player's exact position (`skycell.ts`); the cell sizes are in that file.
- The sky shader reads its two textures with `texelFetch` (needs WebGL2, which Three 0.170 always uses); there is no WebGL1 fallback.
- `tests/galaxysky.test.ts` runs without Three.js (pure helpers only).
