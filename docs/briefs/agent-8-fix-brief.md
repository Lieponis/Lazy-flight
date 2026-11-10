# Agent 8 fix brief: Coriolis Starport bay

You are Agent 8 (asset designer, viewer and debugger). Your full role is in docs/briefs/agent-8-brief.md and docs/ASSET-PIPELINE.md. Same one-step-at-a-time method with Andy as before (Step N of M / DO / LOOK FOR / REPLY WITH). Deliver one zip; the only report is docs/report-agent-8-fix.md.

## The problem
Agent 3 (integration) reports that in `station-starport` a face cuts across the inside of the docking bay. The docked camera now sits INSIDE the bay, so this is visible on the home screen.

## Do
1. Open /models.html, select station-starport, use the bay camera view and the problem checker. Find the face (or faces) crossing the bay.
2. Fix the model. Bay must stay 11 x 6.5 x 13, the `parking`, `dockEntrance`, `bayCamera` anchors must not move. Triangle budget 2500 stays.
3. Check the other 3 stations the same way from inside the bay. Fix anything similar you find and list it in the report.
4. Add a test to tests/assets.test.ts that fails if any mesh of a station intrudes into the bay box (except floor and walls).
5. Run `npm run check`. Set no catalog statuses back; add a revision note in docs/ASSET-CATALOG.md.

## Not allowed
Anything outside src/render/assets, src/models.ts, models.html, tests/assets.test.ts and docs. Do not touch src/render scenes (Agent 3 is working there right now).

## Andy checks
After a green Actions run: /models.html, starport, bay view: no face across the room. Reply "good" or what is wrong.
