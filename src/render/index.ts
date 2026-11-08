// Front door of the render layer. Starts the two screens (starmap and system view) and the frame loop.
//
//   import { startRender } from "./render";
//   const api = startRender(renderer, document.getElementById("app"));
//   api.state.get().selectedSystemId   // star selected on the starmap
//   api.state.get().selectedPlanetId   // planet selected in the system view
//   api.state.subscribe((s) => ...)    // be told when something changes

import type * as THREE from "three";
import { getSystem } from "../universe";
import { Hud } from "./hud";
import { parseSeedParam } from "./helpers";
import type { Screen } from "./screen";
import { START_SEED } from "./settings";
import { findStartSystem } from "./start";
import { StateStore } from "./state";
import { StarMapScreen } from "./starmap";
import { SystemViewScreen } from "./systemview";

export { StateStore } from "./state";
export type { RenderState, ScreenName } from "./state";

export interface RenderApi {
  state: StateStore;
  showStarmap(): void;
  showSystem(systemId: string): void;
}

export function startRender(renderer: THREE.WebGLRenderer, parent: HTMLElement): RenderApi {
  const seed = parseSeedParam(window.location.search, START_SEED); // suggestion: ?seed=777 in the address
  const current = findStartSystem(seed);
  if (!current) throw new Error("Could not find a starting system in this universe.");

  const canvas = renderer.domElement;
  const state = new StateStore(current.id);
  const hud = new Hud(parent);

  let active: Screen | null = null;
  function show(screen: Screen): void {
    active?.exit();
    active = screen;
    screen.enter();
  }

  const starmap = new StarMapScreen({
    seed,
    host: canvas,
    hud,
    state,
    current,
    onOpenSystem: (id) => api.showSystem(id),
  });
  const systemView = new SystemViewScreen({
    seed,
    host: canvas,
    hud,
    state,
    onBack: () => api.showStarmap(),
  });

  const api: RenderApi = {
    state,
    showStarmap(): void {
      state.set({ screen: "starmap", viewedSystemId: null, selectedPlanetId: null });
      show(starmap);
    },
    showSystem(systemId: string): void {
      if (!getSystem(seed, systemId) || !systemView.open(systemId)) return;
      state.set({ screen: "system", viewedSystemId: systemId, selectedPlanetId: null });
      show(systemView);
    },
  };

  api.showStarmap();

  let last = performance.now();
  function frame(now: number): void {
    const seconds = Math.min((now - last) / 1000, 0.1); // cap so a paused tab does not jump
    last = now;
    if (active) {
      active.update(seconds);
      renderer.render(active.scene, active.camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return api;
}
