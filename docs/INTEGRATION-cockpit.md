# Base cockpit: technical notes for integration

Written by Agent 8 at the end of stage C1 (2026-11-10), as reference material for the Lead. Andy approved steps 1 to
5 of the base cockpit. These notes describe how the cockpit could (1) go into the game's flight view and (2) show the
trip information on its screens. They are not job assignments: the Lead decides who does what, when, and in which
order.

## What exists

| File | What it is |
|---|---|
| `src/render/assets/cockpitBase.ts` | The base cockpit model: `buildCockpitBase()` and the entry `COCKPIT_BASE_WIP` (id `cockpit-base`). One cockpit for all three ships, for now. |
| `src/render/assets/lens.ts` | `CockpitLens`: draws a scene through a light Panini lens (no stretched edges). `COCKPIT_FOV = 70` (degrees side to side), `COCKPIT_LENS = 0.35`. Andy chose this view (option C). |
| `src/render/cockpit.ts` | The OLD flat cockpit overlay the game uses today (struts drawn on top of the view). Replace it with the new model in cockpit view. |
| `src/render/flight.ts` | `FlightScreen`: the flight scene, its camera (`fov 50, near 0.05`), orbit and cockpit view modes (`placeCamera`), and the HTML trip read-out (`updateHud`). |
| `src/render/index.ts` | The main loop: `renderer.render(active.scene, active.camera)` every frame. |

Check the model at any time in the viewer: `/models.html?asset=cockpit-base&sit=1` ("Sit inside").

## The model's rules (do not change without Andy)

- **Frame:** origin = the pilot's eye; looking along -Z; up = +Y; 1 unit = 1 crate (about 2 m), the same unit as all models.
- **Size:** 3.36 wide x 2.25 high x 3.6 long; about 2,400 triangles; 4 meshes (body, throttle, small lever, indicator
  lights); ONE material (vertex colours, `MeshBasicMaterial`, both sides drawn: the walls have no thickness).
