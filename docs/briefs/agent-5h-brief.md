# Agent 5 brief, stage N3a: longer, unique names fit every screen (UI)

You are Agent 5 (UI/UX). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-unique-names-world-seed.md, docs/report-agent-2c.md (sections 1, 3, 5, 6), docs/report-agent-5g.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Anything visual: options A/B/C first. Explain technical words in one sentence. Report: docs/report-agent-5h.md. Combat never; no new features. Agent 4 works at the same time on the seed lock (docs/briefs/agent-4h-brief.md) and may touch two lines in `src/ui/gamemenu.ts` and `src/ui/index.ts` (removing NEW RANDOM UNIVERSE and the seed line); pull often and do not undo that.

## Situation
Names changed (Agent 2, live on main): systems "Kopipex 2N-83" (some pure names like "Lazy Harbour"), planets "<system> II", docks have a short `name` and a globally unique `fullName` ("Lonely Basin Outpost, Kopipex 2N-83 II"). Lengths: system up to 24 letters near home (42 far away), planet up to 47, dock full name up to 75. The short dock name can repeat in different systems.

## Do
1. Find EVERY place in `src/ui` (and the HTML/CSS) that prints a system, planet or dock name: planet card, FLY HERE, floating panel, WHAT NOW?, Jobs board and job cards (origin, destination, tour stops), job debrief and arrival notes, Shipyard (dock name), Ranks/Explorer, Map and system labels (text set by the UI), tutorial hints, save-file summary, title screen. Make long names wrap or shorten cleanly (no cut-off, no page scroll, no overlap) on a phone upright and sideways and on a desktop. Use `fullName` where the text must be unambiguous (a destination that may be in another system), and the short name where the system is already obvious from the context. Where you must shorten, prefer shortening the word part and keeping the code visible (the code is what makes it unique) or a clear "..." in the middle; say what you chose (A/B/C options).
2. Optional flavour: show the planet `nickname` (when present) as a small funny line on the planet card, NOT as the name (Andy approved nicknames only as flavour: ask him; it is a suggestion).
3. Wording: after Agent 4's N2 is merged, fix texts that mention the seed or a random universe (NEW GAME dialog, SETTINGS, save file panel texts for "another seed": use Agent 4's new field/flag), in the game's friendly tone.
4. Tests for the shortening/wrapping helpers (long names, pure names, coded names, edge lengths 4 and 75). `npm run check` green; Actions green.

## Allowed / not allowed
Allowed: src/ui, CSS, ui tests, docs. Not allowed: src/universe, src/game, src/save, src/render (Agent 3 does the 3D labels and cockpit screens in parallel: docs/briefs/agent-3i-brief.md), new features.

## Andy checks
On his phone upright and sideways: go through Jobs, planet card, FLY HERE, floating, Shipyard, Ranks, Map: find the longest names you can (far from home or the pure-name systems like "Lazy Harbour") and look for cut-off or overlapping text.
