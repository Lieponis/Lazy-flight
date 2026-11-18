# Report: Agent 3, stage G7b (does the render layer see Agent 2's central bulge?)

Branch: `universe-v3` only (nothing went to main). Code commit: `c384981` ("G7b: the sky and the map see the central bulge"). Status of this report: **v1. Everything that can be measured without a phone is in. The iPhone numbers at the centre (sky build time and FRAME) are NOT in yet: they need Andy's screenshot of `?mapat=centre&mapstats=1` after the preview is rebuilt (section 6).**

**What I could NOT do in my workspace:** open the page in a real browser (no WebGL, no network for the shell). The sky and the map with the bulge have never been seen by me on a screen. Proof so far = the real GitHub Actions runs on `c384981` (both green: "Check a branch" = `tsc --noEmit`, build, **57 test files, 1,183 tests all passed**, and "Check the game layer") plus numbers measured in plain Node on the cloud machine. Andy's check in section 6 is the real proof.

Brief from the Lead (via Andy): read `docs/report-agent-2f.md` sections 1, 2 and 8; (1) does the sky show the bulge from the start, from the middle of the disc and from 10,000 ly out, or does render code miss it? (2) does the map at the centre still work with system numbers above 46.6 billion and cube cells? Fix only what is wrong, in `src/render` and my glue. Then one step for Andy on the preview. Report sky build time and FRAME at the centre.

## 1. Answers

