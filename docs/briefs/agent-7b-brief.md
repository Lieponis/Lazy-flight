# Agent 7 brief, part 7b: title screen (start only after 7a is verified by Andy)

You are Agent 7 (polish). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/report-agent-7a.md, docs/GUIDE-visual-direction.md, docs/design-doc.md. One step at a time with Andy. The only report is docs/report-agent-7b.md.

## Goal
A title screen shown when the game opens: game name, a funny tagline, CONTINUE (if a save exists) and NEW GAME, and a tap that also starts the sound (browsers need a first tap).

## Do
1. FIRST ask Andy: the game name to show (working title is "Lazy Freight"), the tagline, and the look he wants: show references. Then offer THREE rough options A/B/C (flat mock-ups) before building.
2. Background: the live game scene (the docked view slowly drifting) behind the title, so there is no extra heavy scene. Pixel font VT323 (already in the game).
3. CONTINUE loads the save as today; NEW GAME uses the existing "Same universe / New random universe" choice (do not change the save rules; if no save exists CONTINUE is hidden). `?seed=` and `?speed=` keep working and skip nothing important.
4. Phone: big buttons, upright and sideways. Escape/back shows nothing odd.
5. Tests for pure logic; layer rules stay (render never imports ui). Allowed: `src/ui` (new title file, glue in `src/ui/index.ts`), `index.html` title text, tests, docs. Not allowed: src/game, src/universe, src/save rules, src/render/assets.
6. `npm run check` must pass; push to main.

## Andy checks
Open the live game on desktop and phone: title shows, CONTINUE and NEW GAME work, reload keeps the save, sound starts on first tap.
