# Plan: one shared world seed + globally unique names

Status: APPROVED by Andy 2026-11-13 (answers: style B codes, "system <name>" style, everything unique). Lead owns this file.

## Andy's decisions
1. ONE shared, non-changeable seed for everyone ("world seed"). Reason: future players or testers must never be stranded in a private universe no one else can visit; multiplayer stays out of v1, but the design must be ready for it. Lead's choice of value: keep 12345 (today's default), so existing saves on seed 12345 keep working.
2. Names never repeat in the whole universe. Code style B, like "Kopipex 4F-92". Some systems may have pure word/name/nickname names, still unique.
3. Planets are named in "<system name> II" style. EVERYTHING must be unique (systems, planets, docks). Standalone planet nicknames ("Big Marge") are retired as names; they may live on as flavour text elsewhere (Lead suggestion, not approved).

## Rules
- Names are derived from the system id (position) so they are unique by construction. A name must come from its OWN random streams so that nothing else in the universe (planets, docks, goods, prices, jobs) changes: the "universe fingerprint" except for names must stay identical.
- Because names are not part of saves (saves store ids), saves on seed 12345 stay valid. Only the names the player reads change.
- Saves with a different seed (old tests, "New random universe") cannot be part of the shared world: they are moved to the world seed with the existing "move + refund" rule (credits, ranks, ships, upgrades kept; job cancelled; outposts refunded; explored list cleared; the message "The universe was rebuilt. Your credits and ships came with you.").
- `?seed=NUMBER` stays only as a DEVELOPER tool: it works only together with `?dev=1` (or on the developer pages). A normal player cannot change the seed. The menu entry for a random new universe is removed.
- Imported save files with another seed go through the same move + refund path (the 6e import already warns about a different seed).

## Stages (one at a time; each verified by Andy)
- N1 Agent 2: `WORLD_SEED` constant and unique names in `src/universe` (brief docs/briefs/agent-2c-brief.md).
- N2 Agent 4: lock the seed in `src/save` / `src/game`: planStart, seed from address only with dev flag, move + refund for other seeds, remove random new universe in the logic, tests, game-debug.
- N3 Agents 5 and 3 (parallel, different files): menu entry removed, longer names fit everywhere (planet card, Jobs, Map labels, HUD, cockpit screens, Shipyard, floating scene), tests; check phone widths.
- N4 Agent 6 (optional): QA of the above.

## Risks
- Longer names may overflow small screens (cockpit canvases, phone cards): N3 must check every place that prints a name.
- Developer pages and test links used `?seed=`: agents must now add `&dev=1`.
- Pure-word names must be unique in an endless universe: handled by giving each curated name exactly one owner system (a fixed rule), not by checking against the whole universe.
