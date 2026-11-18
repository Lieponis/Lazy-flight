# Report: Agent 3, stage G5a (the real galaxy map, the sky from where you stand, a sky per system)

Branch: `universe-v3` only (nothing went to main). Last commit when this was written: `9b8051d`. Status of this report: **v1. Everything that can be measured without a phone is in. The iPhone FRAME numbers (section 4) are PENDING: they need Andy's phone on the preview page.**

**What I could NOT do in my workspace:** open the page in a real browser (no WebGL, no network for the shell). The map, the sky and the new dots have never been seen by me on a screen. Proof so far = the real GitHub Actions runs (every push green: `tsc --noEmit`, build, **51 test files, 1,127 tests**; plus the game-layer check) and numbers measured in plain Node on the cloud machine. Andy's checks in section 8 are the real proof.

Live preview (the Lead's `/Lazy-flight/preview/`, rebuilt from this branch twice an hour): https://lieponis.github.io/Lazy-flight/preview/ . Test pages on it: `planets.html`, `models.html`, `galaxy-map-preview.html`, `?namepreview=1`, `?floatpreview=1`, `?systempreview=1`, `?mapstats=1`, `?mapat=centre|start|middle|rim`.

## 1. What was built

| Step | Result |
|---|---|
| 1 compile fix | Every `listSystemsNear` gone; system ids are numbers, planet/dock ids `"<n>/<i>"` text; `planets.ts` and `models.ts` use `nearestSystems(seed, START_POINT, 40)`. |
| 2 real galaxy map | Nearest **60,000** stars as pixels (closer = brighter, fade at the edge of the ball); **diamonds** for stars inside the ship's reach (cap **5,000**); the nearest **10,000** are tappable (tap rule v2: nearest star inside 20 CSS px); closest zoom 2.5 ly, farthest from the local spacing (`spacing x 6.2035`, so 829 ly at the rim); tap flies to the star; one label (name, type, distance) plus the "5 nearest: 1.2, 3.5, 10.0, 10, 134 ly" line; thin-disc shape of the near stars (from the G2 shaping step, ported); the universe is asked **once per move** (the glue keeps the last 2 answers) and never per frame. `?reach=NUMBER` still works: it only changes which stars get a diamond (max 1000). |
| 3 sky from where you stand | Glow (size 64 faces) plus 60,000 dots, built from the **real universe's** `densityAt` / `thicknessAt` / `spacingAt` / `armFactor`, handed over as plain functions (`src/mapsource.ts`); the render layer imports no universe code for this. Rebuilt only when you enter another sky cell, **6 ms per frame**, the old sky stays until the new one is ready (the plain backdrop dots show only until the first sky is done). Sky cells in the thin disc are as tall as a third of the disc and centred on the plane (see 3 in "Decisions"). |
| 4 sky per system | `starfieldPositions(count, radius, seed?)`: no seed = exactly today's dots (frozen numbers + a copy of the old function in `tests/starfield.test.ts`). `systemSkySeed(systemId)` makes the number from the system number (both halves, ids above 2^32 included). System view, docked, flight (a trip: the system the ship is heading for; floating: the planet's system) and the models page (`?system=NUMBER`) give each system its own pattern. New `src/render/backdrop.ts` keeps one dots object per screen and re-patterns it in place. Only a seed line was added to `flight.ts` (no new `launchSeconds:` / `this.phases = `). |
| 5 names | Limits updated to 29 / 34 / 62. Worst cases made from what the generator can make: `Snugaploo Junction HH8H3-2526` (29), `... VIII` (34), `Gleaming Marmalade Station, ... VIII` (62; "Gleaming Marmalade Station" is the longest dock name the word lists make). The real start names (`Bimvik Deep JR62R-MT37`, `Bimvik Deep JR62R-MT37 III`, `Breezy Hill Outpost, Bimvik Deep JR62R-MT37 III`) are in `?namepreview=1` and checked against the universe by a test. The old 42/47/73 names stay as STRESS names. See section 5 for the fit numbers. |
| 6 centre / rim | `?mapat=centre|start|middle|rim` (or `x,y,z` in ly) shows the map and its sky from that place without moving the ship. Measured numbers in section 3. `/galaxy-map-preview.html` **stays** as a developer page (online only, stand-in galaxy, not the real map). `?namepreview=1`, `?floatpreview=1`, `?systempreview=1` build and their code paths are unchanged (CI build + tests). |
| 7 phone speed | **PENDING** (section 4). Fallbacks are in place and listed there. |
| 8 tests | All render tests fixed (the 4 files that called `listSystemsNear` and the `planetlook` fingerprint). No new `launchSeconds:` / `this.phases = ` literals. |
| Lead's extra step | **Preview isolation** (done first, commit `b3cd489`): see section 7. |

