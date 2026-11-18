# Agent 8 brief: rough 2D sketches of 9 future ships (inspiration only)

You are Agent 8 (asset designer). Andy wants INSPIRATION, nothing in the game. Work on the CURRENT `main`. Read first: docs/WHERE-TO-LOOK.md, docs/STYLE-GUIDE.md, docs/GUIDE-visual-direction.md, docs/ASSET-CATALOG.md (the three ships we have: cargo-hauler, passenger-liner, scout; look at them in `/models.html` for the shapes, colours and mood), docs/report-agent-8-liveries.md. One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Explain technical words in one sentence. Combat never: no weapons, no guns, no turrets, no missiles on any ship (children friendly, relaxed, funny).

## Goal
Draw ROUGH 2D concept sketches of **9 future ships**, 3 groups of 3:
- **Cargo (3):** from a small van-like hauler to a big lumbering freight barge. Ideas for variety: stacked containers, a bulk-tank hauler, a flat-bed with strapped crates, a cargo ship with a silly tow hook.
- **Passenger (3):** from a small shuttle to a comfy cruise-liner. Ideas: a "bus" with rows of windows, a luxury yacht, a long-haul sleeper with funny details.
- **Explorer (3):** scouts for the empty spaces and the rim of the galaxy: big fuel tanks, antennas, dishes, sample pods, a tiny research dome. Long-range look (these are the ships that can eventually reach the far rim).
Each ship: a funny name (the game's voice: relaxed, silly, e.g. "Moon Biscuit Hauler"), role, size class (small / medium / large) and a one-line "personality". Same universe and style as the three current ships: low-poly, chunky, PS1 look, the same palette rules. The 3 current ships may appear as small size references in the contact sheet.

## Deliverables (all in `docs/concepts/ship-sketches/`, nothing anywhere else)
1. One SVG per ship (hand-built in code, flat simple shapes and straight lines, side view; add a small top view if it helps): `cargo-1.svg` ... `explorer-3.svg`.
2. ONE contact sheet `contact-sheet.html` (plain HTML + inline SVG, no scripts needed, readable on a phone) that shows all 9 with name, role, size, personality, plus the 3 current ships for scale. Send it to Andy as an attached file / private page and tell him how to open it (no hosting, no publishing to the game site).
3. A short `README.md` in that folder: what is where, what it means, and "inspiration only, not part of the game".

## Steps
1. Ask Andy at most 2 quick questions (for example: any ship ideas, shapes or colours he already imagines; anything he wants to avoid). If he says "just surprise me", skip.
2. Draw ONE ship per group (3 sketches), show A/B style options if useful, ask "matches / does not match".
3. Draw the other 6 in the chosen style; build the contact sheet; send it; ask which 2 or 3 he likes best and what to change (this is the end of this task).

## Not allowed
Everything outside `docs/concepts/ship-sketches/`: no code in `src/`, no 3D models, no catalog or asset entries, no tests, no workflow changes, no game text, no changes to the three existing ships. The "max 3 ships" rule of the game is untouched: these sketches are ideas for the future, not a decision to add ships. Do not label them as accepted; any extra idea you have is a "suggestion".

## Andy checks
Opens the contact sheet on his phone: which ships he likes, what to change. Nothing else.

## Report
`docs/report-agent-8-sketches.md`, short: what was drawn, where the files are, which ones Andy liked, anything he wants next.
