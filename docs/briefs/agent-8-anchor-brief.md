# Agent 8 brief: small task, screenRightWing anchor

You are Agent 8 (asset designer, viewer and debugger). Work on the CURRENT `main`. Read docs/WHERE-TO-LOOK.md, docs/status.md, docs/report-agent-3-c2b.md (section 4.2) and docs/report-agent-8-c1.md. The only report is docs/report-agent-8-anchor.md (short). Same one-step-at-a-time method with Andy, but this task is small: do not rework anything decided.

## Do
1. Add a `screenRightWing` anchor to the base cockpit (`src/render/assets/cockpitBase.ts`): position, direction (into the cabin) and size of the right wing's screen, the mirror of `screenFuel` across the cockpit's middle line. Agent 3 currently places its picture there using a hard-coded mirrored offset (`COCKPIT_CENTRE_X` 0.6 in `src/render/cockpitscreens.ts`).
2. Check it in the viewer (anchors view) and add it to the anchor tests in tests/assets.test.ts.
3. Update docs/ASSET-CATALOG.md and docs/INTEGRATION-cockpit.md (anchor list).
4. Tell the Lead exactly what Agent 3 must change to use it (one small follow-up, do not edit `cockpitscreens.ts` yourself).
5. `npm run check` must pass. Push to main if you have GitHub access.

## Deferred by Andy (do NOT build): sleeping dog, warm lamp, window light, per-ship cockpits.

## Andy checks
Viewer (`/models.html`, cockpit base, anchors on): the new anchor sits on the right wing screen. Reply "good".
