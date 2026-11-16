# Feasibility check: spiral-disc galaxy (Andy's request 2026-11-16)

Status: ANALYSIS ONLY. Nothing approved or built. Lead owns this file. Numbers are the Lead's own arithmetic (python, same day); real timings need a prototype.

## Andy's spec
Fixed number of systems; spiral (vortex) shape; flat disc ("pancake"), 100,000 ly across; spacing 2-8 ly in the centre growing to 150-170 ly at the edge; some systems randomly closer or farther than their place says. Map: reachable systems = diamonds (a bit smaller); out-of-reach systems = coloured pixels, brighter when close, dimmer when far.

## Verdict
FEASIBLE, but it is a rebuild of the universe, the map and the economy, not a tweak. Roughly 6 to 8 agent stages. Three things need a design decision first (section 3).

## 1. Universe side (Agent 2)
- Shape: easy. Density becomes a function of (distance from centre, angle, height): spacing curve + spiral arms (log-spiral cosine modulation) + disc thickness (thick bulge, thin rim). Deterministic, nothing stored.
- Now vs new: today the density is flat, about 1 system per 1,000 ly3 (spacing about 9.7 ly everywhere, cube cells of 10 ly). New: centre 5 ly spacing = 0.008 systems/ly3 = 8 per 1,000 ly3 (about 7x denser); 2 ly spacing = 100x denser; edge 160 ly = 0.00000024 per ly3.
- A fixed 10 ly cube grid does NOT work any more: at the edge a cube would hold 0.00024 systems (millions of empty cells to scan). Needs cells whose size follows the density (zones with bigger cells towards the rim, or an octree). Doable, deterministic, but the id scheme, the system code in the names, `getSitesInSector`, `listSitesNear`, `systemIdOf` all change.
- "Fixed number of systems": with this method the total is a fixed EXPECTED number (set by the density curve), within a tiny random error (cell count = floor(expected + hash)); it is not an exact integer unless we add a global correction. Is "about N" good enough?
- "Some systems closer or farther": easy: a few percent of systems get their own random offset or form small clusters, decided per system by its hash.
- Total systems with Andy's spacing (disc 100,000 ly across, spacing 5 ly to 160 ly):
  - smooth exponential spacing curve, thickness 2,000 ly at centre to 500 ly at rim: about 2 billion
  - same with centre spacing 2 / 3 / 8 ly: 20 / 7 / 0.6 billion
  - spacing grows linearly instead (dense only near the centre): 60 to 300 million
  So "fixed number" can be picked freely between roughly 60 million and 20 billion by choosing the curve. Names stay short (codes of 6 to 8 characters).
- Spinning: if it only means the SHAPE looks like a spiral, easy. If stars really orbit (positions change with time) it breaks everything (saves, job destinations, names, determinism): NOT recommended. A slowly rotating backdrop that is only a picture is fine.
- Cost per query: counting systems around a point stays cheap if enumeration is by cells near the point. At the centre there can be thousands of systems within a job's 25 ly (see table), so jobs must pick destinations by SAMPLING cells, not by looping over every system.

## 2. Map side (Agent 3)
Systems near you (spacing 5 ly) within reach:
| spacing | within 25 ly | within 55 ly (Scout full tank) | within 75 ly (map cap) |
|---|---|---|---|
| 2 ly | 8,000 | 87,000 | 220,000 |
| 5 ly | 520 | 5,600 | 14,000 |
| 8 ly | 130 | 1,400 | 3,500 |
| 160 ly | 0 | 0 | 0 |
- Diamonds: thousands of separate objects are too heavy for a phone, but the same shape drawn as ONE instanced mesh (a single draw call) is fine up to about 10,000 diamonds. Above that, draw reachable systems as small diamonds only for the nearest few thousand and as pixels beyond (rule: the sprite budget decides).
- Tapping a star among thousands: needs a spatial index or a picking pass (doable; the pointer already works by picking).
- Pixels: one GPU "points" draw call, brightness from distance (smaller and dimmer with distance). 30,000 to 60,000 points are fine on phones. At a 5 ly centre, 30,000 nearest systems fill a sphere of only about 96 ly radius, so "visible universe in the direction of view" can NOT be every real system. Proposed layers:
  1. Reachable: real systems, diamonds (up to the reach, cap about 80 ly).
  2. Near field: real systems as pixels (the nearest N systems, N about 30,000 to 60,000, chosen by distance and view direction): every pixel is a REAL system you can fly to later.
  3. Far field: a shader-drawn glow of the galaxy (spiral arms, bulge) that is NOT individual systems (billions cannot be enumerated). Looks right, but a pixel there cannot be selected.
  A fully consistent "every visible pixel is a real selectable system out to 100,000 ly" is possible only with a hierarchical "importance" scheme (each system has a brightness rank, coarse cells emit only their brightest) = research-grade; not recommended for v2.
- Generation time: listing 30,000 to 60,000 systems around you must be quick (cache, build once per move, chunked over frames). Needs a prototype to measure on a phone.

