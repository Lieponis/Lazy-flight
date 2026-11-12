# Report: Agent 7, stage E1 (7f): rare Earth-like planets (render only)

**Status:** DONE. Andy checked it live on 2026-11-12: "Now outposts are placed nicely, keep."
Commits on `main`: `e28c6a6` (Earth-like looks) and `b02b38e` (outposts on a coast). GitHub Actions green; `npm run check`: 788 tests pass.
Live: https://lieponis.github.io/Lazy-flight/planets.html?filter=earthlike, and the game with `?seed=88` / `?seed=214` / `?seed=17` (start on an Earth-like outpost).

## 1. What was built (Andy's choices)
- **Earth-like look.** Options A "classic", B "blue marble" and C "tropical" were shown as real renders. Andy chose **A and C both**, picked per planet from its own hash, with **fewer clouds** than the first try.
  - **A:** deep blue sea, green and brown-green land, small ice caps.
  - **C:** turquoise shallows, sandy beaches, green land, no ice.
  - Both keep the PS1 colour steps and the game's four light steps.
- **Rare:** 2.41 % of 5,193 planets (8 seeds, 30 ly each). Allowed types: OCEAN and JUNGLE (13 % chance each), ROCKY (3.7 %). Never gas giants, lava, ice, desert or barren.
  - The choice uses its own hash (`earth:<planet id>`), like the ring decision. The same planet always gives the same answer.
- **Effect on the other looks** (same sample, before → after): rings 7.84 % → 7.49 %, surprising colours 33.1 % → 32.4 %. Earth-likes simply don't get these.
- **Earth-likes never get** rings, surprising colours or craters, and always have clouds. Cloud threshold is A 0.61 / C 0.62 (other worlds 0.62), so they have a little more cloud than A-type worlds elsewhere, or the same. **No** city lights (7c option C, not approved). **No** gameplay effect.
- **Outposts on a coast** (Andy: "on land, green or sand, near the water, not an ice world"):
  - In the docked view and at outpost launch and arrival, the planet's painted pattern is turned so a coastal land spot sits under the outpost. That spot is land around the pad, with sea 0.10–0.24 rad away (in view) and away from the ice caps. Only the picture turns.
  - Found for more than 95 % of Earth-likes (tested); the rest keep the normal look.
- **`/planets.html`:**
  - filter "only Earth-like" (`?filter=earthlike`);
  - a live count in the header;
  - `&earth=A|B|C` forces one look for comparing;
  - tags show "EARTH-LIKE A/C".

## 2. Hard rule kept
- `src/universe` untouched. The universe-fingerprint tests (7c) are still green.
- A planet's type, size and dock are unchanged.

## 3. Where it shows
- **System view, title screen backdrop, floating scene and planets wall:** the full look, with clouds.
- **Under a station** (docked, launch, arrival): no rings, low clouds (7c rules).
- **Under an outpost:** no rings, no clouds, coast on top.

Checked in a test browser: seeds 17, 88, 137 and 214 (outposts), 64 (station), 10 (system view), and the title with an Earth-like.

## 4. Cost (triangles)
- An Earth-like in the system view: 180 (detail 2) + at most 180 cloud triangles = **≤ 360** (tested). No rings, so it is below the 7c worst case of 1,040.
- Outpost ground: unchanged (3,380, no clouds). The coast search runs once when the view is built: up to 900 test points with a few colour look-ups each, a few milliseconds.

## 5. Files
| File | What |
|---|---|
| `src/render/planetlook.ts` | `EARTH_CHANCE`, `EARTH_PALETTES` (A/B/C), `EARTH_STYLES_IN_GAME` = A, C; `isEarthLike`, `earthStyleOf`; `chooseLook(planet, earthStyle?)`; `PlanetLook.earth` and `cloudThreshold`; `coastSpot()` |
| `src/render/systemview.ts` | `makePlanetMesh` extras `earthStyle` (preview only) and `outpostGround` (turns the pattern) |
| `src/render/docked.ts`, `src/render/flight.ts` | outpost ground passes `outpostGround: true` (one word each) |
| `src/planets.ts`, `planets.html` | Earth-like filter, count, `&earth=` |
| `tests/earthlike.test.ts` (new) | 12 tests: 2–3 % share; only fitting types; rings and surprising shares kept; same id same look; A and C both appear, never B; no rings, surprising colours or craters; sea, land and fewer clouds; triangle budget; docked switches; coast spot found (> 95 %), is land and off the caps, same every time, none for other planets; outpost top face is land, not sea or ice |

## 6. For the Lead
- **Andy's request, not done (outside my files):** "the outpost's landing plate should be land-coloured". On Earth-likes the plate under the outpost (`src/render/assets/outposts.ts`, `GROUND` plate tinted with the planet's own universe colour) shows the planet's original colour (blue on ocean worlds). Suggested fix for Agent 8: tint the plate from the look's land colour when `chooseLook(planet).earth` is set (`EARTH_PALETTES[earth].land`, or `.beach` for C). This needs the planet look passed to the outpost builder, which is a small API change in render/assets.
- **Not verified:** a real phone (Andy checked live), Android, every Earth-like in every seed.
- **Suggestion (not built):** an "EARTH-LIKE" tag on the planet info card (Agent 5's area).
