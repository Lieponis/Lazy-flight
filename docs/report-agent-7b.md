# Report: Agent 7, part 7b (title screen and speaker button)

**Status:** DONE. Andy tested it live on 2026-11-11 and replied "Keep" (title, speaker, iPhone).
Live: https://lieponis.github.io/Lazy-flight/. Code commit `dc71bdf` on `main`; GitHub Actions green.
After rebasing onto Agent 6c's latest work, `npm run check` passes (494 tests).

## 1. What was built (Andy's choices)
- **Name:** LAZY FLIGHT (chosen over "Lazy Freight"). The browser tab says "Lazy Flight", and so does the MENU subtitle.
- **Tagline:** "SPACE HAULING AT THE SPEED OF NAP".
- **Title screen, option B "deep space"** (picked from mock-ups A/B/C, based on Andy's three reference pictures):
  - Space is navy, a few tones darker than the first try but not black (`#0b0828`), with coloured twinkling stars.
  - The planets are **the game's own low-poly planets** from the player's current system: the one you're docked at, plus a different one. They come from `makePlanetMesh`.
  - **A big station above the name**, from the same system, using Agent 8's model via `buildDockModel`. Andy asked for it at double size.
  - The name is drawn in chunky 5×7 pixel letters by code (no font file). It's on two lines on an upright phone and one line on wide screens, cyan with a glow.
  - "LOADING" with three blinking dots shows for at least 1.2 s, until the game underneath has drawn its first picture. Then a single amber **PLAY** button appears.
  - Everything moves slowly: the planets turn, the station spins and the camera drifts a little.
- **PLAY (Andy's option A):** one button. It continues the save, or starts a new game if there is none; NEW GAME stays in MENU. Enter or Space also count as PLAY (only once PLAY is showing). While the title shows, keys don't reach the game underneath.
- **Sound:** PLAY's tap switches sound on. 7a's "any first tap" rule does this; there was nothing extra to wire.
- **Speaker button (option B, picture only):** a pixel speaker drawn with squares, teal with sound waves when on, red with a cross when muted.
  - Docked, it sits left of MENU; in flight it is alone at the right end.
  - It shares one mute with MENU → SETTINGS: each always shows the same state. The setting is saved in `lazy-freight.sound` and survives reloads.

## 2. How it works
- The title is an overlay over everything (`z-index 100`). The game starts underneath exactly as before.
- The backdrop is a **small separate 3D picture** at the game's pixel count (about 320×180, nearest-neighbour). It exists only while the title shows. After PLAY it fades out (0.4 s) and is **completely freed** (geometries, materials, renderer, drawing context), so it costs nothing while playing. Checked: one canvas left after PLAY.
- **Deviation from the brief, with Andy's approval:** the brief asked for the live docked scene behind the title. Andy chose a space backdrop (option B) that reuses the game's planet and station models instead. **Lead: please confirm.** The second drawing context only lives for the few seconds before PLAY.

## 3. Files
| File | What |
|---|---|
| `src/ui/titlelogic.ts` | pure: name, tagline, pixel letters, layout, low-res size, loading dots, ready rule |
| `src/ui/titlescene.ts` | the 3D backdrop (reads render's `makePlanetMesh` and `buildDockModel`; edits nothing in render) |
| `src/ui/title.ts` | the overlay: name canvas, tagline, LOADING / PLAY, keys, close and free |
| `src/ui/statusstrip.ts` | speaker button (`setSpeaker`, `SPEAKER_STYLE = "B"`, pixel icon) |
| `src/ui/index.ts` | start the title, mark it ready after the first frame, speaker ↔ settings glue (sound now starts before the strip) |
| `src/ui/gamemenu.ts` | subtitle uses `GAME_NAME` |
| `src/ui/theme.css` | title and speaker styles |
| `index.html` | `<title>Lazy Flight</title>` |
| `tests/title.test.ts` | 12 tests: words, letters, fit on 4 screen sizes, layout, planet pick, dots, ready rule, speaker style |

Not changed: `src/render`, `src/game`, `src/universe`, `src/save`, `src/audio`.

## 4. Known issues and what is NOT verified
- **Tested** in a test browser on an upright phone, a sideways phone (844×390), 1280×720 and 320×568 (layout maths), with no errors or warnings. Andy tested live on iPhone Air Safari: Keep.
- **Not verified:** Android phones, very old phones (two drawing contexts for a few seconds), desktop Safari and Firefox.
- If the browser has no 3D, the title still shows its stars, name and PLAY, without planets or station.
- While the "Delivered" card is open, it covers the strip, so the speaker (like MENU) can't be tapped until the card is dismissed. This was already the case for MENU before.
- An arrival paid while the page was closed shows its card behind the title. Its ka-ching is silent, because sound only starts on PLAY.
- The repo is still named Lazy-flight. The save key stays `lazy-freight.*` on purpose: renaming it would lose players' saves.

## 5. For the next agents
- **7c (release page):** use the name **LAZY FLIGHT** and the tagline above. `title-preview` screenshots can be made the same way (title before PLAY).
- **Changing the title:** the words and layout are in `src/ui/titlelogic.ts` (`GAME_NAME`, `TAGLINE`, `titleLayout`). The colours are at the top of `title.ts` and `titlescene.ts`. A new letter needs a 5×7 entry in `GLYPHS`.
- **Speaker:** the look can be switched with `SPEAKER_STYLE` (A words, B picture, C both).

## 6. Suggestions (not built)
- A tiny version number in a corner of the title, for bug reports.
- A share or "add to home screen" hint on the title for phones (7c territory).
