# Agent 7 brief, stage E1: rare Earth-like planets (render only)

You are Agent 7 (Polish). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/report-agent-7c.md (the planet look system: `src/render/planetlook.ts`, `/planets.html`), docs/GUIDE-visual-direction.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Anything visual: options A/B/C first, then a "matches / does not match" list. Explain technical words in one sentence. Report: docs/report-agent-7f.md. Combat never. NOTE: another Agent 7 chat may be working on the app icon and release page (docs/briefs/agent-7d-brief.md) at the same time: you only touch the planet look files and their tests; if a file clash appears, tell the Lead.

## Andy's request (2026-11-12)
Add Earth-like planets: blue oceans, green land, white clouds. Very special: only 2 to 3 percent of planets.

## Do
1. In the render-only look system (`chooseLook`, chosen from a hash of the planet id; NOTHING in `src/universe` may change, the fingerprint test must stay green), add an "Earth-like" look for about 2.5 percent of planets (measured over thousands of planets: say the real share, aim 2 to 3 %). Use its own independent hash, like the ring decision, so it does not change the other looks' shares much (rings stay ~8 %, surprising colours ~33 %: check and report before/after).
2. Look (options A/B/C first): deep blue oceans, green and brown-green continents (smooth noise like the 7c continents), maybe small white ice caps at the poles, and clearly more white cloud patches than other ocean/jungle worlds, so it reads at a glance as "a little Earth". Keep the PS1 colour steps and the game's four light steps. Never surprising hue shifts on these. No rings on Earth-likes (keeps them special). Honest note on night side: city lights are option C of 7c and NOT approved, do not add.
3. They can appear for any rocky-type planet whose type fits (say which types you use; an ocean/jungle-type planet is the natural fit; do not turn gas giants into Earth-likes). A planet's other properties (type, size, dock) are unchanged; this is only the picture.
4. Docked views: the Earth-like planet under an outpost or station must still follow the 7c rules (no rings, low clouds under stations, clouds not cutting through the pad). Check the floating scene, the system view, the title screen backdrop and the planets wall.
5. `/planets.html`: add a filter "only Earth-like" (like `?filter=rings`) and show the live count, so Andy can browse them.
6. Performance: triangles stay inside the 7c budget (report the worst case with clouds).
7. Tests: share within 2-3 % over a large sample; same planet id gives the same look; Earth-likes have no rings; fingerprint test green; `npm run check` green; Actions green.

## Allowed / not allowed
Allowed: src/render/planetlook.ts, systemview/docked/flight only where they pass look options (smallest edits), src/planets.ts and planets.html, render tests, docs. Not allowed: src/universe, src/game, src/save, src/ui, gameplay (no Earth-like bonuses), new features. Suggestion only (do not build): an "Earth-like" tag in the planet info card (Agent 5's area; ask Andy later).

## Andy checks
Open `/planets.html?filter=earthlike`: pick the option you like; scroll a few pages to see how rare they are; open a game seed and find one in a system view (it should feel like a little treasure); check the other planets still look as before.
