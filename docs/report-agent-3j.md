# Report: Agent 3, stage G2 (galaxy map prototype: many stars, the sky seen from where you stand, phone speed)

**Not run in my workspace:** `npm run check`, the real Three.js page, a phone (Andy ran the page on his iPhone 17 Air). Proof = green Actions runs (every G2 push was green, 37 to 53 s) + Andy's click-tests on the live page. Offline I ran: a stand-in type check, the 69 checks of `tests/galaxysky.test.ts` in a stand-in runner (real Vitest ran on Actions), the sky shader in headless WebGL2 (it matches the CPU version to 1/255 on every test view), and the timing scripts below in plain Node (cloud V8). **Only the section "Phone check" comes from a phone (Andy's iPhone 17 Air, the real page); every other number is from the cloud machine.**

Live page (online only): https://lieponis.github.io/Lazy-flight/galaxy-map-preview.html

## Verdict: GO (tested on one phone, an iPhone 17 Air; slower phones are untested)
- Everything the CPU has to do is small: nearest 60,000 stars 30 to 41 ms, tap grid 1 to 12 ms (first build), one tap 0.03 to 1.6 ms, "5 nearest" 0.1 to 0.3 ms, instance fill under 1 ms; the sky (glow + 60,000 dots) is about 0.4 to 0.65 s of work at the default size (up to 1.8 s at the largest), done in 6 ms slices per frame and swapped in when finished.
- The drawing is 4 draw calls (sky box, sky dots, near pixels, diamonds), 120,000 points and 8 triangles per diamond. In software rendering here it costs 41 ms with no diamonds and about 0.025 ms per diamond, which says nothing about a phone GPU. **On Andy's iPhone 17 Air the real page ran at 60 fps with JS 0.2 ms per frame, and "never dropped below 60 fps in every setting" including 20,000 diamonds (160,012 triangles) and 120,000 points** (see "Phone check").
- Nothing found that needs a different technique. The sky rebuild took 850 ms on that phone (306 ms of work, worst frame 7.0 ms), faster than my cloud machine. What is still unknown: slower and older phones.

