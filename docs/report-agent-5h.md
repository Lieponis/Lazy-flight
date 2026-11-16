# Agent 5 report, stage N3a (5h): long unique names fit every screen

## 1. What was built
Andy chose from options first: long names **B**, nicknames **only on scenery planets**, doubled title **A**.
- **One-line spots shorten only the word part and always keep the code** (Andy chose B). New pure helpers in `src/ui/logic.ts`:
  - `splitCodedName` splits "Kopipex 2N-83 II" into word, code and numeral. The code alphabet is `[2-9DHJMNPRTV]` with one hyphen.
  - `shortenName(name, max)` shortens the word with "…" and keeps " CODE SUFFIX". Names without a code ("Polite Porridge") are cut at the end with "…".
  - `fitPlace(dock, system, max)` shares the room between the dock and the system name. An empty system name means a planet, which is shown alone.
  - `fitLocation(info, max)` adds "EN ROUTE TO " or "IN SPACE AT ".
  - Other helpers: `shortestName`, `nicknameLine`, `splitCodes`.
- **Fitting to the real width:** `fitText` in `src/ui/dom.ts` measures the text against the room on screen and shortens it until it fits. The full name goes in the tooltip (`title`). VT323 is monospace, so counting letters is reliable. It is used in the status strip, which re-fits on resize, and in the WHAT NOW? title.
- **Cards and menus wrap** (`overflow-wrap: anywhere`): job destination, planet card title and details, owned outposts, perks, sub-lines and toast. `setNameText` and `nameEl` wrap each code in `span.ui-code` (nowrap), so "RP5N3-MVRJR" never breaks at its hyphen. This covers the jobs menu, arrival, ranks and the planet panel.
- **Phones (≤520px):** the place has its own line in the status strip, with MENU at the end of that line.
- **Floating strip** shows only the planet ("IN SPACE AT Fizniploo Junction 89-3R II"), without repeating the system.
- **Nickname:** an amber line on the card of **scenery** planets only: Locals call it "X".
- **Doubled title (Andy's feedback, chose A):** when docked or floating, the render title (`.hud-title` "DOCKED - …", `.fh-title` "IN SPACE - …") is hidden. The UI does this with the body classes `ui-docked-on` and `ui-floating-on` plus CSS. Map and flight titles stay.
- The WHAT NOW? button moved 34px lower so it no longer covers the map titles.
- **Seed wording after N2:** NEW GAME confirm text: "Your credits, ships, ranks and job will be gone. You start again at the home dock, in the same universe as everybody." Agent 4's removals in gamemenu/index were kept.
- **Tests:** a new `tests/ui-names.test.ts` covers split, shorten (edges at 4 and at 75 letters), fitPlace, fitLocation, the nickname line and splitCodes. Total: 862 pass.

## 2. Verified
- `npm run check` green. Actions green: c2db31b, c658b2f.
- Headless browser at 360×640, 390×844, 844×390 and 1280×800: no page scroll, no overlap. Checked for names near home and for a far system with 75-letter dock names. The far system was put in place by a test script.
- Andy, live: names near home (step 2); floating, WHAT NOW?, Shipyard and Ranks with the title no longer doubled (step 4); phone upright and sideways (step 5).

## 3. Known issues / notes for the next agent
- **Step 3 (the longest names) was tested by me only.** The far systems with the longest names are too far away to reach in a real game.
- **Hiding the doubled title depends on the render class names `.hud-title` and `.fh-title`.** If Agent 3 renames them, the doubled title comes back. Keep the names, or tell Agent 5.
- `destinationName` passed to render still uses the dock **short** name. Render shows it in its own titles, outside the UI.
- Only `src/ui`, `src/ui/theme.css` and tests changed. Nothing in render, game, universe or save was touched.
