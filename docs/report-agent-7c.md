# Report: Agent 7, part 7c (extra planet looks)

**Status:** DONE. Andy checked it live on 2026-11-11 and replied "Keep".
Live: https://lieponis.github.io/Lazy-flight/ (try `?seed=777`), preview wall https://lieponis.github.io/Lazy-flight/planets.html.
Code commit `1554074` on `main`; GitHub Actions green; `npm run check`: 505 tests pass.

## 1. What was built (Andy's choice: option B "No Man's Sky mix")
Andy's references were in words (I could not open his links: Google and Reddit block me, and the ring picture did not load):
- variety like No Man's Sky;
- rings on 5–10 % of planets, chosen at random, in a variety of widths, with grounded space-rock colours.

Three rough options A/B/C were shown on a claude.ai preview page; Andy chose B. B gives:
- **Surprising colours on about 1 in 3 planets** (33 % measured). The planet's own colours are turned round the colour wheel by a quarter to most of a turn, with a little more saturation: pink jungles, purple seas, toxic-green deserts and so on. Every planet keeps its type.
- **Continents and patches** from smooth noise instead of the old fixed sine pattern.
- **Ice caps** on some rocky, ocean, jungle, barren, desert and ice worlds.
- **Craters** on most rocky, barren and ice worlds.
- **Cloud patches** on most ocean and jungle worlds. They are a slightly larger shell holding only the cloudy triangles, white with the same four light steps.
- **Gas giants:** storm stripes, swirly on about 60 % of them.
- **Lava worlds:** bright rivers (they do not glow; glow was option C). Desert worlds: pale dunes. Jungle worlds: lakes.
- **Rings on about 8 % of planets** (8.3–8.9 % measured), of any type:
  - 2 to 5 bands, total width 0.25–1.1 × the radius, starting 1.25–1.55 × the radius out;
  - about half the bands have a gap (like Saturn's);
  - 6 rock tones (tan, beige, grey, brown), random tilt.

The ring decision uses its own hash, so it does not depend on the other choices.

## 2. The hard rule: src/universe is untouched
- **No file in `src/universe` changed.** The look is chosen in the render layer by `chooseLook(planet)` (`src/render/planetlook.ts`), from an FNV-1a hash of the planet id plus its existing type and colours. The same planet id gives the same look on every device.
- **Proof:** `tests/planetlook.test.ts` has a fingerprint of the universe (systems, planets, docks, markets and job boards near the start) for seeds 12345, 777 and 4242, recorded on main before this work. If anything in the universe changes, these 3 tests fail.
- **Saves are not affected:** nothing new is saved.

## 3. Where the looks show
- **System view:** planets are now drawn rounder (detail 2 = 180 triangles, was 80; gas giants detail 3 = 320) so caps, craters and stripes show.
- **Title screen (7b):** the same looks, rings included.
- **Docked views and flight:** the big planet under an outpost gets **no rings and no clouds** (they would cut through the pad). The planet below a station gets **no rings**, and its clouds float low (1.2 % of the radius, about 2 units, well under the bay floor at 8).
- **Galaxy map:** unchanged (it shows stars, not planets).

## 4. Cost on phones (triangles)
| What | Before | Now (worst case) |
|---|---|---|
| Planet in system view | 80 | 180 (gas 320) |
| + clouds | – | up to the same again (only cloudy triangles: about 15–30 % of the shell) |
| + rings | – | up to 5 bands × 80 = 400 |
| Biggest single planet | 80 | ≤ 1 040 (tested limit) |
| Ground under an outpost | 3 380 | 3 380 (no rings or clouds) |
| Planet under a station | 720 | 720 + low clouds (part of 720) |

- A system of 10 planets stays well under 5 000 triangles in total.
- Colours are worked out once when a planet is built, never each frame.
- Transparent parts (clouds, rings) don't write depth, so they don't hide each other.
- **Not measured:** frame rate on a real phone. Andy felt no slowdown on his iPhone.

## 5. Files
| File | What |
|---|---|
| `src/render/planetlook.ts` (new) | pure: hash, random stream, smooth noise, colour helpers, `chooseLook`, `surfaceColour`, `hasCloud`, `RING_CHANCE` (0.08), `EXOTIC_CHANCE` (0.33), `RING_COLOURS` |
| `src/render/systemview.ts` | `makePlanetMesh(planet, radius, toStar, detail = 2, extras)` uses the look; adds clouds and rings as children (`extras.rings` / `clouds` / `cloudLift`); `RING_SEGMENTS` = 40 |
| `src/render/docked.ts`, `src/render/flight.ts` | pass `{ rings: false, clouds: false }` (outpost ground) or `{ rings: false, cloudLift: 0.012 }` (station planet) |
| `src/ui/titlescene.ts` | detail 2 (gas 3) for the title planets |
| `planets.html`, `src/planets.ts` (new), `vite.config.ts` | preview wall: 20 planets per page, `?seed=`, PREV/NEXT, filter "only with rings" / "only surprising colours", live counts |
| `tests/planetlook.test.ts` (new) | 11 tests: universe fingerprint × 3, same id same look, spread (rings 5–10 %, surprising about 33 %, rings on at least 6 types), ring bands, valid colours, noise, every type draws, triangle budget, rings and clouds can be switched off |

`helpers.planetColorMix` is no longer used by the game; it is kept because its old tests use it.

## 6. Known issues and what is NOT verified
- Light and shadow use the game's existing four steps (`faceShade`), which are quite soft. The dark side is less dark than in the claude.ai mock-ups. I did not change it, because it is the whole game's look. *Suggestion:* darker night steps, if Andy wants more contrast.
- Rings are a flat colour per band, with no shadow from the planet.
- **Not verified:** Android phones, frame-rate numbers, every one of the thousands of planets (checked: 4 seeds in the game, several pages of the preview wall).
- **Lead decision pending (not built, outside my brief):** Andy wants 1–3 docks per system, scaled by system size, instead of one dock on every planet. This changes `src/universe` (docks and job destinations) and needs a save migration, so I stopped and gave Andy a message for the Lead.

## 7. For the next agents
- **Tuning:** ring share is `RING_CHANCE` and surprising share is `EXOTIC_CHANCE` in `planetlook.ts`. Ring colours are `RING_COLOURS`. Cloud amount is `CLOUD_THRESHOLD` (higher means fewer clouds).
- **If the Lead changes docks:** the looks don't care; they depend only on the planet id.
- **Release page (7d):** `/planets.html?filter=rings` makes a nice screenshot.

## 8. Suggestions (not built)
- Option C extras if wanted later: lava glow and city lights on the night side.
- Let tapping a planet in the system view show "ringed" or "surprising" in its label.
