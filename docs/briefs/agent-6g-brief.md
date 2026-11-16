# Agent 6 brief, stage N4: full QA, offline tests and balance pass (before Andy's big change)

You are Agent 6 (Save / QA / Balance). Work on the CURRENT `main` (never an old zip). Andy wants a full QA pass now because a big change comes after it. This brief COMBINES two older briefs that were never done; read both fully and follow them, with the updates below:
- docs/briefs/agent-6f-brief.md (P4: offline test workflow, `npm run offline-check`, phone checklist). Never delivered.
- docs/briefs/agent-6d-brief.md (balance on universe v2, old-save whole-path tests, regression pass at phone and desktop sizes, performance, flaky/audio tests, phone checklist).
Also read: docs/WHERE-TO-LOOK.md, docs/status.md (everything from "Universe v2" down), docs/ROADMAP-offline-app.md, docs/plan-unique-names-world-seed.md, reports 2c, 3f, 3g, 3h, 4e, 4f, 4g, 4h, 5e, 5f, 5g, 5h, 6e, 7d, 7e, 7f, 1b. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Explain technical words in one sentence. Reports: docs/report-agent-6f.md (offline) and docs/report-agent-6g.md (QA and balance). Tell the Lead BEFORE changing any game number; Andy decides. Combat never; no new features.

## Updates to the old briefs (what changed since they were written)
1. Dropped: the guaranteed starter job (Andy: free travel solves being stuck).
2. Shared world seed: a normal address ignores `?seed=`; test links need `?dev=1&seed=N` (docs/briefs/agent-4h-brief.md, report 4h). Every test, script and the offline harness must use that. Check that `/debug.html`, `/planets.html`, `/game-debug.html`, `/models.html` still work with `?seed=`.
3. Names are unique and longer (report 2c): add checks that no screen cuts or overflows long names at phone sizes (upright/sideways), including the worst-case lengths (system 42, planet 47, dock full name 75 letters) using the dev flag and a far-away system or injected names.
4. New features to cover in the regression pass: free travel (to docks and scenery planets), floating at a planet, discovery credits (once per system), Explorer rank (reset by the world-seed move, accepted by Andy), paint jobs (buy, wear, per ship, save, export/import), SAVE FILE export/import (incl. file from another seed: moved with a warning), TESTER speeds, install hint, galaxy map reach by fuel (cap 75 ly), the camera button, the sound fix (ambient audio session), Earth-like planets, the release page `about.html`, version v1.0.0.
5. Saves from EVERY past version must load through the real page path: universe v1, pre-F1, pre-4g (paint jobs), seed 777/other-seed saves, pre-import, and a fresh game. A crash on an old save already reached live once.
6. Performance (no phone is available to the agent): report real triangle counts for the system view with 10 planets and 3 docks (with rings, clouds, Earth-like), the floating scene, the galaxy map at the 75 ly cap (about 15,800 triangles, Agent 3 estimate), and the cockpit. Give Andy ONE short phone checklist to feel frame rate (Safari tab and installed app, upright and sideways) and to listen to a free-trip sound. If the 75 ly map is the slow spot, propose the cap or the cheaper star shape to the Lead, do not apply.
7. Balance on the real universe now: dock density, outposts, upgrades, paint jobs (500 each), discovery credits, free travel fuel use and Explorer income, with all five player types (planner, sensible, spender, casual, lazy) over at least 30 seeds incl. the world seed. Tell the Lead honest problems (for example casual players never reaching an outpost) with 2 or 3 options and numbers; do not apply.
8. Fix the known test problems if still present: flaky/slow tests (balance-sim now has a 30 s limit), the audio test, `agent6c` needing a real runner. Never weaken a check to pass.
9. Remove nothing and refactor nothing: this is QA. Real bugs: fix only if small, clearly yours (tests, scripts, save code you own) and cheap to verify; otherwise write each bug for the Lead with exact steps, the screen, and the likely owner agent.

## Allowed / not allowed
Allowed: tests (incl. tests/sim, offline harness), scripts, package.json scripts, workflows (say exactly what and why), README/WHERE-TO-LOOK, docs, small fixes in src/save you own. Not allowed: other layers' code, new features, balance numbers without Andy.

## Andy checks
Reads your short plain summary of what passed and what is broken; makes the decisions you list (with options); runs the ONE phone checklist (install, airplane mode, free trip, export, update note, sound, frame rate) and tells you what he saw.

## Order of work (suggested)
1. Offline harness and `npm run offline-check` (6f) against the real built game, then wire it into the checks.
2. Old-save and seed-lock tests through the whole path.
3. Regression pass of every screen at phone and desktop sizes, with long names.
4. Balance and performance numbers.
5. Reports, decision list for Andy, phone checklist.
