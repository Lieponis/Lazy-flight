# Agent 3 brief, stage U3 (render): the system view with up to 10 planets

You are Agent 3 (Rendering). Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-fewer-docks.md, docs/report-agent-4e.md (section 1 and 6), docs/report-agent-7c.md (planet looks), docs/GUIDE-visual-direction.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Visual change: show options A/B/C first, then a "matches / does not match" list. Report: docs/report-agent-3f.md. Free flight and combat are permanently out. Do not change `src/universe`, `src/game`, `src/save`.

## Situation
Systems now have 1 to 10 planets and only 1 to 3 of them have a dock. Agent 4 made planets without a dock plain scenery that can be tapped for info (name, type, size, "No dock here - nothing to visit") but never a destination. The system view was built for at most 8 planets that all had docks.

## Do
1. Make the system view look good and stay readable with 1 to 10 planets (orbit spacing, camera distance, planet sizes, labels not overlapping). Test seeds with 1, 5 and 10 planets.
2. Make docks easy to find at a glance and dock-less planets clearly scenery: for example a small dock marker or a brighter orbit line for planets you can visit, dimmer for scenery. Offer A/B/C options to Andy. Planet looks (rings, colours) stay as in 7c.
3. A system with one dock: the view must still make sense (no empty "choose a destination" feeling).
4. Performance: a 10-planet system with rings and clouds stays well under 5,000 triangles; give the number. Phones matter.
5. Keep all tests green (`npm run check`); add tests for any new pure helper (layout, spacing).

## Allowed / not allowed
Allowed: src/render, render tests, planets.html if needed, docs. The layer rules stay (render imports nothing from game or ui). Not allowed: anything else; no new features.

## Andy checks
Open a few seeds (`?seed=`) with 1, 5 and 10 planets: nothing overlaps, docks are easy to spot, scenery planets can be tapped for info.
