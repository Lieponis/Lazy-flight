# Agent 3 brief, stage G2: galaxy MAP prototype (many stars, phone speed)

You are Agent 3 (Rendering). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/feasibility-galaxy.md (the whole file: Andy's spec, decisions in section 6, map layers in section 2), docs/report-agent-3h.md (current map and reach), docs/report-agent-3f.md, src/render/starmap.ts. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Anything visual: options A/B/C first, then a "matches / does not match" list. Explain technical words in one sentence. Report: docs/report-agent-3j.md. Combat never. This is a PROTOTYPE with stand-in star data (Agent 2 builds the real generator at the same time on another branch; you do not wait for it and do not import it).

## Goal
Find out whether a phone can draw and handle the galaxy map Andy wants, and how it should look, before the game is rebuilt on it. A go/no-go report with real numbers.

## Andy's map rules
- Systems that can be flown to (inside the ship's reach, about 55 to 80 ly): drawn as DIAMONDS like today but a bit smaller.
- The nearest 10,000 real systems (reachable or not) are tappable.
- Systems out of reach: drawn as small coloured PIXELS (not diamonds). Brightness and size follow distance: the closer the brighter, the further the dimmer.
- Beyond the nearest 10,000: an almost invisible back-drop of faint pixels (not tappable) plus a far-field glow of the galaxy (spiral arms and bulge as a shader or a pre-drawn texture, simple). In the direction you look you see the whole visible universe in this layered form.
- The look stays low-res PS1 style, nearest-neighbour pixels, the game's colours; phone performance matters most.

## Stand-in data (yours, simple, deterministic)
Make a stand-in generator inside the preview only: stars with a position and a type colour, at three local spacings (2 ly = centre-like, 8.6 ly = start-like, 30 ly = outer) so you can switch densities; enough to give about 2,800 systems within 75 ly at 8.6 ly, about 87,000 within 55 ly at 2 ly, and at least 60,000 nearest stars total. Also a coarse far-field model (a spiral density function) for the glow. When Agent 2's report arrives, the Lead may ask you to hook it up; design your data interface so it can be swapped (a function returning arrays of positions, types, and ids).

## Do
1. **Preview page** `/galaxy-map-preview.html` (online only, a separate page: do NOT change the game's map): controls to change density (2 / 8.6 / 30 ly), reach (55 / 80 ly), number of tappable stars (1,000 / 10,000 / 20,000), and toggle layers (diamonds, near pixels, back-drop, far glow), plus an on-screen counter: stars, triangles, draw calls, build time (ms), frame time (ms), JS heap if available.
2. **Diamonds:** one instanced mesh (a single draw call), smaller than the current diamonds; limits: report the largest count that keeps 60 fps feeling on the cloud machine and what the cap should be on a phone.
3. **Pixels and back-drop:** one points draw call with per-point size and brightness by distance (formulas in the report); nearest 10,000 tappable by a spatial grid or a picking pass (report the tap time with 10,000 and with 60,000 stars); no per-star DOM labels (label only the selected star and the 5 nearest).
4. **Far glow:** the cheapest convincing look of a spiral galaxy seen from inside (a few textured quads or one shader on a sphere); show spiral arms; no stars you cannot select pretend to be selectable.
5. **Orbit camera** like the current map (drag to rotate, pinch/zoom, tap to select) and a way to look toward the galaxy centre or the rim from the start-like position.
6. **Measure** (headless Chromium on the cloud machine: say it is software rendering and a LOWER bound for phone speed, so give counts, triangles, draw calls, build times, JS time per frame rather than only fps) at 3 densities x 2 reaches x 3 star caps. Give Andy a one-minute phone checklist on the live preview (frame rate feel, tap on stars, rotate) and ask him what he saw. Propose caps for phones.
7. A short list of what must change in the real map code (`starmap.ts`, `index.ts` glue `reachNow`, the HUD label, picking) when the real generator arrives.
8. Keep `npm run check` green; Actions green. You may merge the preview page into main because it adds new files only and changes nothing in the game or its offline cache list: check Agent 1's file rules (online-only pages like debug.html and planets.html show the friendly page offline: follow the same pattern and say what you did).

## Allowed / not allowed
Allowed: new files (preview page, its script and shader code), `vite.config.ts` entries, tests of pure helpers, docs. Not allowed: changing the game's current map, `src/universe`, `src/game`, `src/save`, `src/ui` (except nothing), the service worker rules beyond the online-only pattern, new features in the game.

## Andy checks
Opens `/galaxy-map-preview.html` on his iPhone: switches densities, rotates, taps stars, says whether it feels smooth; chooses the look of diamonds, pixels and far glow (options A/B/C).
