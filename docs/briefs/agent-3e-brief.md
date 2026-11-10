# Agent 3 brief, part 3e: the pixel look and the cockpit

You are Agent 3 (rendering). Same method as 3d: read docs/design-doc.md, docs/CONVENTIONS.md, docs/status.md, docs/report-agent-3d.md first. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Deliver one zip; the only report is docs/report-agent-3e.md. Free flight and combat are permanently out.

## Goal
Make the whole game look PS1-era: grainy, chunky, low-poly, but with a dark space full of colour. Redo the cockpit frame Andy dislikes.

## Do
1. **Pixel look.** Low-resolution render (about 57,600 pixels, 320x180 shape) scaled with nearest-neighbour. Add, all switchable in `src/render/settings.ts` with one number each:
   - colour banding (reduce colour steps, default modest),
   - light dither/grain,
   - optional slight vertex wobble (PS1 "jitter") on models, default OFF.
   Keep text/UI crisp: the UI layer (src/ui) is not pixelated.
2. **Cockpit frame.** Replace the old frame overlay with a new one built from the ship's own cockpit: view from the `eye` anchor; frame (struts, dashboard edge, small glowing screens) drawn per ship (cargo-hauler wide multi-pane, passenger-liner elegant, scout narrow). Simple shapes are fine. The planet/stars must still be the star of the view.
3. (Removed by Andy: the cockpit view when leaving a station should NOT show the planet, it is behind the ship. Leave as is.)
4. **Effects.** Restyle flames, warp flash and shake so they match the pixel look. Keep durations as set in 3d.
5. (Removed by Andy: no arrival shake at outposts. Leave as is.)
6. Performance: must stay smooth on a phone. Report the settings that cost the most.

## Allowed
src/render (not src/render/assets), glue in src/ui/index.ts only if unavoidable, tests, docs. Not allowed: src/render/assets/*, src/game, src/universe, src/models.ts. Agent 8 is working in src/render/assets right now.

## Andy checks
Green Actions run, then: docked view at an outpost and a station, a full flight in cockpit and orbit views with each ship (`?ship=passenger-liner`, `?ship=scout`), on a phone too. Andy answers: does it feel PS1? Is the cockpit better? Anything too grainy to read?
