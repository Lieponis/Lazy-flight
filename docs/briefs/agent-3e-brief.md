# Agent 3 brief, part 3e: the PS1 pixel look and the warp animation (REVISED 2026-11-10)

You are Agent 3 (rendering). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/design-doc.md, docs/CONVENTIONS.md, docs/GUIDE-visual-direction.md, docs/report-agent-3d.md, docs/report-agent-3-c2a.md, docs/report-agent-3-c2b.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). The only report is docs/report-agent-3e.md. Free flight and combat are permanently out. Never change something Andy already decided. Push to main if you have GitHub access; otherwise one zip of only changed files.

## Goal
1. Make the whole game look PS1-era: grainy, chunky, low-poly, but with a dark space full of colour.
2. Make the warp animation (the cinematic travel loop) much better. Andy's original wish: "Travel should be cinematic warp animation loop".

## Already decided (do NOT redo)
- The cockpit (room, lens, shake, look-around, screens) is DONE (Agent 8 C1, Agent 3 C2a/C2b/C2c). Do not change its design. The old flat cockpit frame is gone.
- No arrival shake at outposts; the cockpit view leaving a station does not show the planet. Both stay as they are.
- The UI layer (src/ui, text, menus) is NOT pixelated.

## Small first task (from the Lead, do it before Part 1, one commit)
Agent 8 added the `screenRightWing` anchor to the base cockpit (identical position to your mirrored placement). In `src/render/cockpitscreens.ts`: (1) in `makeFace` use `model.anchors[name]` for every screen including `screenRightWing`; (2) delete `mirroredFuelAnchor()` and `COCKPIT_CENTRE_X` and any tests that use them; (3) check the right wing picture stays in the same place, Cockpit view looks unchanged, `npm run check` passes. Tell Andy in one line when done.

## Part 1: pixel look
Add, all switchable in `src/render/settings.ts` with one number each (0 = off):
- colour banding (fewer colour steps; default modest),
- light dither/grain,
- optional slight vertex wobble (PS1 "jitter") on models, default OFF.
Work with the existing low-resolution render (about 57,600 pixels, nearest-neighbour scaling). The cockpit lens pass and the screens' textures must still look right and readable. Show Andy options A/B/C of the look (different strengths) BEFORE choosing defaults. Also restyle flames and the warp flash to match.

## Part 2: warp animation
1. FIRST ask Andy for his idea (he will send references: pictures, clips or a description of what warp should look like: tunnel, streaks, colours, pulses, speed, sound is not your job). Do not start building before you have them.
2. Then show THREE rough options A/B/C (simple versions, a few minutes each) and let Andy pick. Build the chosen one.
3. It must be a loop that can run as long as the trip lasts (up to about 75 minutes at game speed 1) without becoming boring: slow variation, gentle colour drift, occasional pulses. Must work in both Orbit and Cockpit views. Keep launch and approach as they are unless Andy asks.
4. Phone-friendly: report frame rate cost; offer a lighter setting if needed.

## Performance and checks
`npm run check` must pass. Report the settings that cost the most on a phone. Give Andy ONE short phone checklist.

## Allowed / not allowed
Allowed: src/render (not src/render/assets), tests, docs, tiny glue in src/ui/index.ts only if unavoidable (tell the Lead). Not allowed: src/render/assets, src/game, src/universe, src/save, src/models.ts.

## Andy checks
Green Actions run, then: docked view (outpost and station), a full flight in Orbit and Cockpit with each ship (`?ship=passenger-liner`, `?ship=scout`), phone too. Andy answers: does it feel PS1? Anything too grainy to read? Is the warp what he imagined?
