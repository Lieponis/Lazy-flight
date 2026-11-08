// Front door of the render layer. Starts the two screens (starmap and system view) and the frame loop.
//
//   import { startRender } from "./render";
//   const api = startRender(renderer, document.getElementById("app"));
//   api.state.get().selectedSystemId   // star selected on the starmap
//   api.state.get().selectedPlanetId   // planet selected in the system view
//   api.state.subscribe((s) => ...)    // be told when something changes

import type * as THREE from "three";
import { getSystem, type StarSystem } from "../universe";
import type { FlightInfo } from "./flightplan";
import { Hud } from "./hud";
import { cameraFov, parseSeedParam, renderSizeFor } from "./helpers";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import type { Screen } from "./screen";
import { START_SEED } from "./settings";
import { findStartSystem } from "./start";
import { StateStore } from "./state";
import { FlightScreen } from "./flight";
import { StarMapScreen } from "./starmap";
import { SystemViewScreen } from "./systemview";

export { StateStore } from "./state";
export type { RenderState, ScreenName } from "./state";
export type { FlightInfo, FlightProgress } from "./flightplan";

export interface RenderApi {
  state: StateStore;
  showStarmap(): void;
  showSystem(systemId: string): void;
  /** Move the "you are here" system (the starmap ring and label follow). Used by the game on arrival. */
  setCurrentSystem(systemId: string): void;
  /** Show the flight screen (launch, warp, approach) for a trip the game has started. */
  startFlight(info: FlightInfo): void;
  /** The game says the trip is over: finish the animation, then show the system view of the destination. */
  endFlight(): void;
  /** True while the flight screen is showing. */
  isFlying(): boolean;
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

  function makeStarmap(here: StarSystem): StarMapScreen {
    return new StarMapScreen({
      seed,
      host: canvas,
      hud,
      state,
      current: here,
      onOpenSystem: (id) => api.showSystem(id),
    });
  }
  let starmap = makeStarmap(current);
  const systemView = new SystemViewScreen({
    seed,
    host: canvas,
    hud,
    state,
    onBack: () => api.showStarmap(),
  });

  const flight = new FlightScreen({ seed, host: canvas, hud, parent });

  const api: RenderApi = {
    state,
    showStarmap(): void {
      state.set({ screen: "starmap", viewedSystemId: null, selectedPlanetId: null });
      show(starmap);
    },
    setCurrentSystem(systemId: string): void {
      const here = getSystem(seed, systemId);
      if (!here || here.id === state.get().currentSystemId) return;
      const wasShowing = active === starmap;
      if (wasShowing) {
        starmap.exit();
        active = null;
      }
      starmap = makeStarmap(here); // the map is centered on the current system, so build a new one
      resize(); // give the new map the right camera shape
      state.set({ currentSystemId: here.id, selectedSystemId: null });
      if (wasShowing) show(starmap);
    },
    startFlight(info: FlightInfo): void {
      flight.begin(info);
      state.set({ screen: "flight", selectedPlanetId: null });
      show(flight);
    },
    endFlight(): void {
      if (active !== flight) return;
      const destination = flight.destinationSystemId();
      flight.finish(() => {
        if (destination) api.showSystem(destination);
        else api.showStarmap();
      });
    },
    isFlying(): boolean {
      return active === flight;
    },
    showSystem(systemId: string): void {
      if (!getSystem(seed, systemId) || !systemView.open(systemId)) return;
      state.set({ screen: "system", viewedSystemId: systemId, selectedPlanetId: null });
      show(systemView);
    },
  };

  // Fill the whole window: the small hidden picture takes the shape of the window.
  function resize(): void {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const size = renderSizeFor(aspect, RENDER_WIDTH, RENDER_HEIGHT);
    renderer.setSize(size.width, size.height, false);
    for (const screen of [starmap, systemView, flight]) {
      screen.camera.aspect = size.width / size.height;
      screen.camera.fov = cameraFov(size.width / size.height, 50);
      screen.camera.updateProjectionMatrix();
    }
  }
  resize();
  window.addEventListener("resize", resize);

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
