# Style guide for ships, outposts and stations (Agent 8, stage S0)

Status: DRAFT, waiting for Andy's approval. The numbers live in code: `src/render/assets/palette.ts` and `src/render/assets/style.ts`. The same guide is shown with pictures on `/models.html` (the "Style guide" tab).

## 1. The look in one paragraph
Cozy, toy-like, PS1-era low poly: a "downgraded Elite Dangerous". Believable sci-fi ships, simplified to bold silhouettes and big colour blocks that still read at 320 x 180 pixels. Space stays near-black; planets bring the colour. Every model has exactly one small funny touch (a mismatched pink panel, a crooked antenna, a crate strapped on). Never gritty, never anything that looks like a weapon.

## 2. Palette
- **Hull family** (cool lavender greys, as in the game today): hull white `e3e7ff`, hull light `c9d0f2`, hull mid `8d99c9`, hull dark `5a6290`, frame `3a3f66`.
- **Toy accents** (2 or 3 per model, in big blocks): cargo orange `ff8a3d`, teal `3dd6c6`, hazard yellow `ffd23d`, toy red `e8483a`, solar blue `4fa8ff`, oops pink `ff7fae` (only for the joke panel), old rust `a8643c`.
- **Glow** (never shaded): window `fff0b8`, engine `ffb347`, red light `ff5a3c`, green light `7dff8a`, glass `9fe6ff`.
- **Planet tint (outposts):** the planet's primary colour, made safe (saturation 35-80%, lightness 40-65%) so it never vanishes in the dark or turns neon, plus a darker partner (lightness x 0.65) for trims. Only roofs, ground plates and stripes are tinted, at most about a third of the surface. Windows, lights, glass and engines are never tinted. Stations stay in hull colours (they are made in orbit, not on the planet).

## 3. Shading
The game's flat look: every face gets one of four brightness steps (100%, 83%, 70%, 59%) from one fixed light direction (`shadedGeometry` and `faceShade` in src/render). The steps are baked into vertex colours, so no lights are needed and phones stay fast. Glow parts are not shaded.

## 4. Size scale (one unit system for everything)
1 unit = one standard cargo crate (about 2 m). Pilot about 0.9 tall. Scout 3-4 long, Cargo Hauler 5-6, Passenger Liner 6.5-7.5 (any ship 2.5-8). Landing pad 9 wide (fits every ship). Outposts 8-28 across, pad included. Station bay 9 wide, 4 tall, 9 deep. Stations 16-48 across. No part thinner than 0.2 (thinner parts vanish at game resolution).

**Orientation:** +Y is up. Ships point their nose to -Z (as in ship.ts). Ship and outpost origin = the parking point on the ground (y = 0). Station origin = station centre.

## 5. Budgets
| Kind | Triangles | Meshes | Materials |
|---|---|---|---|
| Ship | 700 | 4 | 2 |
| Outpost | 1500 | 6 | 2 |
| Station | 2500 | 6 | 2 |
Defaults from ASSET-PIPELINE.md kept. Meshes added as a limit because each mesh is a separate draw call on a phone. In practice a model is 1 body mesh plus small meshes for blinking lights, flames and a spinning ring, all sharing 1 material.

## 6. Silhouette rules
One big main shape you can recognise as a black outline; at most 2 or 3 secondary shapes. Each ship class must look different from the top and from the side (boxy hauler, long liner, small swept scout). Nothing important smaller than a fifth of a crate.

## 7. Lights and motion
Blinking lights: 2 s cycle, on 1.2 s, two groups (A and B) take turns. Station rings: about one turn per minute (never faster than 0.2 radians per second). Engine flames: short when parked, 1x in flight, up to 3x in warp. No other per-frame work.

## 8. Anchors (named points other agents use)
Ships: `parking`, `eye`, `nose`, and `engineL` + `engineR` or `engineMain`. Outposts: `parking`, `beacon`, `entrance`. Stations: `parking`, `dockEntrance`, and `spinAxis` if it spins.

## 9. Naming
IDs are lowercase words joined by hyphens, matching the existing ship id `cargo-hauler` in src/game/ships.ts (the code wins over the brief's underscore example). Proposed: `passenger-liner`, `scout`, `outpost-<name>`, `station-<name>`. An ID never changes once integrated.