**(1) Does the sky show the bulge? Yes, from all three places. One weakness found and fixed.**
- The sky is built from the universe's real `densityAt`, which Agent 2 changed to "disc + bulge". My glue (`src/mapsource.ts`) already passed that function, so the glow and the 60,000 dots see the bulge without any change. Nothing in the render code cuts the bulge off: the sky's height box (`SKY_Y_MAX` 4,500 ly) clips at most the thin outer tip above it, and the dots' sampling keeps 99 % of the bulge's mass.
- Measured in Node, glow toward the centre vs. the old disc-only universe: about **x1.2 to x1.4 brighter in the plane and x1.3 to x1.6 above it**, at the start place (16,700 ly out), the middle (30,000 ly) and 10,000 ly out, and inside the bulge.
- **Weakness:** the glow is added up along each ray in log-spaced steps. From far away (the middle) the system view's coarse build (24 steps) stepped over or aliased the bulge: the bulge's share of the light came out **x2.7 too high** (worst single directions off by more than 1,000 %). The map's finer build (56 steps) was already within about 5 % on average light.
- **Fix** (`src/render/galaxy/skyglow.ts`, opt-in): a new setting `bulgeReach` (5,500 ly, the bulge's radius). While a ray is inside that ball, any step longer than a tenth of it is cut into equal pieces (at most 12). Rays that miss the ball, and builds without the setting, give **bit-identical** output to before (tested). The map's and the system view's sky builders both pass it.

**(2) Does the map at the centre work with ids above 46.6 billion and cube cells? Yes. One flaw found and fixed.**
- Real 60,000-star lists at `?mapat=centre`, at the exact centre, 2,000 ly above the plane and 3,000 ly out: all ids are whole numbers a computer holds exactly (bulge ids run from 46,599,825,056 up to about 8.27e10, far below 9e15), no duplicates, distances consistent with the positions, `describe` works for bulge ids (name and star type), and each bulge system gets its own pattern of background dots (`systemSkySeed` distinct for all 20+ sampled). At `?mapat=centre`, **45 % of the 60,000 stars are bulge systems**; the ball that holds the 60,000 nearest stars is about **37 ly** in radius.
- No render or glue code uses cell tables or 32-bit ids for the real map (the map asks `nearestSites` for the nearest stars; cubes vs. rings are inside Agent 2's code).
- **Flaw:** the map's "star gap" (used for the closest/farthest zoom and the size of the diamonds) came from the disc's `spacingAt(r)`. Bulge systems lie up to about 4,950 ly above or below the plane, where the real gap is much larger (about 4 to 5 ly at 2,000 ly up, against the disc's 1.9), so zoom limit and diamonds were too small there.
- **Fix** (glue, `src/mapsource.ts`): new `localSpacing(centre)`. Inside the disc's own thickness it returns exactly the old number (nothing changes for the disc: tested at six places). Above or below that thickness it returns the larger of the old number and the real local gap `density^(-1/3)`. `buildList` uses it.

## 2. Files touched

Render layer: `src/render/galaxy/skyglow.ts` (finer steps inside the bulge), `src/render/galaxy/universefield.ts` (one constant, `UNIVERSE_BULGE_REACH_LY = 5500`, with a test that it equals Agent 2's `BULGE.radius`), `src/render/galaxy/skylayer.ts` and `src/render/starmap.ts` (pass the setting). Glue: `src/mapsource.ts` (`localSpacing`). Nothing in `src/universe`, `src/game` or `src/ui` was touched. New tests: `tests/skybulge.test.ts` (6) and `tests/mapcentre.test.ts` (8).

## 3. Numbers (cloud machine, plain Node, real universe; NOT a phone)

Sky accuracy against a 1,500-step reference (bulge part = the light the bulge adds; "light" = all light), map = 64 faces x 56 steps, system view = 32 x 24:

| Place | Build | Bulge part, before -> after fix | All light, before -> after | Build time before -> after |
|---|---|---|---|---|
| start (16,700 ly) | map | 1.010 -> 1.002 | 0.985 -> 0.996 | 837 -> 876 ms |
| start | system view | 0.999 -> 1.043 | 1.079 -> 1.032 | 134 -> 132 ms |
| 10,000 ly out | map | 0.970 -> 1.001 | 0.990 -> 0.999 | 951 -> 1,001 ms |
| 10,000 ly out | system view | 0.986 -> 0.998 | 0.973 -> 1.015 | 137 -> 157 ms |
| middle (30,000 ly) | map | 0.950 -> 1.003 | 0.954 -> 0.990 | 264 -> 268 ms |
| middle | system view | **2.734 -> 0.994** | 1.734 -> 1.127 | 119 -> 114 ms |
| centre (`?mapat=centre`, 400 ly) | map | 1.001 -> 1.001 | 1.005 -> 1.006 | 486 -> 477 ms |
| centre | system view | 1.004 -> 0.999 | 1.046 -> 1.003 | 58 -> 82 ms |

(1.000 = same as the reference. Build times vary by a few percent from run to run.)

**Sky build time at the centre (`?mapat=centre`, map's sky): about 480 ms of work in Node** (the real phone number comes from Andy's screenshot; I do not guess it). The earlier G5a iPhone measurement at the centre, before the bulge existed, was: sky built in 1,376 ms wall time (glow 194 ms + dots 317 ms of work, spread over 84 frames), **FRAME 16.6 ms = 60 fps**, STAR LOOKUP 100 ms.

**FRAME at the centre:** not measured with the bulge yet (needs the phone). Expected unchanged, because drawing the sky costs the same whatever the glow holds, and the sky is built ahead of time in small slices per frame; only the star lookup for the 60,000 nearest stars changes (about 150 to 270 ms in Node at the centre, because half the stars are bulge systems; the phone ran about 1.6 times faster than Node before).

## 4. Tests

- `tests/skybulge.test.ts` (6): the constant equals the bulge radius and 300 random points outside the ball have zero bulge density; output is bit-identical when the ray misses the ball, when the setting is unset, and when it is 0; sample counts (miss = unchanged, crossing = between +8 and +40 samples); system-view accuracy at the middle (bulge part within 0.8 to 1.2 of the reference, was x2.98 before); map accuracy at 10,000 ly; the bulge is more than 5 % of the light at the start place.
- `tests/mapcentre.test.ts` (8): the real list at `?mapat=centre` (60,000 stars, safe whole-number ids, no duplicates, more than 10,000 bulge ids, all below the bulge table's end, distances consistent, `describe` works, distinct sky seeds, the tap grid builds, the ball radius is between 20 and 60 ly); `localSpacing` equals `spacingAt` everywhere inside the disc's thickness (six places), grows with height above the plane, equals `density^(-1/3)`, is what the map list carries, and keeps the zoom-out limit above 20 ly.
- CI on `c384981`: both runs green, 57 files / 1,183 tests. `skybulge`, `mapcentre`, `skylayer`, `skylayermath`, `mapwarm` all passed on the real three.js. (The two red tests of Agent 2 mentioned in the G5a report, known issue 9, are green on this commit.)

## 5. Known issues and suggestions

1. **Not seen on a screen** (section 6 is the real check).
2. The system view's sky is a coarse build on purpose (a quarter of the glow squares, a third of the dots, 25 % brightness). Even after the fix, a few single directions seen from the middle are still off (worst single direction off by 859 %, 90th percentile 29 %) while the average is within 13 %. At 25 % strength that is invisible in practice; the map's own sky (finer) is accurate within about 7 % at the 90th percentile at all four places.
3. The system sky's "near radius" (the distance under which the sky is not drawn so single stars do not double) still uses the disc spacing for off-plane bulge systems. Cosmetic only, not changed. *Suggestion (unbuilt):* use `localSpacing` there too.
4. Known issue 7 from G5a still stands: the preview's automatic rebuild timer is unreliable; Andy may need the "Run workflow" button.
5. *Suggestion (unbuilt, Agent 2's idea):* a warmer colour for bulge stars and the glow near the centre. Not done: it needs an agreed colour rule from the universe layer.

## 6. Andy's check (one step)

1. Rebuild the preview: https://github.com/Lieponis/Lazy-flight/actions -> "Build and publish" -> "Run workflow" (green button), wait about 2 minutes.
2. Open https://lieponis.github.io/Lazy-flight/preview/?mapat=centre&mapstats=1 , play to the Starmap.
3. Look for: a soft glow behind the stars that is brighter toward one side (toward the centre of the galaxy, where the bulge is) and stars packed close together; then reply with a screenshot that shows the grey stats block (the SKY line has the build time, the FRAME line has the milliseconds per frame).

## 7. Hand-off for the Lead

- Nothing outside `src/render`, `src/mapsource.ts` (glue), `tests` and `docs` was touched. Nothing went to main.
- Open items: the iPhone numbers at the centre (Andy's screenshot); suggestions in section 5.
