# Report: Agent 9, Space Ship Architect (9 ship concepts)

**To:** Project Lead · **From:** Agent 9 · **Date:** 2026-11-28
**Status:** DONE. **All 9 ships were approved by Andy** (2026-11-27 to 2026-11-28).
**Gallery** (all 9 ships on one page, with a ship switcher, rotate/zoom and part highlight/hide): `docs/concepts/ship-architect/gallery.html`. Andy also has it as a private link.
**Work area:** `docs/concepts/ship-architect/` only. **No game files were touched** (`src/` and the rest). Nothing in the live game has changed yet.

## 1. Summary
Andy and I designed 9 new ships, in three lines of three sizes. Each one went through reference images, questions, a 3D model, and rounds of Andy's feedback until he approved it.
- **Plain-grey models:** every ship is a 3D model in plain grey, built from separate named parts, so only the shape was judged.
- **Hand-over notes:** every ship has one for Agent 8, saying what Andy insists on keeping and how to fit it into the game.

| # | Ship | Class | Rounds to approval | Note / viewer |
|---|------|-------|-------------------|---------------|
| P1 | **Eggspress** | Passenger, small | ~8 | `passenger-1.md` · `passenger-1/viewer.html` |
| P2 | **Droopliner** | Passenger, medium | ~8 | `passenger-2.md` · `passenger-2/viewer.html` |
| P3 | **Snoozemarine** | Passenger, large | 4 | `passenger-3.md` · `passenger-3/viewer.html` |
| C1 | **Crate Expectations** | Cargo, small | 1 | `cargo-1.md` · `cargo-1/viewer.html` |
| C2 | **Haul Monty** | Cargo, medium | 3 | `cargo-2.md` · `cargo-2/viewer.html` |
| C3 | **Stacks McGee** | Cargo, large | 5 | `cargo-3.md` · `cargo-3/viewer.html` |
| E1 | **Pocket Rocket** | Explorer, small | 7 (one full restart) | `explorer-1.md` · `explorer-1/viewer.html` |
| E2 | **Wanderwedge** | Explorer, medium | 1 | `explorer-2.md` · `explorer-2/viewer.html` |
| E3 | **Halo There** | Explorer, large | 4 (one full restart) | `explorer-3.md` · `explorer-3/viewer.html` |

All files are in `docs/concepts/ship-architect/`.

## 2. Andy's rules (they should guide any future ship work)
- **Passenger:**
  - Windows and windscreens are flush and wrapped onto the hull. Andy rejected both "sunk in" and "floating".
  - Not low-poly, with plenty of detail.
- **Cargo:**
  - Industrial and more angular than the passenger ships.
  - Angular windshields.
  - No passenger windows.
  - Visible cargo and pilot door outlines.
- **Explorer:**
  - Wings, and a lifting body.
  - Engines as bulges built into the hull, not separate pods.
  - Exotic sci-fi, never like a real-world jet.
  - **No floating parts.**
- **Everywhere:**
  - Short, thick landing legs.
  - Level pads.
  - Struts that visibly go into the hull.
  - Lots of detail.

## 3. How it was checked
No screenshot tool was available, so every model was checked by measurement before Andy saw it:
- **Build check:** built with the real three.js library (0.170, the same as the viewer).
- **Integrity:** no errors and no broken geometry.
- **Flush check:** ray tests confirmed windows, doors and panels sit on the hull skin.
- **Ground check:** level pads, with nothing lower than them.
- **Attachment check** (added for the explorers): every part must touch or sit inside another part. All explorers pass 100%.

Andy's own eye was the final check. Several rounds were driven by things only he could see, such as proportions, stance and "too much like a real jet".

## 4. Decisions needed from the Lead (for discussion with Andy)
1. **Detail vs. the style guide.**
   - The approved style guide (`docs/STYLE-GUIDE.md`, section 10) asks for *minimal surface detail*, *no part thinner than 0.2 units*, and a ship budget of **1000 triangles, 4 meshes and 2 materials**.
   - Andy repeatedly asked for *more* detail in these sessions.
   - The concepts run from about 3.5k triangles (Wanderwedge) to about 73k (Snoozemarine), with 89 to 330 separate parts.
   - **Choose one:**
     - (a) keep the budget, and Agent 8 simplifies hard, moving detail into textures;
     - (b) raise the budget for ships;
     - (c) a two-level model: a detailed one for close-ups (hangar, cockpit view) and a simple one for the map.
2. **How 9 ships fit the game.**
   - The game currently has a small set of ship types (the style guide names `cargo-hauler`, `passenger-liner` and `scout`).
   - Decide whether the 9 become upgrade tiers within those three types (small, medium, large), new buyable ships, or replacements for the current models.
   - This affects prices, upgrades and saves (Agent 4 / Agent 6).
3. **Sizes.**
   - The concepts are at an arbitrary scale. The style guide's sizes are: scout 3–4 long, hauler 5–6, liner 6.5–7.5, and any ship 2.5–8.
   - Agent 8 must rescale each one. The Lead should confirm whether "large" ships may break the 8-unit limit, since the big cargo and big explorer would look best larger.
4. **Landing gear in a no-landing game.**
   - Landing on planets is out of scope for v1, but every concept has legs and Andy cared a lot about them.
   - Confirm where legs show: docked at outposts and stations, in a hangar view, and so on.
   - Halo There has a special nose-down parked pose. Its flight pose is level (`PARK_PITCH = 0`).
5. **Colours.** All concepts are plain grey on purpose. Colours, company marks and glowing engines come from the style guide palette in Agent 8's rebuild. Andy may want to approve the colours per ship.
6. **Funny touch.** The style guide mentions one small funny touch per model, but section 10 dropped it for ships. The ships have funny names and personalities in their notes. Decide whether the in-game models get a touch too.

## 5. Suggested next steps (suggestions, not yet agreed)
1. Settle the decisions above with Andy (one short session).
2. **Agent 8 rebuilds the ships one line at a time** in the game's style, following each note's "What to keep" and "For Agent 8" sections, and adds the anchors (`parking`, `eye`, `nose`, engines). The concepts have none.
   - Agent 8 can rebuild them from their notes alone, so the concept models don't need to be in the game.
   - Andy approves each rebuilt ship next to its concept, using the gallery.
3. Then Agent 4 handles prices and progression, and Agent 6 checks performance on phones (9 new ship models).

## 6. Tools left behind
- **Gallery builder:** `docs/concepts/ship-architect/gallery-tools/build_gallery.py` rebuilds `gallery.html` from the approved viewers. To add a ship, add one line to its list.
- The attachment and flush checks were run as scripts in the working session. They're described here, but not kept in the repo. **Suggestion:** if useful, add them as test scripts for Agent 8's rebuilt models.

## 7. Known issues and notes
- **None outstanding.** Andy approved every ship.
- **Copyright:** some references Andy sent were protected film or franchise designs (Pixar's XL-15, Marvel's Excelsior) or copyrighted concept art. None was copied. All 9 ships are original designs that take only general ideas from them. Keep this in mind if the references are reused.
- The concept files (`viewer.html`) load three.js from the internet (jsDelivr), like the rest of the review pages. They are review tools, not game code.
