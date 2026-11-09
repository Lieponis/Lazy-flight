# Cockpit design brief (C0) - approved answers

Status: APPROVED by Andy. View only: no steering, no free flight, no combat.

## Look
- **Frame/window:** half and half. Chunky real-cockpit frame, visible dashboard at the bottom, window about half the screen.
- **Window shape per ship (Andy: "as written"):** Hauler = several flat panes with struts; Liner = one wide panoramic strip; Scout = rounded canopy.
- **Layout:** same bones for all three ships (dashboard position, seat positions), different frame, window and dashboard styling. Hauler wide and practical, Liner elegant, Scout cramped.
- **Dashboard:** busy: many switches, dials, blinking lights. Funny labels allowed on panels.
- **Outside view:** space only. No nose, wings or other part of the player's own ship visible.
- **Light:** dark cockpit with glowing teal and amber screens; a small warm lamp over the dashboard/dog seat; light coming in through the window takes the colour of the nearest planet. No real-time lights (colour done with material tints).
- **Motion:** gentle sway in flight; shake in the warp and at arrival (settings in `settings.ts`).

## Information on the panels (information only, no controls)
Destination name, time left, fuel, next stop (tours: list of stops), and a small route map: start system, destination and stops, with a moving dot for the ship. Must stay readable on a phone.

## Co-pilot
A low-poly dog, in the second seat, on the Cargo Hauler and Passenger Liner only (the Scout is cramped, no dog). Behaviour: sleeps during long trips. Original design, not a known character.

## Budget
Up to 2000 triangles per cockpit interior, dog included. Few meshes, one material each where possible (as the ship rules). Check on phone early.

## Agents and checks
Stages and approvals as in docs/ROADMAP-cockpit.md (C1 Agent 8 interiors in the viewer, "Sit inside" mode; C2 Agent 3 integration; C3 Agent 5 panel info/route map; C4 pixel look; C5 QA).

## Notes from the Lead
- Dog scope: Andy chose "sleeps" only; waking/tail/head movement are NOT included (suggestion, kept as a suggestion by Andy).
- 2000 triangles is above the 1500 I suggested; Phone speed is the risk, so C2 must report frame rate and the cockpit may need trimming.
- Route map shows tour stops as a list because tours fly straight to the last stop.