## 3. Game side, the serious risks
1. **Edge strand:** at the rim systems are 150 to 170 ly apart but ships reach 30 to 82 ly. A player at the rim could NEVER reach another system, not even with emergency fuel. Options: (a) start and play only in the central region, rim is scenery to look at; (b) longer-range ships/upgrades (jump drive, 200+ ly) as late progression; (c) refuelling stations between; Needs Andy's choice. Today's shared world seed means everyone starts at one place: choose a start region with good spacing (like the Sun's place about 26,000 ly out) or at about 4 to 8 ly spacing.
2. **Economy:** at 2 to 5 ly spacing a 25 ly job radius holds hundreds to thousands of docks: trips become 4 to 20 fuel and a few seconds; pay and time need a rebuild (Agent 6 balance). At the rim jobs within 25 ly would be zero. The job radius probably has to scale with local density (or be count-based: the 6 to 12 nearest docks).
3. **Everything keyed on ids and positions changes** (UNIVERSE_VERSION 3): system ids and codes, names (the code encodes the old grid), dock ids, outposts, explored lists, planet looks (hash of planet id), job boards, the start dock, universe fingerprint tests, `/debug.html`. Every save moves with the "move + refund" rule again (credits, ranks, ships, upgrades kept).
4. **Explorer rank / discoveries:** with billions of systems, 50 and 200 discoveries still work; the save caps at 20,000 explored systems (at 5 ly spacing an explorer gets there in a few days: raise the cap or compress).
5. Docks: with 100x more systems the number of docks near you explodes; the 1 to 3 docks per system rule may need to drop to 1 for most systems to keep boards sensible.
6. Free travel limited by fuel: at the centre a full tank reaches 5,000 to 80,000 systems. Fine, but the map must handle it (section 2).
7. Planet counts etc. unchanged (planet generation per system stays).

## 4. Proposed approach if approved
- G0 Lead + Andy: decisions (section 5), spacing curve, start region, rim rule.
- G1 Agent 2: prototype of the density function and variable cells (pure logic, charts of counts, timings, collisions of ids, 10-million-system sample), plus the new id/code scheme. No game changes. Go/no-go with real numbers.
- G2 Agent 3: map prototype (instanced diamonds, points layer, far glow) with the prototype data on a phone: measure frame rate. Go/no-go.
- G3 Agent 2: full universe v3 into main behind a version; names and fingerprints.
- G4 Agent 4: jobs by sampling, job radius rules, fuel and ship range, save migration (move + refund), explored cap.
- G5 Agents 3 and 5: map for real, labels, picking, UI.
- G6 Agent 6: balance (economy), QA, offline tests, phone checks.
Each stage ends with a live build you verify. Stages G1 and G2 can run in parallel (different files).

## 5. Decisions needed from Andy
1. Is "about N systems" (N from the curve) enough, or an exact number? Which total do you like (60 million, 2 billion, 20 billion)?
2. Does "spinning" mean spiral shape only (recommended), or really orbiting stars?
3. Where does a new player start (centre-ish with 4 to 8 ly spacing, or a Sun-like place)? And what is the rim for: scenery only, or reachable with a late long-range ship?
4. Pixels: is it acceptable that far pixels are a drawn glow and only the nearest tens of thousands are real selectable systems?
5. Job reach: keep 25 ly or "nearest docks by count" so every region has jobs?
6. Timing: do this after QA and before or after the "big change" you mentioned.

## 6. ANDY'S DECISIONS (2026-11-16)
1. Total: about 20 billion systems. (Exponential spacing curve from about 2 ly at the centre to 160 ly at the rim, disc thickness 2,000 ly at the centre to 500 ly at the rim gives about 2.0e10: Agent 2 fits the curve to land within roughly 15 to 25 billion.)
2. Spinning = spiral shape only. Stars do not orbit. (A purely visual slow turn of the far glow is NOT requested.)
3. Start: one third of the way from the centre to the rim (about 16,700 ly from the centre). Local spacing there is about 8.6 ly (very close to today's 9.7 ly), about 2,800 systems within 75 ly, and the nearest 10,000 systems lie within about 115 ly.
4. Map: the first (nearest) 10,000 systems are real and tappable; everything beyond is an almost invisible back-drop of faint pixels (not tappable). Reachable systems stay diamonds, a bit smaller than now.
5. Jobs: destinations are the NEAREST DOCKS BY COUNT (not a 25 ly radius), so every region has jobs.
6. Timing: this IS the "big change". The full QA (docs/briefs/agent-6g-brief.md) is paused; run it AFTER the galaxy is built (QA would otherwise test code that is about to be replaced).

## 7. Still open (Lead flags; decide after the prototypes)
- The rim. With the curve above, system spacing equals the ships' full-tank range at: 30 ly (Hauler) at 62 % of the radius (about 31,000 ly from the centre), 55 ly (Scout) at 76 %, 82 ly (best upgraded Scout) at 85 %. Beyond that a player cannot hop to the next system. Because the start is at 33 %, normal play is safe, but exploring outward ends at about 60 to 85 % of the radius. Options later: late long-range ship / jump drive upgrade, or leave the outer rim as a view-only edge (the map shows it, the game warns). Andy decides after seeing the prototype.
- How exactly job destinations are picked when there are thousands of docks nearby (nearest N by count, distance limit by fuel) = Agent 4 in the game stage.

## 8. Stages (approved to start G1 and G2 in parallel as PROTOTYPES, nothing merged into the game)
- G1 Agent 2: prototype of the galaxy generator (brief docs/briefs/agent-2d-brief.md). Branch `galaxy-proto`, never merged to main.
- G2 Agent 3: prototype of the map rendering with stand-in data (brief docs/briefs/agent-3j-brief.md); a separate preview page only (merge allowed because it does not touch the game).
- Go/no-go meeting with Andy after both reports. Then G3 Agent 2 (universe v3 in main), G4 Agent 4 (jobs by count, fuel/range, migration), G5 Agents 3/5 (real map, UI), G6 Agent 6 (balance, QA, offline tests, phone).
