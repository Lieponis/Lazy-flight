# Agent 8 brief S1: rebuild the 3 SMALL new ships for the game (Andy 2026-11-28)

Build on CURRENT main. One step at a time with Andy (Step N of M / DO max 3 / LOOK FOR / REPLY WITH); visual work: Andy answers "matches / does not match". Lean, save Andy's usage. Suggestions labelled "suggestion". The old brief docs/briefs/agent-8-sketches-brief.md is cancelled.

## Background
Agent 9 designed 9 ships Andy approved (docs/concepts/ship-architect/, gallery.html, one hand-over note per ship, report docs/report-agent-9.md). Andy's decisions (2026-11-28):
- **Raise the limit:** one model per ship, much more detail than the old 1000-triangle ship budget.
- **Replace the current 3 ships.** The player will pick his FIRST ship from the three SMALL ones; every other ship is bought. (The game wiring is a later stage by other agents.)
- **Bigger sizes allowed:** large ships may exceed the old 8-unit size limit (stations and outposts will be upgraded later).
- Ships keep the game's palette and relaxed look; no weapons. No funny touch on ships (as decided in STYLE-GUIDE section 10).

## This stage: ONLY the 3 small ships
Passenger 1 "Eggspress", Cargo 1 "Crate Expectations", Explorer 1 "Pocket Rocket". Medium and large come in later stages after this one proves the method and the phone speed.

## DO
1. Read first: docs/WHERE-TO-LOOK.md, docs/STYLE-GUIDE.md (palette, anchors, naming, orientation), docs/ASSET-PIPELINE.md, docs/ASSET-CATALOG.md, the three hand-over notes and viewers (passenger-1, cargo-1, explorer-1), docs/report-agent-9.md section 2 (Andy's rules) and 4.
2. Budget (Lead's proposal, tell Andy plainly if you disagree): per small ship up to **20,000 triangles, at most 8 meshes, at most 4 materials**. Merge the 89 to 330 concept parts into few meshes by material (one draw call each) but KEEP the part names where they matter (anchors, engines, lights). Record the real numbers per ship. The budget is only final after the phone check (step 5).
3. Rebuild each of the three in the game's pipeline (same way the current ships are built and registered in the models viewer /models.html and the catalog), following each note's "What to keep" and "For Agent 8". Keep Andy's rules: flush windows, short thick legs on level pads, struts visibly into the hull, no floating parts, explorers never look like a real jet.
4. Add all anchors (parking, eye, nose, engines, as in STYLE-GUIDE section 8) and rescale to a sensible game size; propose sizes to Andy (small ships stay near the old 3 to 4 unit range; show a size scale in the viewer).
5. Colours: game palette, A/B/C colour options per ship, Andy picks. Engine glow and lights per STYLE-GUIDE section 7.
6. Phone speed: on Andy's iPhone open the viewer with the 3 ships in one scene (page or ?mode for it) with the triangle counts shown, and report whether it stays smooth. Say clearly if the budget must change.
7. Show Andy each ship next to its concept (gallery) for "matches / does not match / change X".

## Not allowed
No changes to src/ game code, no switching ships in the game, no changes to the 3 current ships or their tests (the live game stays exactly as it is), no save changes. New models go only to the asset folders and viewer/catalog as the pipeline requires. If an existing test breaks because of a new catalog entry, fix it in the least invasive way and say so.

## REPORT (short, docs/report-agent-8-ships-s1.md)
What was built, where the files are, real triangle/mesh numbers, phone speed result, chosen colours and sizes, what the next stage (wiring: start ship choice, shipyard, prices, saves) needs to know. Tell Andy to send it to the Lead.