## Built (all on the preview page; the game and its map are not changed)
- **Sky seen from where you stand:** an equal-area ring sphere (no cube), rebuilt only when you leave a sky cell. Two parts: a soft glow (ray-march of a stand-in galaxy density with dust, shaded on the GPU from two small textures) and single-pixel dots (60,000 or 150,000, placed by importance sampling from the same density, brightness squeezed so faint ones show). Dots that share a patch of sky with a real near star are removed.
- **Look C (Andy's pick):** 60,000 dots + faint glow, glow LOW / MEDIUM (default) / HIGH, patchy dust (option 2), no dust within 3,000 ly of the centre, soft haze at the rim.
- **Near stars:** up to 60,000 stars around you, each one a pixel (closer = brighter, fades to nothing at the edge of the ball so there is no visible edge); stars inside the ship's reach are diamonds (one instanced mesh), the same size in space everywhere (about 0.4 to 0.9 ly). **They now take the galaxy's shape** (see "Shaped near stars"): a ball at the centre and the start, a thin flat disc at the rim. A switch NEAR SHAPE: GALAXY DISC / BALL (or `?shape=ball` in the address) shows the old ball for comparison.
- **Reach:** AUTO (the shortest of 55 / 80 / 250 / 1,000 ly that holds at least 200 stars) or one of the four. (Andy confirmed on 2026-11-17: "everything is okay with diamonds".)
- **Camera:** closest zoom 2.5 ly; farthest zoom follows the local star spacing (default NEAR = the distance where a full ball would hold 1,000 stars: 13 / 53 / 172 / 823 ly at centre / start / middle / rim on the page's own seed; the shape does not change it; MEDIUM = twice that; WIDE = 0.9 of the ball); the camera can always back off 12 ly around a tapped star.
- **Tap a star** (nearest 1,000 / 10,000 / 20,000 are tappable): the camera glides to it. Only two text lines exist: the tapped star and its 5 nearest stars. No per-star labels.
- **Counters:** place, near stars, camera, tap grid and last tap, "5 NEAREST", sky building / built, sky cell, frame (ms, fps, JS ms, draw calls, triangles, heap if the browser tells).

## Andy's decisions this stage
Sphere not cube; dots not squares; look C; dust option 2; no dust near the centre; haze at the rim; "rim matches, centre matches"; diamonds same size in space; diamonds at the rim for later ships; zoom out limited AND outer stars faded; tap to fly to a star; rim zoom limit much smaller ("Rim zoom matches"). AUTO reach OK ("everything is okay with diamonds"); centre and start zoom OK; **shape the near stars like the galaxy: yes, keep the thin disc at the rim, do not raise the star count, do not change the rim spacing, keep the rim zoom limit** (built and **checked by Andy on his iPhone 2026-11-17: "Looks right"**, see "Shaped near stars"). Nothing is open for G2 from Andy. His phone numbers for the rest are in "Phone check".

## Numbers (cloud machine, plain Node/V8; the iPhone 17 Air was faster than this machine on every CPU number it measured, see "Phone check"; slower phones may not be)
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

Colour conversion 0.3 to 11 ms; removing dots near real stars 9 to 14 ms (60,000 dots; about 380 to 640 removed). Default (24.6K squares + 60,000 dots) at the start = about 665 ms of work. The page shows the real wall time as SKY BUILT: on the iPhone 17 Air it was 850 ms over 52 frames (glow 139 ms + dots 167 ms of work, worst frame 7.0 ms). On a slower phone it may take seconds, which is fine because the old sky stays; if it is too slow, the 6.2K size (about 90 ms here) is the first thing to try.

**4. Frame cost in software rendering** (headless Chromium, SwiftShader on 2 CPU cores, 320 x 180 picture, a raw WebGL2 harness drawing the same buffers and shaders, **not the real Three.js page**). Software drawing is much slower than a phone GPU, so read these as "the most this could cost" for the GPU part. They say nothing about a phone (see "Phone check" for the real page on a phone).

| what is drawn (centre, reach 80) | frame ms |
|---|---|
| glow only | 2.5 |
| sky dots only (60,000 points) | 17.5 |
| near pixels only (60,000 points) | 21.9 |
| diamonds only: 250 / 500 / 1,000 / 2,000 / 4,000 | 6.7 / 12.5 / 24.9 / 48.3 / 94.4 |
| everything, 0 / 250 / 1,000 / 2,000 / 4,000 diamonds | 41 / 44 / 63 / 87 / 136 |

Full scene at the cases of table 1: 2 ly 2,000 / 10,000 / 20,000 diamonds = 85 / 255 / 418 ms; 8.6 ly 1,085 / 2,000 / 3,404 = 57 / 79 / 101 ms; 30 ly 34 to 93 diamonds = 37 to 42 ms. So on this machine 60 fps is not reachable even with no diamonds (41 ms = 24 fps), and the largest diamond count that fits 16.7 ms with everything else switched off is about 650. Both are software numbers; the real page on a phone is in "Phone check" (JS 0.2 ms per frame).

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

## Shaped near stars (built last, Andy's yes on 2026-11-17)
**What it does.** The ball of 60,000 stars is made exactly as before. Then every star is kept or dropped by chance, in proportion to the galaxy's own shape at the place where the star would be: `discEnvelope(x, y, z) = exp(-1/2 (y / sigma)^2) x edgeTaper(r)`, with `sigma = discThickness(r) / 4` and `edgeTaper` = 1 inside the galaxy edge and `exp(-((r - 50,000) / 3,000)^2)` beyond it. These are the same two functions the sky glow uses (`discSigma`, `edgeTaper` in `galaxyfield.ts`; the glow's code now calls them too), and the dropping has its own random stream. So the result is **always a subset of the old ball**: the same stars with the same colours and sizes, none added, none moved.
**What is unchanged (tested):** the spacing at the middle of the disc, the bubble radius (so edge fade, camera far plane and the sky's start), the AUTO reach at all four places, and the zoom-out limits. The NEAR zoom limit is now read from the full ball (`NearStars.zoomNearLy`), because the 1,000th nearest star of the thin rim disc lies at 1,465 ly, not 823.

| place | spacing (ly) | disc thickness (ly) | stars made (of 60,000) | AUTO reach | **diamonds now** (cap 5,000) | diamonds before (ball) | NEAR zoom limit (unchanged) |
|---|---|---|---|---|---|---|---|
| centre | 2.1 | 1,988 | 59,945 (99.9 %) | 55 ly | **5,000** (59,945 stars are in reach, the cap decides) | 5,000 | 13 ly |
| start | 8.6 | 1,500 | 58,179 (97.0 %) | 55 ly | **1,075** | 1,075 | 53 ly |
| middle | 27.7 | 1,100 | 38,615 (64.4 %) | 250 ly | **2,864** | 3,102 | 172 ly |
| rim | 134.3 | 560 | 4,889 (8.1 %) | 1,000 ly | **480** | 1,780 | 823 ly |

(Cloud machine, the page's own seed. The page shows the same counts in its NEAR STARS line, which now also says "of 60,000 in a full ball" and the disc thickness at your spot.) Making the stars costs 24 to 60 ms here (rim 24, start 49, centre 60); the rim has 12 times fewer points to draw than before.
**How flat is the rim:** the stars spread about 140 ly up and down (1 sigma) and about 1,600 ly sideways, so 11 times wider than tall. Centre and start stay round (up-down spread divided by sideways spread: 1.05 at the centre, 0.98 at the start). Picture, made from the real code: `shape_side_view.png` (sent to Andy, not stored in the repo).
**What Andy should know (honest):**
- **The galaxy's edge is soft.** The sky's own edge fade is a bell curve 3,000 ly wide, so at the farthest point of the rim cluster (1,261 ly past the edge) the stars are only thinned to 84 %. About 12 % of the rim stars lie past the edge line and the flat disc does not visibly stop there. It matches the sky's soft edge, which is what Andy asked ("same edge fade as the galaxy sky"). A visibly sharper end needs a smaller number in `edgeTaper` for the sky AND the stars (one place), but it would change the glow he approved, so I did not do it (suggestion below).
- **Rim diamonds drop from 1,780 to 480.** That is what a thin disc holds in a 1,000 ly reach. Andy chose to keep it.
- The page seed gives a rim NEAR limit of **823 ly**; the 829 in the status file is what the tests' own seed (5) gives, and an earlier line of this report said 822 (an older measurement); 823 is what the current code gives on the page's seed, with and without the shape.
- Rim spacing still varies with the distance from the centre across a 3,000 ly cluster (103 to 134 ly) but the cluster uses one spacing (134); same as before the change.
**Tests (12 new, 69 in the file):** the shape is the sky's shape (same sigma, same edge, nothing above 6 sigma, the sky field agrees there); no shape = the old ball exactly; keep 1 = identical ball, keep 0 = none and the bubble stays; a half-space keeps half and only that side; shaped stars are a subset of the ball with the same colours and sizes, nearest first; same seed = same stars; the four places (share kept, how flat); the disc is the galaxy's disc, not a slab around you (standing 500 ly above it, the stars all lie about 500 ly below you); zoom limits equal the old ones at all four places; `zoomOutLimit` with a ball distance; the diamond counts above; `?shape=` in the address.
**Phone check of the shaped stars (Andy, iPhone 17 Air, the real page, 2026-11-17):** at RIM the NEAR STARS line read "4,889 of 60,000 in a full ball" (my offline count was 4,889, so the stand-in runner and the real page agree), diamonds 480 (offline 480), the rim stars form a flat band when zoomed out and looked at along the disc ("Yes"), the zoom stops at the limit ("Yes"), BALL shows 60,000 stars, and his verdict on the picture: **"Looks right"**. FRAME: his first reading was **33.4 ms (30 fps)**; that was **iPhone Low Power Mode** (33.4 ms is exactly two screen refreshes). With Low Power Mode switched off he reports **60 fps** (he gave no full FRAME line, so there is no JS ms, draw-call or triangle count for the shaped page and no per-place reading). The shaped sets also have fewer points (rim 4,889 instead of 60,000).
**Not run in my workspace:** the real page with the shape (Actions green; offline only the stand-in runner and the side-view picture); Andy's phone check above is the real-page proof.

## Phone check (Andy, iPhone 17 Air, the real page, 2026-11-17)
Source: Andy's screenshot of the page's counter text (START, reach AUTO = 55 ly, 1,075 diamonds, tap grid of 10,000 stars) and his words for the stress test.

| | iPhone 17 Air | cloud machine |
|---|---|---|
| 60,000 near stars made | 27 ms | 35 ms |
| tap grid of 10,000 stars | 1.0 ms | 3.6 ms (first build) |
| one tap, last / worst | 1.00 ms / 4.00 ms (Safari rounds timers to whole ms) | 0.05 to 0.10 ms average, up to 1.0 ms |
| "5 nearest" | 1.00 ms (same rounding) | 0.05 ms |
| sky build, CPU work (glow 24,592 squares + 59,400 dots) | 306 ms (139 + 167), colours 4.0 ms, 600 dots removed in 9.0 ms | about 650 ms |
| sky build, wall time | 850 ms over 52 frames, worst frame 7.0 ms (budget 6 ms) | not measured |
| frame | 16.7 ms = 60 fps, JS 0.2 ms | software drawing 41 ms |
| draw calls / triangles | 4 / 8,620 (1,075 diamonds + the tapped one) | 4 / 8,692 |

- **Stress test (Andy):** START, ship reach 1,000 ly (so the diamond cap alone decides), diamond cap 2,000 / 5,000 / 10,000 / 20,000 (up to 160,012 triangles and 120,000 points). His words: "It never drops below 60 fps in every setting." I do not have the per-cap FRAME lines.
- **How far to trust it:** one phone with a new, fast chip. 60 fps may be the screen's refresh limit, so this shows no dropped frames, not how much room is left; the page's largest settings (20,000 diamonds) are the most it can ask. Older and low-end phones are untested. Safari rounds timers, so single tap times are only good to about 1 ms.

## Formulas (shader and code are the same; `src/render/galaxy/previewmath.ts`)
- **Pixel brightness:** `x = clamp(d / R, 0, 1)`; `b = (1 - 0.82 * x^0.6) * edgeFade(d, R)`; `d` = distance from the player in ly, `R` = radius of the near-star ball. Pixel size: 2 px if `d < 0.22 R`, else 1 px.
- **Edge fade:** `t = clamp((x - 0.7) / 0.3, 0, 1)`; `edgeFade = 1 - t^2 (3 - 2t)` (1 inside 70 % of the ball, 0 at the edge). Diamond colours use the same fade.
- **Ball radius:** `R = spacing * cbrt(3 N / (4 pi))` for N = 60,000 stars: 50 / 209 / 673 / 3,261 ly at centre / start / middle / rim.
- **Diamond size (ly across):** `0.6 * (0.55 + 0.3 * clamp(starSizeClass, 0.5, 3))`, the same in space everywhere.
- **Auto reach:** the first of 55, 80, 250, 1,000 ly whose ball holds at least 200 stars (else 1,000).
- **Zoom-out limit (distance from the player):** NEAR = min(0.9 R, `zoomNearLy`), `zoomNearLy` = the distance where a full, un-thinned ball of stars holds 1,000 stars (for a plain ball: the distance of the 1,000th nearest star, as before); MEDIUM = min(0.9 R, 2 x that); WIDE = 0.9 R. The camera distance is also limited so the camera itself never leaves that sphere (`maxOrbitDistance`), but can always go 12 ly around the target.
- **Shape of the near stars:** a star at galaxy position (x, y, z) is kept with probability `discEnvelope = exp(-1/2 (y / sigma)^2) x edgeTaper(r)`, `r = hypot(x, z)`, `sigma = discThickness(r) / 4`, `edgeTaper(r) = 1` for `r <= 50,000`, else `exp(-((r - 50,000) / 3,000)^2)`; no star is kept above 6 sigma. The same `sigma` and `edgeTaper` are in the sky glow.
- **Tap (rule v2, 2026-11-17):** a ray from the finger through the grid, steps of 0.9 grid cell; the stars inside the tap circle (20 css px) are the candidates. Stars too faint to see (visibility below 0.15: `tapVisibility` = the brightness the picture draws them with) only count when no visible star is in the circle. The nearest candidate to the camera wins; candidates up to 1.25 times that distance compete on closeness to the finger (`SAME_DEPTH_RATIO`; 1 = plain nearest).
  - Old rule (v1, replaced): the closest star to the ray won, with a depth bonus worth at most 15 % of the tap radius: `angle + 0.15 x tolerance x (distance / farthest distance)`. A far star exactly on the ray beat a near star only 3 px off it (Andy's bug).

## How much is physics and how much is noise
- **Physics-like (one density function, the same for every viewer):** the band, the bulge, the arms and the dust lane as seen from your position (glow = a real ray-march: dimming by dust per colour channel, near stars cut out); where dots are likely (placement is importance-sampled from the same density: denser toward the band and centre); and the way all of it changes slowly with distance (table 5).
- **Hash noise:** the exact position and brightness of every dot (hash of the sky cell + a counter), the shapes of the dust lumps and the 150 ly sway of the lane, and the cloudiness of the stand-in density.
- **Not physics at all:** squeezing dot brightness (light^0.5) so faint dots show; the glow curve; the edge fade of the near ball.
- **So:** the large pattern ("which way is the centre, where is the band, is the sky dark here") is real to the model; every single dot is noise. The model itself is my invention (not Agent 2's), so it is only as true as `densityAt` will be.

## Caps for phones (proposal; one phone tested)
- **Diamonds:** default cap **5,000** (40,000 triangles); maximum **20,000** (held 60 fps on the iPhone 17 Air; untested on slower phones). With AUTO reach and the galaxy shape the preview needs: centre 5,000 (the cap decides), start 1,075 (55 ly), middle 2,864 (250 ly), rim 480 (1,000 ly); a long reach at the start (250 ly = 58,000 stars) also fills the cap.
- **Tappable:** **10,000** (grid build about 4 ms, tap well under 2 ms). 20,000 and 60,000 also cost almost nothing, but only the nearest are useful to tap.
- **Near pixels:** up to 60,000 (the iPhone held 60 fps with 120,000 points; with the galaxy shape the middle has 38,615 and the rim only 4,889, so the rim is much lighter). Only if a slower phone struggles, 30,000 is the first lever.
- **Sky:** 60,000 dots and the 64 size (24.6K squares) (850 ms on the iPhone); 32 (6.2K squares) if rebuilds feel too slow on a slower phone.
- Suggestion (not built): a frame-time guard that lowers the diamond cap one step when frames take longer than about 25 ms for 2 seconds, so a slow phone protects itself.
- The page buttons let anyone try 2,000 / 5,000 / 10,000 / 20,000; ask the next tester of an older phone for the FRAME line at 20,000.

## What must change in the real map code (when the real generator arrives)
1. **`src/render/starmap.ts` (`StarMapScreen`).**
   - Data: `listSystemsNear(seed, origin, radius)` (everything inside a radius, full system objects) becomes a "nearest N stars, nearest first" call from Agent 2 that returns only id, x, y, z, colour, size class (N = 60,000; made once per position). Agent 2's real generator already has the galaxy's shape in its density, so the preview's thinning (`NearShape.keep`) is not needed there; what the map needs from it is only that the nearest-N stars follow the density (thin disc at the rim) and that the map takes the NEAR zoom limit from the spacing (`zoomNearLy` = the distance of a full ball of 1,000 stars), not from the 1,000th nearest star.
   - Drawing: the single octahedron `InstancedMesh` (size per star, `starmapStarSize`) becomes `NearLayers` (`src/render/galaxy/nearlayers.ts`): diamonds inside the reach (cap), a pixel for every star, same-size diamonds.
   - Backdrop: `starfieldPositions(STARFIELD_COUNT = 260, backdropRadius)` Points become `SkyView` + `SkyBuilder` / `DotsBuilder` (keyed on `skyCellOf(position)`, run in slices from the frame loop).
   - Camera: `new OrbitView(camera, host, 8, limits.maxDist, 52)` (closest 8) becomes closest 2.5; the farthest comes from `zoomOutLimit` + `maxOrbitDistance` each frame (not the fixed `starmapCameraLimits`); camera near 0.2, far = ball radius x 2.2 + 50.
   - Tap: `handleTap` projects every system and picks the nearest within `TAP_RADIUS_PX = 18` (one pass over all stars per tap) becomes `StarGrid.pick` (20 px in the preview); then `focusOn(star, 6 ly)`.
2. **`src/render/starmapradius.ts`.** `starmapRadius(reachLy)` (base 35, cap 75, pad 3) and `starmapCameraLimits` mix reach and picture size. The picture's radius must come from the star spacing (ball radius), and the reach must only decide how many stars become diamonds. Keep `parseReachParam`.
3. **`src/ui/index.ts` glue.** `const reachNow = () => game.state.fuel / Math.max(0.01, tripFuelCost(game.state, 100) / 100)` and the two `api.setReachLy(reachNow())` calls stay as they are, but the map must not size itself from the reach any more (item 2). The preview's AUTO reach is a preview-only convenience; the game passes the ship's real reach.
4. **HUD label.** `refreshHud` (`starLabelText`, `starmapHint`) keeps one label for the selected star and adds a short "5 nearest" line (as the preview does); never a label per star.
5. **`src/render/settings.ts`.** `STARMAP_RADIUS_LY` (35), `STARMAP_MAX_RADIUS_LY` (75), `STARMAP_RADIUS_PAD_LY` (3), `STARFIELD_COUNT` (260), `TAP_RADIUS_PX` (18): replaced or joined by diamond cap, tappable count, near total, zoom limits (names as in `previewmath.ts`).
6. **From Agent 2:** a `GalaxyField` (`sample` + `spacingAt`, in `src/render/galaxy/galaxyfield.ts`, to swap for `densityAt`) and the nearest-N call above. Render stays free of `src/game`, `src/ui` and `src/universe` imports (the layer test checks this), so the glue passes plain arrays in.
7. **Tests:** the existing starmap tests that use `starmapRadius` / `starmapCameraLimits` change with items 1 and 2; the preview's `tests/galaxysky.test.ts` (69 checks) moves along with the shared code.

## The game's own starfield and the sky function (not changed)
`starfieldPositions(count, radius)` in `src/render/helpers.ts` (not a `src/render/starfield` folder) draws 260 random points from a fixed seed (123456789), so **every** system, flight, dock and the map show the same pattern. It is used in `docked.ts`, `flight.ts`, `systemview.ts`, `starmap.ts` and `src/models.ts` (400 points).
- **Step 1, small, no physics:** give it an optional seed argument (default = today's number, so old calls give the same points) and pass a number made from the system's id or position. Each system then has its own pattern (decoration only: neighbouring real systems would look nothing alike, which real stars would not). About 10 lines.
- **Step 2, later, the physics:** replace the points by dots from the sky function for the system's galaxy position (a few thousand dots are enough at 320 x 180: 3,000 dots take about 15 ms, plus the glow at 6.2K squares, about 90 ms, in slices, once per system arrival). Neighbouring systems then look almost the same and the band, bulge and dust lane are in the right place; the pattern changes visibly only after the distances in table 5 (hundreds of ly). That is also what Elite Dangerous does.

## The online-only page pattern (Agent 1's rule: new files only, offline shows the friendly page)
Three small edits, nothing else outside new files: `vite.config.ts` gets the input `galaxymap: "galaxy-map-preview.html"`; `scripts/pwa/lib.mjs` gets `"galaxy-map-preview.html"` in `DEV_PAGES` (so the offline cache list leaves it out and the offline page appears instead); `tests/pwa.test.ts` adds it to the list of pages that must not register the service worker or the manifest. Everything else is under `src/render/galaxy/`, `src/galaxy-map-preview.ts`, `galaxy-map-preview.html`, `tests/galaxysky.test.ts`. The game's map, `src/universe`, `src/game`, `src/save`, `src/ui` are untouched.

## How to check (one minute on the phone)
Open https://lieponis.github.io/Lazy-flight/galaxy-map-preview.html. Press START.
0. NEAR SHAPE: GALAXY DISC is the new default; press BALL to see the old ball and GALAXY DISC again; at RIM look along the disc (LOOK: TOWARD CENTRE) and zoom out to the limit.
1. Drag one finger around for 10 seconds, then pinch in and out: does the picture feel smooth, and does the zoom stop before the ball of stars shows an edge?
2. Tap 5 different stars: the camera flies to each one; the TAP line and the "5 NEAREST" line show up.
3. Press RIM, then CENTRE: watch SKY BUILDING / SKY BUILT; the old sky stays until the new one swaps in.
4. Read out: your phone model; the SKY BUILT, SKY CELL, FRAME and TAP lines; and "smooth / sometimes choppy / choppy". Switch Low Power Mode off first (it showed 30 fps on Andy's phone).

## Known issues / not verified
- The real Three.js page and its shaders were **not run in my workspace** (Andy ran them on his iPhone). The sky shader was checked in headless WebGL2 against the CPU version (max difference 1/255); the cloud frame numbers come from a raw WebGL2 harness, not from the page. Only one phone has been measured.
- JS time per frame: 0.2 ms on the iPhone 17 Air; not measured elsewhere.
- The stand-in galaxy, its dust and the looks are tuned by eye, not by astronomy.
- A rebuild shows a small jump when it swaps in (suggestion below).
- Tap rule v2 is tested (69 checks in `tests/galaxysky.test.ts`, 12 of them for the shaped stars, incl. near beats far on one ray, near slightly off the ray beats far on it, nothing in the circle = nothing, faded loses to visible, grid = check-every-star on 900 rays) and **Andy re-tested it on his phone on 2026-11-17: "Correct"** (the nearer star is picked). The phone numbers for the rest of the page are in "Phone check".
- The preview picks the tapped star only from the nearest `tap` stars (1,000 / 10,000 / 20,000).
- AUTO reach by place (Andy confirmed): centre 55 ly (the diamond cap decides: 5,000), start 55 ly (1,075 diamonds), middle 250 ly (2,864 with the galaxy shape; 3,102 as a ball), rim 1,000 ly (480 with the shape; 1,780 as a ball). The rim has fewer diamonds because the disc is thin: see "Shaped near stars".
- The galaxy's edge is soft in the sky and therefore also in the near stars (see "Shaped near stars"); the shaped cluster does not visibly stop at the edge.
- The shaped stars were checked on one phone only (Andy's iPhone 17 Air): 60 fps with Low Power Mode off (33.4 ms / 30 fps with it on); the full FRAME line for the shaped page was not sent.
- **Low Power Mode makes the FRAME line read 30 fps.** Anyone timing the page on an iPhone must switch it off first (Settings, Battery), or the number says nothing about the page.

## Suggestions (not built, not asked for)
- Suggestion: a visibly sharper galaxy edge: make the edge fade narrower than 3,000 ly in `edgeTaper` (one number, used by the sky glow AND the near stars). It changes the rim glow Andy approved, so it needs his yes/no and a look at the sky first.
- Suggestion: let the star spacing change across the rim cluster (103 ly on the inner side, 134 ly at the player, about 180 ly on the outer side) instead of one spacing. Small, costs nothing, makes the disc slightly sparser toward the edge.
- Suggestion: cross-fade the old and new sky when a rebuild finishes.
- Suggestion: build the glow on the GPU (one pass per sky texel in a shader) so a rebuild is a few ms instead of 0.1 to 1.5 s.
- Suggestion: give `starfieldPositions` a per-system seed now (step 1 above); it is cheap and every system gets its own sky.

## Notes for the next agents
- `GalaxyField {sample, spacingAt}` and the `StarProposal` for the dots are the only places the stand-in galaxy is used; swap them for Agent 2's `densityAt`.
- The sky is built from the cell centre, not from the player's exact position (`skycell.ts`); the cell sizes are in that file.
- The sky shader reads its two textures with `texelFetch` (needs WebGL2, which Three 0.170 always uses); there is no WebGL1 fallback.
- `tests/galaxysky.test.ts` runs without Three.js (pure helpers only).
- `makeNearStars(count, spacing, seed, shape?)` takes an optional `NearShape {origin, keep(x, y, z)}`; `NearStars` has two new fields, `ballCount` and `zoomNearLy`, and `radius` is the ball's radius even when the shape leaves no star near the edge. A real generator that already follows the galaxy density needs no `shape`, but must supply `zoomNearLy` (the distance of a full ball of 1,000 stars at the local spacing) for the NEAR zoom limit.
- Seed note: the preview seeds the stars with the spacing (`round(spacing x 100) + 7`), not the position, so the pattern is the same at every place with that spacing. That is a stand-in shortcut; the real generator makes the stars from the position.
