# Report: Agent 3, stage 3i / N3b (long unique names fit the 3D screens)

**Not run here:** `npm run check`, Three.js, the real game and a phone cannot run in my workspace. Proof = green Actions runs (every 3i run was green, about 45 to 56 s) + Andy's click-tests (look B, full name, sharpness "Sharp", final check "matches"). Offline I ran a stand-in type check, the new tests in a stand-in runner (`tests/namefit.test.ts` 25 checks, `tests/screendata.test.ts` 29 checks; real Vitest ran on Actions), flat renders in headless Chromium, and a compile check plus a simulation of the screen shader in headless WebGL2.

## Built
- **Name helpers (pure, tested): `src/render/namefit.ts`.** A system code (for example "2N-83" or "RP5N3-MT662") is what makes a name unique, so every helper keeps the code whole and shortens only the word part with "…". A planet number (I..XX) stays with its code. `wrapWords` breaks only between words and never cuts a code. `fitWrapped` finds the biggest text size that fits a box. `layoutInfo` lays out the whole cockpit information screen.
- **Cockpit information screen, look B (Andy's choice).** All text on the screen has one size, as big as fits, never smaller than 11 design units. Only at that smallest size may the name be shortened with "…", and the code is always kept. The drawing code moved to `src/render/infoscreen.ts` (no Three.js in it, so it is testable and the preview can use it). The layout is cached, so a repeat draw costs about 0.1 ms (first draw about 5 to 10 ms, measured on a computer).
- **The cockpit and flight screens show the full unique name** ("Lonely Basin Outpost, Kopipex 2N-83 II") instead of the short one (Andy's option B). This needed one small edit in `src/ui/index.ts` (see Glue).
- **Names in the flat HUD, the flight text and the planets wall wrap and never cut a code.** `src/render/nametext.ts` puts each code in a no-break span. `.hud-title` used to be one line with "…" at the end (which cut the code off); it now wraps up to 3 lines. `.fh-title` wraps too.
- **Sharper, thinner cockpit text (Andy's choice "Sharp").**
  - Letters are thinner: `TEXT_OUTLINE = 0` in `infoscreen.ts` (the old extra outline made strokes about twice as thick as the font's own). Same size.
  - The information, route, fuel and wing screen pictures are drawn **3 times as fine** (`SCREEN_SUPERSAMPLE = 3`, 192 to 576 pixels wide, same shape). **The game itself stays at 320×180** (Andy cancelled the finer game picture; `?res=` was removed again).
  - The four screens use a small shader (`ShaderMaterial` in `cockpitscreens.ts`) that sharpens the text a little when the screen is far away (`TEXT_SHARPEN = 1.2`; 0 would be the old soft look). Andy picked "Sharp" from SOFT, SHARP, SHARPER and CRISP; the other looks and their test buttons are removed.
- **Testing aids (live):** `?namepreview=1` (sheet of cockpit information screens with real and worst-case names, SIZE: BIG / GAME), `?floatpreview=1` (new buttons LONG TRIP and LONG TOUR), `?systempreview=1` (starts with the longest-named system and a pure-name system). Worst-case sample names live in `src/render/namesamples.ts`.

## What I measured (seed 12345, regions up to 300 ly, on a computer)
| | longest real name | the limit the code must survive |
|---|---|---|
| system | about 24 letters | 42 (24 near home) |
| planet | about 29 | 47 |
| dock full name | about 54 | 75 |
The limits are theoretical worst cases; the tests and the previews use them (`WORST_SYSTEM`, `WORST_PLANET`, `WORST_DOCK_FULL`).

## Glue edited in `src/ui/index.ts` (the only edit outside render)
One line added next to `systemNameOfDock`: `const flightName = (id) => getDock(seed, id)?.fullName ?? getPlanet(seed, id)?.name ?? "Unknown place";` and used in three places: the job `destinationName`, the job `stops`, and the free-trip `destinationName`. The menus still use the short names (`dockName`, `placeName`). Nothing else changed there. `src/game`, `src/universe`, `src/save`, `src/models.ts`, menus and HTML texts are untouched; render imports no game or ui code (layer-rule test passes).

## How to check
Live: https://lieponis.github.io/Lazy-flight/ .
1. `?namepreview=1`: every information screen shows the code whole; very long names end in "…" but keep their code; SIZE: GAME shows them at the size they have in the cockpit.
2. `?floatpreview=1`: press LONG TRIP and LONG TOUR and look at the cockpit screens while flying.
3. `?systempreview=1`: first two systems have the longest and a pure name; the title wraps and the code stays whole.
4. Normal game: take a job to a far dock and look at the cockpit screens.

## Phone checklist
Open `?floatpreview=1` on a phone, press LONG TOUR and zoom the cockpit view out: the text is readable and does not flicker; the game stays smooth.

## Known issues / not verified
- **The real shader in the 3D cockpit on phones and phone speed are NOT verified.** The shader compiled and gave the expected result in a headless WebGL2 simulation; on Andy's device (computer) the look matched. Phone frame rate was not measured.
- **Cost of the finer screens, not measured:** each screen picture is 576×480 (about 1.1 MB, plus mipmaps) and four screens exist; the information screen is redrawn about 4 times per second. If a phone is slow, set `SCREEN_SUPERSAMPLE` to 2 (one number in `screendata.ts`).
- **TRIS counter** was not re-read after the screen change. No geometry changed, so the triangle budget should be unchanged.
- When the cockpit is zoomed far out a screen is only about 50 to 60 game pixels wide. That is a hard limit on how readable very long text can be; look B accepts shortened names there.
- A very long name on the galaxy map: the map label uses the same HUD wrapping (wraps, code kept); I could not force a worst-case name there to look at it.
- The pre-existing `.hud-title` and `.fh-title` class names were kept (Agent 5's names).
- The screen picture is stretched vertically to the plane (about 1.36 times taller letters). This was already so; I kept it so letters keep the same size on screen.

## Notes for the next agents
- `tests/agent6c.test.ts` counts `launchSeconds:` and `this.phases = ` in `flight.ts`; do not add more of those literals.
- Render must not import `src/ui`, so the shortening helpers exist twice (`src/ui/logic.ts` for menus, `src/render/namefit.ts` for 3D). They differ slightly: mine keeps the planet number for pure names ("Lazy Ha… II"), Agent 5's cuts at the end.

## Suggestions (not built, not asked for)
- Suggestion: move the name-shortening helpers to a shared pure folder that both ui and render may import, so there is one version.
- Suggestion: a compact "D" layout for the information screen when the cockpit is zoomed far out (fewer rows, bigger text).
- Suggestion: draw the screen picture at exactly the on-screen size (redraw by zoom) for the best sharpness; real page text over the 3D screen is the other option. Both are bigger jobs.
- Suggestion: fix the vertical stretch of the screen pictures (the letters would then be redesigned to the plane's true shape).
