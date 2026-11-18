// THE FAINT GALAXY SKY BEHIND A SCREEN (system view, docked, flight).
//
// One place makes the sky layer and one place draws it, so every screen that shows it looks the same for the same system:
// the same builders, the same size and the same strength (`SYSTEM_SKY_*` in settings.ts). The system view has its own layer
// (it is prepared ahead of time for the star picked on the map); the docked and flight screens share a second one, which only
// they move, so a star picked on the map never changes the sky behind the ship.

import type * as THREE from "three";
import { SkyLayer } from "./galaxy/skylayer";
import type { SkyFunctions } from "./galaxy/universefield";
import { MAP_SKY_GLOW, SYSTEM_SKY_BUDGET_MS, SYSTEM_SKY_DOTS, SYSTEM_SKY_FAINT, SYSTEM_SKY_NEAR_SPACINGS, SYSTEM_SKY_SIZE, SYSTEM_SKY_STEPS } from "./settings";

/** A faint sky layer with the settings every screen shares. */
export function makeSystemSkyLayer(fns: SkyFunctions): SkyLayer {
  return new SkyLayer(fns, {
    faint: SYSTEM_SKY_FAINT,
    glow: MAP_SKY_GLOW,
    dots: SYSTEM_SKY_DOTS,
    faceSize: SYSTEM_SKY_SIZE,
    steps: SYSTEM_SKY_STEPS,
    nearSpacings: SYSTEM_SKY_NEAR_SPACINGS,
    budgetMs: SYSTEM_SKY_BUDGET_MS,
  });
}

/**
 * Draws the faint sky first (it only turns with the camera), then the screen's scene over it. Without a sky, or until the first sky is
 * built, it is exactly `renderer.render(scene, camera)`.
 */
export function renderWithSky(renderer: THREE.WebGLRenderer, sky: SkyLayer | null, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
  if (!sky || !sky.visible) {
    renderer.render(scene, camera);
    return;
  }
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.clear();
  sky.view.follow(camera);
  sky.draw(renderer);
  renderer.render(scene, camera);
  renderer.autoClear = autoClear;
}
