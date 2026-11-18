# Report: Agent 3, stage G7b (does the render layer see Agent 2's central bulge?)

Branch: `universe-v3` only (nothing went to main). Code commit: `c384981` ("G7b: the sky and the map see the central bulge"). Status of this report: **v2. The iPhone numbers at the centre are in (Andy's screenshot of `?mapat=centre&mapstats=1`, 10:39 local on 2026-11-18, preview rebuilt after my push): sky built in 1,053 ms over 65 frames, FRAME 16.7 ms = 60 fps, STAR LOOKUP 13 ms (section 3). Andy sent the screenshots without a comment, so I do not know his opinion of how the centre looks (section 6).**

**What I could NOT do in my workspace:** open the page in a real browser (no WebGL, no network for the shell). Before Andy's screenshots (section 6) the sky and the map with the bulge had never been seen by me on a screen; I have now seen his two phone screenshots and nothing more. Proof so far = the real GitHub Actions runs on `c384981` (both green: "Check a branch" = `tsc --noEmit`, build, **57 test files, 1,183 tests all passed**, and "Check the game layer") plus numbers measured in plain Node on the cloud machine. Andy's check in section 6 is the real proof.

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

**iPhone, at the centre (`?mapat=centre&mapstats=1`, the map's sky), measured by Andy on the rebuilt preview (built 03:34 UTC, after my push at 03:31 UTC):**

| | G5a, before the bulge | G7b, with the bulge and my fix |
|---|---|---|
| **Sky build time** (wall time, built a slice per frame in the background) | 1,376 ms over 84 frames | **1,053 ms over 65 frames** |
| glow work / dots work (adds up the real work) | 194 ms / 317 ms = 511 ms | 274 ms / 239 ms = 513 ms |
| worst single slice | not recorded | 9.0 ms (fits inside one 16.7 ms frame) |
| squares / dots | | 24,592 squares, 59,437 dots |
| **FRAME at the centre** | 16.6 ms (60 fps) | **16.7 ms (60 fps)**, JS 0.1 ms, 5 draw calls, 40,012 triangles |
| STAR LOOKUP | 100 ms | 13 ms (see known issue 5) |
| bubble / zoom-out limit / diamond | | 37 ly radius, 12 ly, 0.19 ly wide; 60,000 stars, 5,000 diamonds, 10,000 tappable |

So the total sky work is the same as before the bulge (511 vs 513 ms); the wall time is shorter because the map's sky is now built at 8 ms per frame (it was 6 ms in G5a). The glow part is 80 ms heavier on the phone and the dots part 78 ms lighter. In Node, timing the same full-size glow at the centre: old disc-only density 418 ms, with Agent 2's bulge density 497 ms (+19 %), with my finer steps added 505 ms (+1.6 %). So the extra glow cost is almost all the bulge's own density formula (Agent 2's), not my fix. The phone's +41 % is bigger than Node's +21 %; I have not found out why.

In Node the same build is about 500 ms of work (505 ms above).

## 4. Tests

- `tests/skybulge.test.ts` (6): the constant equals the bulge radius and 300 random points outside the ball have zero bulge density; output is bit-identical when the ray misses the ball, when the setting is unset, and when it is 0; sample counts (miss = unchanged, crossing = between +8 and +40 samples); system-view accuracy at the middle (bulge part within 0.8 to 1.2 of the reference, was x2.98 before); map accuracy at 10,000 ly; the bulge is more than 5 % of the light at the start place.
- `tests/mapcentre.test.ts` (8): the real list at `?mapat=centre` (60,000 stars, safe whole-number ids, no duplicates, more than 10,000 bulge ids, all below the bulge table's end, distances consistent, `describe` works, distinct sky seeds, the tap grid builds, the ball radius is between 20 and 60 ly); `localSpacing` equals `spacingAt` everywhere inside the disc's thickness (six places), grows with height above the plane, equals `density^(-1/3)`, is what the map list carries, and keeps the zoom-out limit above 20 ly.
- CI on `c384981`: both runs green, 57 files / 1,183 tests. `skybulge`, `mapcentre`, `skylayer`, `skylayermath`, `mapwarm` all passed on the real three.js. (The two red tests of Agent 2 mentioned in the G5a report, known issue 9, are green on this commit.)

## 5. Known issues and suggestions

1. **Seen only in Andy's two screenshots**, one place at one zoom (section 6). I have not looked at the sky from the other places on a phone (start place and 10,000 ly out were checked in numbers only).
2. The system view's sky is a coarse build on purpose (a quarter of the glow squares, a third of the dots, 25 % brightness). Even after the fix, a few single directions seen from the middle are still off (worst single direction off by 859 %, 90th percentile 29 %) while the average is within 13 %. At 25 % strength that is invisible in practice; the map's own sky (finer) is accurate within about 7 % at the 90th percentile at all four places.
3. The system sky's "near radius" (the distance under which the sky is not drawn so single stars do not double) still uses the disc spacing for off-plane bulge systems. Cosmetic only, not changed. *Suggestion (unbuilt):* use `localSpacing` there too.
4. Known issue 7 from G5a still stands: the preview's automatic rebuild timer is unreliable; Andy may need the "Run workflow" button.
5. **STAR LOOKUP read 13 ms on the phone**, but plain Node needs about 150 to 270 ms for the same 60,000 stars at the centre and the phone read 100 ms before the bulge. I think the stat caught a cached answer (the glue keeps the last two lookups), not a fresh one, but I have not confirmed that. Nothing is wrong with the map (FRAME 60 fps); it only means the 13 ms is not a trustworthy lookup time.
6. **The map's zoom-out limit and diamond size at the centre still use the disc's star gap** (1.93 ly, so zoom-out limit 12 ly), because inside the disc's thickness `localSpacing` keeps the old number on purpose. The real gap there, from the screenshot's own numbers (60,000 stars in a 37 ly ball), is about 1.5 ly, which agrees with Agent 2's 1.48 ly. So at the centre the limit and the diamonds are about 25 % larger than the real gap suggests. Cosmetic, not changed. *Suggestion (unbuilt):* take the smaller of the disc number and the real local gap inside the disc as well (one line in `localSpacing`), but that also changes the map in the whole disc by a little, so it needs Andy's say-so.
7. **The two dark round smudges above and below the system in the system view (screenshot 1, Bimvik Deep)** are most likely the two galactic poles, the darkest points of the sky glow. Node numbers from the start place: the glow falls smoothly from 1.0 at 30 degrees above the plane to 0.50 at the pole (lat 90), with no sharp spot, so what shows is a smooth gradient made into a round patch by the pixel look and the dither. My bulge change does not touch those directions (the bulge ball seen from the start place is only about 19 degrees in radius, around the centre direction). I do not know whether Andy has seen the smudges before; I did not change them. If he says they are new, I will look at the sky's ring layout at the poles.
8. *Suggestion (unbuilt, Agent 2's idea):* a warmer colour for bulge stars and the glow near the centre. Not done: it needs an agreed colour rule from the universe layer.

## 6. Andy's check (one step) and what came back

The step was: rebuild the preview (Actions -> Build and publish -> Run workflow), open `/preview/?mapat=centre&mapstats=1`, play to the Starmap, look at the glow and the stars, reply with a screenshot showing the stats block.

What came back: two screenshots at 10:39 local (03:39 UTC), no comment.
- Screenshot 2 (the map at `?mapat=centre`, test view "centre (not where your ship is)"): the stats block in section 3, a tan/beige glow across the whole screen, a lighter blue-grey band across the lower half (the disc plane), thick salt-and-pepper star dots, and large yellow and red diamonds (selected star: "Fulwadar R464-J55, Yellow star, 15.8 ly; 5 nearest: 0.7, 0.7, 1.1, 1.3, 1.5 ly"). That looks like what the numbers predict at the middle of a dense bulge (stars about 1.5 ly apart, glow bright in every direction), but "does it look right to Andy" is his call, and he did not say.
- Screenshot 1 (system view of Bimvik Deep at the start place): the faint backdrop with the dark dust lane and the two dark smudges at the poles (known issue 7).
- The preview contained my change: the last "Build and publish" run began 03:34 UTC, after my push at 03:31 UTC. The stats block has no version line, so that is my reasoning from the times, not something the page shows.

## 7. Hand-off for the Lead

- Nothing outside `src/render`, `src/mapsource.ts` (glue), `tests` and `docs` was touched. Nothing went to main.
- Open items: Andy's opinion of how the centre looks (none given yet); known issues 5 to 7 and the suggestions in section 5 (all unbuilt).