- **Window:** holes cut in the curved roof. Space (stars, planets) shows through them because it is in the same scene.
- **Anchors** (in the returned `group`'s space):

  | Anchor | Meaning |
  |---|---|
  | `eye` | (0, 0, 0), looking (0, 0, -1) |
  | `screenInfo` | the screen straight ahead of the pilot |
  | `screenMap` | the middle screen |
  | `screenFuel` | the amber screen on the pilot's (left) wing |
  | `screenRightWing` | the right wing screen: the exact mirror of `screenFuel` across the cockpit's middle line (added 2026-11-10) |

  Each screen anchor has `pos` (the screen's middle), `dir` (pointing into the cabin, towards the pilot) and `size` `{ w, h }` in crates.

- **Moving parts:**
  - `model.update(t)` (t = total seconds since start, not frame time) makes the ~90 indicator lights flash. It is
    cheap: it only rewrites one small colour buffer.
  - `model.animation.levers` = the throttle and a small lever; each can be turned around its `axis` by up to `maxAngle`.

## Part 1: putting the cockpit into the flight view (how it could be done)

1. **Build it once** in `FlightScreen`: `const cockpitModel = buildCockpitBase();`. Keep its group in a holder object
   (`cockpitRig = new THREE.Group()`) added to the scene. Hide the old overlay in cockpit mode (`this.cockpit.group.visible = false`
   or remove `buildCockpit` from flight.ts once Andy has seen the new one).
2. **Place it** in cockpit mode (`placeCamera`, the `else` branch): put `cockpitRig` at the camera's eye spot BEFORE the
   pitch and the shake are added (same position as `camera.position` there, no rotation). The camera then pitches and
   shakes inside the cockpit, which looks natural (the cockpit stays level, the view tilts).
   Do not make the cockpit a child of the camera: it would tilt and shake with the view and look glued to the screen.
   Hide `cockpitRig` in orbit mode.
3. **Draw through the lens** in cockpit mode. Give the `Screen` interface an optional `render(renderer)`; in
   `index.ts` call `active.render ? active.render(renderer) : renderer.render(active.scene, active.camera)`.
   In `FlightScreen.render`: cockpit mode → `this.lens ??= new CockpitLens(renderer); this.lens.render(this.scene, this.camera, COCKPIT_FOV)`;
   orbit mode → `renderer.render(this.scene, this.camera)`.
   - The lens takes the camera's position and direction but uses its own field of view (70 degrees side to side), so
     the orbit-mode "fit the ship" FOV logic does not apply in cockpit mode. Keep `camera.near` at 0.05 (the dashboard
     is about 0.6 crates from the eye).
   - The lens draws at the renderer's current size, so the low-resolution pixel look is kept.
   - Call `lens.dispose()` when the flight screen is thrown away.
4. **Animate:** every frame `cockpitModel.update(this.clockT)`.
   Suggestion (ask Andy): push the throttle forward with the trip:
   ```ts
   lever.object.quaternion.setFromAxisAngle(lever.axis, angle);
   ```
   where `angle` = `maxAngle` times 0 when docked, rising during LAUNCH to 1 in WARP, back to 0 during APPROACH.
5. **Same cockpit for every ship for now.** The ship's own `eye` anchor is only used to place the camera; it does
   not change the cockpit.
6. **Check:**
   - `npm run check` passes.
   - Play a trip in the browser (desktop and a phone-sized window) and press "Cockpit view".
   - Look for: no stretched edges, the space scene visible through the roof window, lights flashing, a smooth frame
     rate on a phone.
   - Send Andy the link.

## Part 2: showing the trip information on the screens (how it could be done)

Today the trip information is HTML text over the view (`updateHud` in flight.ts: destination, arrival countdown and
clock time, phase name, a "computer" line, progress bar). The screens should show it in the cockpit instead (ask
Andy whether the HTML read-out stays as well).

1. **One small canvas per screen**, drawn at pixel-art resolution:
   - `screenInfo` and `screenMap`: about 96 x 112 pixels.
   - `screenFuel`: about 96 x 64 pixels.
   - At the game's 320 x 180 picture a screen is about 90 pixels wide, so more pixels are wasted.
   - Make a `THREE.CanvasTexture` with `magFilter = minFilter = THREE.NearestFilter`, `colorSpace = THREE.SRGBColorSpace`
     and `generateMipmaps = false`.
2. **Place a plane on each anchor:**
   ```ts
   const a = cockpitModel.anchors.screenInfo!;
   const plane = new THREE.Mesh(new THREE.PlaneGeometry(a.size!.w, a.size!.h), new THREE.MeshBasicMaterial({ map: texture }));
   plane.position.copy(a.pos).addScaledVector(a.dir, 0.003); // a hair in front of the glowing screen
   plane.lookAt(plane.position.clone().add(a.dir)); // the plane faces the pilot
   cockpitModel.group.add(plane); // the anchors are in this group's space
   ```
   "Up" on all three screens is +Y; the screens are upright. The pilot's right is `up x dir`.
3. **What to draw** (big, simple, few words; no real text is needed elsewhere in the cockpit):
   - **Info** (teal background `#1f8a80`):
     - `TO <destination name>`;
     - the arrival countdown;
     - the phase (LAUNCH / WARP / APPROACH);
     - the next stop, if the game has one.
   - **Map** (teal): a simple route. Origin dot, destination dot, a line between them, and the ship marker at
     `elapsedSeconds / totalSeconds` along it. Stars as single pixels.
   - **Fuel** (amber background `#c07a22`):
     - a bar of fuel left / tank size, plus the number;
     - fuel is not in `FlightInfo` today: add `fuel` and `fuelMax` to it (from the game state: `state.fuel` and the
       ship's `fuelTankSize`), filled in where the flight starts.
   - Text in a light colour (`#e3e7ff`) or cyan (`#3fe0ff`). Use the game's retro pixel font if Agent 5 made one,
     otherwise a small monospace font, with `ctx.imageSmoothingEnabled = false`.
4. **Redraw only when something changes**, about 4 times a second like `updateHud` (`texture.needsUpdate = true`
   after drawing). Never every frame: phones.
5. **Phones:** the three planes add 3 meshes and 3 materials. That is fine; if it ever matters, put the three canvases
   side by side in one canvas (one texture, one material) and give each plane its part of it with UVs.
6. **Check:** in cockpit view the information is readable at the game's pixel size on desktop and on a phone, and the
   fuel and the countdown change during the trip. Show Andy, one screen at a time if he wants changes.

## Not built yet (Andy deferred them)

- **`windowLight` anchor and mesh:** planet-coloured light coming in through the window. The cockpit checker asks for
  it, which is why the viewer shows "Missing anchor windowLight" and why the cockpit is still in the viewer's
  reference group (DRAFT) instead of the registry. Before moving it into the registry, either build this (Agent 8,
  with Andy) or ask Andy to drop the rule.
- **The sleeping dog and the small warm lamp** (dog in the co-pilot seat on the Hauler and Liner only, per the brief).
- **Per-ship cockpit differences:** all three ships use this one base cockpit for now.

## Known limits

- **Window:** Andy's three drawn views of the window disagree with each other; Andy chose that the front view leads (option C).
- **Dashboard:** it sits at the drawing's height and covers a thin strip at the bottom of the window, as Andy chose.
  Seats also hide small parts of the window when you look sideways; both are marked "may cover window" for the checker.
- **Roof shading:** small zigzag shading steps on the curved roof (the game's four-step face shading).
- **Budget:** about 2,400 triangles. That is over the old roadmap's 2,000 but inside the 3,000 the Lead set for this
  restart.