## 2. Glue lines touched (outside `src/render`)

`src/main.ts` (all four lines):
- line 1: `import { IS_PREVIEW } from './previewboot';` (must stay the first import; see section 7)
- `import { makeMapSource } from './mapsource';`
- `startRender(renderer, app, { seed: start.plan.seed, mapSource: makeMapSource });`
- `if (!IS_PREVIEW) startOfflineApp(...)` (the preview never registers the offline helper, see section 7)

`src/ui/index.ts` (Agent 5's file, two lines):
- `const reachNow = (): number => game.getPlaceInfo().rangeLy;` (plus a 3-line comment above it)
- the comment on `api.setReachLy(reachNow()); // and its diamonds follow the ship and engines` inside `game.subscribe`.

New glue files: `src/mapsource.ts` (96 lines: `makeMapSource(seed)`; the ONLY place the map touches universe code: `nearestSites`, `generateSystem`, `getSystem`, `densityAt`, `thicknessAt`, `spacingAt`, `armFactor`), `src/previewboot.ts`, `src/previewstorage.ts`. First line of the six developer page entries (`debug`, `game-debug`, `models`, `planets`, `galaxy-debug`, `galaxy-map-preview`): `import "./previewboot";` (and `main.ts`, see above). `src/models.ts` also got `?system=NUMBER`.

## 3. Map numbers (cloud machine, plain Node, real universe; NOT a phone)

| Place | Stars | Nearest star | Ball radius | Lookup (cold) | Diamonds at 35 ly (in reach) / at 100 ly | Tappable | Sky cell | Glow work | Dots work | Dots kept |
|---|---|---|---|---|---|---|---|---|---|---|
| Dense centre (r 400 ly) | 60,000 | 0.7 ly | 45 ly | 238 ms | **5,000** (27,529) / 5,000 (60,000) | 10,000 | 60 ly | 460 ms in 76 frames | 704 ms in 112 frames | 59,500 |
| Start (r 16,700) | 60,000 | 3.0 ly | 195 ly | 196 ms | 347 / 5,000 (8,027) | 10,000 | 960 ly | 906 ms in 147 frames | 887 ms in 138 frames | 59,671 |
| Middle (r 30,000) | 60,000 | 26.6 ly | 1,461 ly | 595 ms | 2 / 53 | 10,000 | 960 ly | 269 ms in 45 frames | 733 ms in 117 frames | 59,235 |
| Rim (r 48,000) | 60,000 | 47.5 ly | 9,920 ly | 390 ms | 0 / 4 | 10,000 | 1,920 ly | 57 ms in 10 frames | 752 ms in 120 frames | 54,066 |

- Setup of the tap grid: 0 to 4 ms. Worst single sky slice 6.4 to 7.5 ms (budget 6 ms).
- At the dense centre the caps hold (5,000 diamonds of 27,529 in reach, 10,000 tappable); the zoom-out limit there is only 12 ly because the stars are 1.8 ly apart.
- The rim has diamonds only for ships with a long reach (0 at 35 ly): the map is never empty or broken because the 60,000 pixels are always there, but with the starting ship almost nothing is in reach out there (that is the universe, not the map).
- The sky is built from the **real universe, a thin flat disc**. It has **no central bulge**, so the sky is a thin band; the old stand-in had a bulge. Comparison pictures (old vs new at the four places) were sent to Andy; he has not decided yet whether he wants a bulge added (my suggestion below, not what the universe has).

## 4. FRAME numbers on Andy's iPhone (start, middle and rim measured; the dense centre is PENDING)

How: open the preview, go to the Starmap, add `?mapstats=1` to the address together with `?mapat=...` (for example `.../preview/?mapstats=1&mapat=centre`). The block shows MAP / STAR LOOKUP / SKY / FRAME lines. The four places: `mapat=centre`, `start`, `middle`, `rim`.

| Place | FRAME ms (average) | JS ms | Draw calls | Triangles | Sky built in | Verdict |
|---|---|---|---|---|---|---|
| centre | pending (Andy has seen the centre; his numbers screenshot is still to come) | pending | pending | pending | pending | pending |
| start | **16.6 (60 fps)** | 0.0 (the iPhone's timer is too coarse to show less than 1 ms) | 5 | 1,884 | 2,033 ms wall = glow 370 + dots 375 ms of work spread over 123 frames, worst slice 7.0 ms | fast, no fallback needed |
| middle | **16.6 (60 fps)** | 0.1 | 5 | 28 | 1,325 ms wall = glow 103 + dots 374 ms of work over 81 frames, worst slice 6.0 ms | fast, no fallback needed |
| rim | **16.6 (60 fps)** | 0.2 | 6 | 20 | 1,072 ms wall = glow 25 + dots 367 ms of work over 66 frames, worst slice 7.0 ms | fast, no fallback needed |

Start, as shown on the iPhone (screenshot from Andy): stars 60,000, diamonds 233, tappable 10,000, ball radius 195 ly, zoom-out limit 50 ly, **STAR LOOKUP 125 ms (once per move)**, sky 24,592 glow squares and 59,553 dots, sky cell 960 ly. The iPhone is about 2.4 times faster than my cloud machine for the sky work (glow 906 to 370 ms, dots 887 to 375 ms) and 1.6 times faster for the star lookup (196 to 125 ms), so the cloud numbers in section 3 are an upper bound for this phone. The zoom-out limit of 50 ly (not the whole 195 ly ball) is by design: the farthest zoom shows a ball of about 3,000 stars, from the local star spacing (8 ly at the start), as in the G2 preview.

Middle (`?mapat=middle`): stars 60,000, diamonds 1, tappable 10,000, ball radius 1,461 ly, zoom-out limit 165 ly, STAR LOOKUP 201 ms, 24,592 glow squares, 59,235 dots, sky cell 960 ly. Rim (`?mapat=rim`): stars 60,000, diamonds 0, tappable 10,000, ball radius 9,920 ly, zoom-out limit 829 ly, STAR LOOKUP 186 ms, 24,592 glow squares, 54,066 dots, sky cell 1,920 ly. All numbers are from Andy's iPhone screenshots and match my cloud-machine measurements for the same place (ball radius, dots kept, cell size), so the two machines saw the same data.

Fallbacks if a number is slow (all are one-line settings in `src/render/settings.ts`): `MAP_NEAR_STARS` 60,000 to 30,000 (halves the pixels and the lookup), `MAP_SKY_SIZE` 64 to 32 (a quarter of the glow work), `MAP_DIAMOND_CAP` 5,000 to fewer, `MAP_SKY_DOTS` 60,000 to fewer.

## 5. Name fit (step 5)

Layout numbers from the real layout code (`layoutInfo`, monospace font), big cockpit picture 192 x 160 and small 96 x 112:

| Name | Big: text size / lines / shortened | Small: text size / lines / shortened |
|---|---|---|
| Start system `Bimvik Deep JR62R-MT37` | 27 / 2 / no | 19 / 2 / no |
| Start planet `... III` | 27 / 2 / no | 15 / 2 / no |
| Start dock `Breezy Hill Outpost, ... III` | 23 / 3 / no | 14 / 4 / no |
| Worst system (29) | 24 / 2 / no | 16 / 3 / no |
| Worst planet (34) | 24 / 2 / no | 14 / 3 / no |
| Worst dock (62) | 22 / 3 / **yes** (`STATION, SNUGAPLOO / JUN... HH8H3-2526 VIII`, code and number kept) | 12 / 4 / no |
| Stress dock (73, longer than allowed) | 22 / 3 / yes | 11 / 5 / no |

Everything fits (`fits: true`, no row wider than the picture, code whole, never smaller than 11 units, every tour caption). **Not verified by me:** the flat HUD (`hud.css`), the menus (Agent 5's `src/ui/logic.ts` has its own copy of the rules) and the planets wall on a real screen; the map label uses the same `nm-code` spans and `white-space: pre-line` as before. Andy's look at `?namepreview=1` and `/planets.html` covers it.

## 6. Decisions I took (for the Lead to confirm or change)

1. **Reach for diamonds = `getPlaceInfo().rangeLy`** (a FULL tank), not `fuelRangeLy` (the fuel on board now). Reason: the diamonds do not flicker while fuel burns and the map redraws only when the ship or engines change. One line to change in `src/ui/index.ts`.
2. **The "5 nearest" line shows distances only** (no names): the other stars' names would need a universe call per neighbour.
3. **Sky cells in the thin disc are centred on the plane and a third of the disc tall** (`skyCellOf(pos, verticalSize)`, new optional argument; the default for the old prototype is unchanged). Reason: the grid cube cells built the sky from up to 480 ly above the plane at the start and 1,920 ly at the rim, where the disc is only 500 ly thick, and the picture showed a visible dome edge. The "one cell, one key, one seed" rule is tested.
4. **No central bulge in the sky** (the universe has none). Kept the parts the universe does not have (cloud lumpiness, dust lanes, young blue stars in the arms) as in G2, with the arm numbers copied into render and **guarded by a test against the real `armFactor`** (if Agent 2 ever changes them, the test fails).
5. **`?mapat=`** was added because the real game cannot teleport and Andy's check needs the centre and the rim.
6. **The preview never registers the offline helper** (section 7).
7. **Smaller diamonds in a crowd** (Andy, after seeing the dense centre: "reduce the size of the diamonds near the centre, as it is covering everything"). A diamond is now at most **a tenth of the typical gap between neighbouring stars** (`DIAMOND_MAX_SPACING_SHARE` 0.1, floor `DIAMOND_MIN_SIZE` 0.08 ly, both in `previewmath.ts`; the gap comes from the universe's `spacingAt` through the map list). At the centre (gap 1.8 ly) a diamond is about **0.18 ly instead of 0.5 to 0.9 ly** (3 to 5 times smaller). Start (gap 8 ly): normal stars unchanged, only the very biggest stars' diamonds are about 8% smaller. Middle and rim: unchanged. The G2 preview page passes no gap, so it is unchanged. If it is still too big or too small: change the 0.1.

## 7. Preview isolation (the Lead's extra step)

- `src/previewboot.ts` is the very first import of `src/main.ts` and of every developer page entry. With `VITE_PREVIEW=1` (read as `import.meta.env.VITE_PREVIEW === "1"`) it replaces `window.localStorage` by a wrapper that puts `preview-v3:` in front of every key (`getItem`, `setItem`, `removeItem`, `key`, `length`, `clear` only for prefixed keys; the live game's keys are invisible and untouched). If the storage cannot be replaced the page **stops with an error** (safer than sharing the live save). Without the flag nothing changes.
- A small magenta **PREVIEW** tag is on every page of the preview, so also on the title screen.
- Tests: `tests/previewstorage.test.ts` (16 checks, including that every html page's entry file has the import as its first line).
- **One more thing the isolation needed, which the Lead did not ask for:** the offline helper (service worker) names its stored copies `lazy-flight-<version>` and deletes any other copy with that prefix. A preview helper would have deleted the live game's stored copy (or the other way round). So `main.ts` does not register the helper in the preview (`if (!IS_PREVIEW)`). I also read the live helper's code: it only handles its own scope page and its listed files, anything else (including `/preview/` pages) is network only. That is read from the code, not tried on a phone.
- Not covered by the wrapper: `sessionStorage`, cookies and IndexedDB (the game uses none of them, checked with a search of `src`).

## 8. Andy's checks (what to do, in order)

1. Open `.../preview/planets.html`: the planet looks draw (looks changed because the planet ids changed).
2. Open `.../preview/`, play to the Starmap. Look for: stars as pixels, diamonds around the start, a tap picks the nearest star and flies to it, the label with the "5 nearest" line, the sky behind the stars after a few seconds. Then `?mapat=centre` and `?mapat=rim` (add `&mapstats=1` for the numbers).
3. Fly or float in two different systems: the background dots differ.

## 9. What was left to Agent 5

- Nothing blocking. The map's HUD buttons ("Open system") and the label are mine, unchanged in meaning; the navigation buttons that open the Starmap are Agent 5's.
- The map has no legend for the diamond ("a diamond = the ship can reach it"): see suggestions.

## 10. Test status

- Real CI on `universe-v3` (last run at commit `1dcf237`): **Check a branch: green** (`tsc --noEmit`, build, 51 files, 1,127 tests); **Check the game layer: green**.
- New or changed test files: `galaxymap` (36 checks: pure helpers, the real universe at the four places, arm numbers guarded, thin-disc sky cells, diamond size in a crowd), `starmapradius` (6), `starfield` (10), `backdrop` (5, real three.js), `previewstorage` (16), `namefit` (v3 names), and the early render fixes (`earthlike`, `floatpick`, `planetlook`, `title`).
- Run offline by me: a stand-in type check (only known stand-in noise: no `three` types, no `import.meta.env`) and the pure tests in a stand-in runner. CI is the real proof.

## 11. Known issues

1. Never seen by me on a real screen (section top). The look of the sky differs from the approved G2 look (no bulge, thin band, empty rim); pictures were sent.
2. The star lookup is one synchronous call to the universe: 0.2 to 0.6 s on the cloud machine, so a short freeze the first time the map opens after a move (an iPhone will be slower). Cached after that (last 2 places).
3. The sky build is 0.3 to 1.8 s of work per place, spread over 45 to 150 frames; until it finishes the plain 260-dot backdrop shows.
4. The glow is quantised to 8 bits, so faint parts show thin contour bands (same technique as G2, more visible in the dim middle of the disc).
5. `?mapat=` labels the real current system "you are here" if you tap it.
6. `/galaxy-map-preview.html` shows the stand-in galaxy, not the universe: it is a developer page and must not be mistaken for the real map.

## 12. Suggestions (not requested, nothing here is built)

- suggestion: **pre-warm the star lookup** right after arriving (when idle), so the map opens at once; decide after Andy's iPhone numbers.
- suggestion: **a bulge in the universe** (a 3D bulge in `densityAt`, Agent 2) if Andy misses it; adding it only to the sky would make the sky disagree with the star pixels.
- suggestion: **a one-line legend** under the map hint ("diamond = within reach of this ship"), Agent 5's HUD.
- suggestion: **show the reach ring numbers** (how many stars are in reach) in the label, from `stats()`.
- suggestion: make the star lookup **sliceable** (Agent 2: `nearestSites` in steps) if the first-open freeze is too long on phones.
