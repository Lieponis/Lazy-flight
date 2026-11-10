# Agent 7 brief, part 7c: extra planet looks (start only after 7b is verified by Andy)

You are Agent 7 (polish). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/design-doc.md, docs/GUIDE-visual-direction.md, docs/report-agent-3b.md, docs/report-agent-2.md, docs/CONVENTIONS.md. One step at a time with Andy. The only report is docs/report-agent-7c.md.

## Goal
More variety in how planets look (Andy: dark space, many colours, funny; Elite-style low-poly, PS1 look).

## Hard rule (the Lead's decision)
Do NOT change what `src/universe` produces today for any existing field: the same seed must give the same systems, planets, docks, jobs and prices as now, otherwise saved games would change. New looks are chosen in the RENDER layer by a deterministic hash of the planet's id (and existing fields), or by new OPTIONAL fields that are added without changing any existing value. If you believe a universe change is needed, stop and ask the Lead.

## Do
1. FIRST ask Andy for references (pictures or words: gas giants with rings, ice worlds, lava worlds, ocean worlds, desert, cratered moons, banded storms, glowing cities on the night side). Then show THREE rough options A/B/C (a few planets each, in a preview page like `/models.html?planets` or `?lookpreview`) and let Andy choose which new looks to build (suggest 3 to 6 new looks).
2. Build the chosen looks as extra planet surface styles/colour rules (noise-based, flat vertex colours with four brightness steps as the game does), rings/atmospheres if chosen, with a triangle budget that keeps phones smooth. Docks (outposts/stations) keep working on every look.
3. Tests: same planet id gives the same look; looks are spread across many seeds; every existing planet type still renders; the universe snapshot test proves `src/universe` output is unchanged.
4. Phone-friendly: report the cost. `npm run check` must pass. Push to main.

## Allowed / not allowed
Allowed: src/render (planet code, not src/render/assets), tests, docs, a preview page. Not allowed: changes to existing src/universe output, src/game, src/save.

## Andy checks
Fly around several seeds (`?seed=`), Map and system view, docked view: new looks appear, nothing looks broken, phone smooth.
