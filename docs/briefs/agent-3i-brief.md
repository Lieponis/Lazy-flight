# Agent 3 brief, stage N3b: longer, unique names fit the 3D screens (render)

You are Agent 3 (Rendering). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/plan-unique-names-world-seed.md, docs/report-agent-2c.md (sections 1, 3, 5, 6), docs/report-agent-3h.md, docs/report-agent-3g.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Anything visual: options A/B/C first. Explain technical words in one sentence. Report: docs/report-agent-3i.md. Combat never; no new features. Agent 5 does the menus and HTML texts at the same time (docs/briefs/agent-5h-brief.md): you only touch `src/render`.

## Situation
Names changed (Agent 2, live on main): systems "Kopipex 2N-83" (some pure like "Lazy Harbour"), planets "<system> II", docks have a short `name` and a unique `fullName`. Lengths: system up to 24 letters near home (42 far), planet up to 47, dock full name up to 75.

## Do
1. Find EVERY name printed or drawn inside `src/render`: galaxy map star labels (the HUD label set by starmap), system view labels and summary line ("10 planets, 3 docks: ..."), the cockpit screens (canvas textures: screenInfo, screenMap, screenFuel, screenRightWing, the ship-computer funny lines), docked and flight info, floating scene text, the planets wall (`src/planets.ts`), warp/arrival captions. Make long names fit: wrap or shrink to fit the canvas (never overflow or get cut mid-letter), keep the pixel font readable, and keep the code visible. Check on a phone-sized low-res canvas where letters are big.
2. Tour stops and routes shown on cockpit screens use dock/system names: test with the longest names (the worst-case lengths above).
3. Add pure, tested helpers for fitting text (width in pixels -> lines or shortened text) and a preview (a test page or an option on an existing preview, for example `?systempreview=1` or `?floatpreview=1`) that cycles through long and short names so Andy can see them. Also try pure-name systems (`Lazy Harbour` style: use `/debug.html` search or the first systems of seed 12345).
4. Keep performance and the triangle budgets unchanged. `npm run check` green; Actions green.

## Allowed / not allowed
Allowed: src/render, render tests, preview pages/code, docs. The smallest glue in src/ui/index.ts only if a name must come from there (say exactly what). Not allowed: src/universe, src/game, src/save, menus and HTML texts (Agent 5), new features.

## Andy checks
Open the cockpit view and the galaxy map: look at the longest names you can find (go far from home, use a pure-name system); labels must stay readable and inside their screens. Check the system view and the floating scene text.
