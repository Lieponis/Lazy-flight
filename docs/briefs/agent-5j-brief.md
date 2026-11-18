# Agent 5 brief: two small UI items after the galaxy merge (lean)

You are Agent 5 (UI). Work on the CURRENT `main` (universe v3 is merged). Read only: docs/status.md (last 40 lines), docs/report-agent-5i.md (section 2, the texts), `src/ui/jobsmenu.ts`, the map HUD files you find by searching for "starLabelText" / "starmapHint". One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH), at most 4 steps. Saving Andy's usage matters: no extra reading, no extra checks. Combat never. Report: docs/report-agent-5j.md (short).

## Do
1. **Empty-board hint for a player without a ship with seats.** QA found a player who never buys a ship waits 12.5 of 30 hours because many jobs need passenger seats and the starter Cargo Hauler has none. When the board has jobs that need cabin seats (look at the block reason in `BoardEntry`) and the current ship has none, show one friendly line in the board message box, in the game's voice (for example: "Folks here want seats. A ship with a cabin could take these. Try the SHIPYARD."). Show it also when the board is otherwise empty for that reason. Propose 3 wordings A/B/C to Andy; he picks. Text lives in `src/ui`; do not change game logic.
2. **Legend under the map hint:** one short line that says a diamond is a star this ship can reach (and pixels are farther stars). Wording A/B/C; fits narrow phones; never covers the tapped-star label.
3. Tests for both texts (`tests/ui*.test.ts`), `npm run check` green. Do not touch `src/render/flight.ts`.

## Allowed / not allowed
Allowed: `src/ui`, ui styles, tests for ui, docs. Not allowed: `src/game`, `src/universe`, `src/save`, `src/render`, workflows.

## Andy checks
Phone screenshots of the board message with the new line (use the existing test saves or a developer link; tell him how) and the map legend.
