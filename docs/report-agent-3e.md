# Report: Agent 3, stage 3e (PS1 pixel look + warp)

**Not run here:** `npm run check` and Three.js cannot run in my workspace (no network). Proof is the green GitHub Actions run plus Andy's click-tests. Offline I ran a stand-in type check and the pure tests (look, warp).

## Built
- **Right wing screen** now uses Agent 8's `screenRightWing` anchor (mirror code and `COCKPIT_CENTRE_X` removed).
- **Pixel look** (`look.ts`, `lookmath.ts`): one extra pass over the finished low-res picture (docked, starmap, system, flight and the cockpit lens, without touching the lens). Dials in `settings.ts` / presets in `lookmath.ts`, 0 = off: colour bands, dither, grain. Andy compared A/B/C and chose **B** (24 shades, full dither, grain 0.02), the default (`LOOK_DEFAULT_STYLE`). UI (src/ui) is not pixelated. Flames flicker in chunky steps (`LOOK_FLAME_FLICKER`), the warp flash fades in 6 steps and is pale violet (`LOOK_FLASH_STEPS`).
- **Vertex wobble** was built, broke fine models (cockpit, ships) even when softened, and was **removed at Andy's request**.
- **Warp** (`warp.ts`, `warpmath.ts`): one cheap shader loop: dense stars with random trails that stretch behind the ship, slow blue/purple/violet colour drift, nebula-cloud haze all around (varying strength), a surge every ~25 s. Runs in Orbit and Cockpit, no growth over 75 min (state is only a clock). Andy chose style C and approved it. Old hexagon tunnel (`tunnel.ts`, `TUNNEL_*`) deleted.

## Try / links
Live: https://lieponis.github.io/Lazy-flight/ . Testing aids: `?lookpreview=1` (Off/A/B/C buttons), `?look=A|B|C|off`, `?warppreview=1` (endless warp, A/B/C), `?warp=A|B|C`, `?speed=`, `?ship=`.

## Phone cost (estimates, NOT measured)
1. Warp style C: 1400 star lines + 16 cloud sprites (additive, overdraw). Lighter: style A (`?warp=A`) or lower `WARP_HAZE_COUNT` / `WARP_STREAKS`.
2. Pixel look pass: one full-screen copy of a ~57,600-pixel picture in half-float; very cheap. `?look=off` skips it entirely.
3. Cockpit lens (existing) is the other half-float pass.
Frame rate was not measured; Andy reported earlier phone checks as good.

## Phone checklist (one)
Hard refresh, start a trip with `?ship=scout`: look in Orbit and Cockpit; warp smooth, cockpit screen text readable, no black screen.

## Known issues / for the next agent
- Dither/grain makes the 192 px cockpit screen text slightly rougher; readable at B. If a phone shows trouble, use `?look=A`.
- Tour stops on the map screen are spaced evenly (no real distances).
- Field in flight.ts is still named `tunnel` (it holds the new warp).
- `src/render/assets` untouched.
