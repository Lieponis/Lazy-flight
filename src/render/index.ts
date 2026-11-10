// Front door of the render layer. Starts the screens (docked view, starmap, system view, flight) and the frame loop.
//
//   import { startRender } from "./render";
//   const api = startRender(renderer, document.getElementById("app"));
//   api.state.get().selectedSystemId   // star selected on the starmap
//   api.state.get().selectedPlanetId   // planet selected in the system view
//   api.state.subscribe((s) => ...)    // be told when something changes

import type * as THREE from "three";
import { getPlanetsOfSystem, getSystem, parseDockId, type StarSystem } from "../universe";
import type { FlightInfo } from "./flightplan";
import { Hud } from "./hud";
import { cameraFov, renderSizeFor, resolveRenderSeed } from "./helpers";
import { parseShipParam, resolveShipId } from "./integration";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import type { Screen } from "./screen";
import { START_SEED, WARP_DEFAULT_STYLE } from "./settings";
import { findStartSystem } from "./start";
import { StateStore } from "./state";
import { DockedScreen } from "./docked";
import { FlightScreen } from "./flight";
import { StarMapScreen } from "./starmap";
import { SystemViewScreen } from "./systemview";
import { mountWarpPreview } from "./warppreview";
import { parseWarpPreview, parseWarpStyle } from "./warpmath";

export { StateStore } from "./state";
export type { RenderState, ScreenName } from "./state";
export type { FlightInfo, FlightProgress } from "./flightplan";

export interface RenderApi {
  state: StateStore;
  /** The home screen: the camera above the ship, parked at this dock (a planet id like "3:-2:5:0/2"). */
  showDocked(dockId: string): void;
  showStarmap(): void;
  showSystem(systemId: string): void;
  /** Move the "you are here" system (the starmap ring and label follow). Used by the game on arrival. */
  setCurrentSystem(systemId: string): void;
  /** Show the flight screen (launch, warp, approach) for a trip the game has started. */
  startFlight(info: FlightInfo): void;
  /** The game says the trip is over: finish the animation, then show the docked view at the destination dock. */
  endFlight(): void;
  /** True while the flight screen is showing. */
  isFlying(): boolean;
  /**
   * Which ship design to draw (an id like "scout"). The docked view and the flight use it from now on.
   * Unknown ids give the Cargo Hauler. The ?ship=NAME testing aid in the web address overrides it (looks only).
   */
  setShip(shipId: string): void;
}

/** Options for startRender. seed: the universe seed chosen by the game (saving); without it, ?seed= or 12345. */
export interface RenderOptions {
  seed?: number;
}

export function startRender(renderer: THREE.WebGLRenderer, parent: HTMLElement, options: RenderOptions = {}): RenderApi {
  const seed = resolveRenderSeed(options.seed, window.location.search, START_SEED);
  const current = findStartSystem(seed);
  if (!current) throw new Error("Could not find a starting system in this universe.");

  const canvas = renderer.domElement;
  const state = new StateStore(current.id);
  const hud = new Hud(parent);

  // Testing aid: ?ship=passenger-liner or ?ship=scout forces that model everywhere (looks only, the game does not change).
  const forcedShip = parseShipParam(window.location.search);
  let shipId = resolveShipId(null, forcedShip);

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
  // The dock the ship is parked at (the first one shown). Navigation buttons live in src/ui (Agent 5).
  let lastDockId = getPlanetsOfSystem(seed, current.id)[0]?.id ?? "";
  const docked = new DockedScreen({
    seed,
    host: canvas,
    hud,
  });
  const systemView = new SystemViewScreen({
    seed,
    host: canvas,
    hud,
    state,
  });

  const flight = new FlightScreen({ seed, host: canvas, hud, parent });
  docked.setShip(shipId);
  flight.setShip(shipId);

  const api: RenderApi = {
    state,
    showDocked(dockId: string): void {
      if (!docked.open(dockId)) {
        api.showStarmap(); // unknown dock: fall back to the map rather than a blank screen
        return;
      }
      lastDockId = dockId;
      const systemId = parseDockId(dockId)?.systemId ?? null;
      state.set({ screen: "docked", dockedDockId: dockId, viewedSystemId: null, selectedPlanetId: null });
      show(docked);
      if (systemId && systemId !== state.get().currentSystemId) api.setCurrentSystem(systemId);
    },
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
    setShip(id: string): void {
      shipId = resolveShipId(id, forcedShip);
      docked.setShip(shipId);
      flight.setShip(shipId);
    },
    startFlight(info: FlightInfo): void {
      if (info.shipId) api.setShip(info.shipId);
      flight.begin(info);
      state.set({ screen: "flight", selectedPlanetId: null });
      show(flight);
    },
    endFlight(): void {
      if (active !== flight) return;
      const destination = flight.destinationDockId();
      flight.finish(() => {
        if (destination) api.showDocked(destination);
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
    for (const screen of [docked, starmap, systemView, flight]) {
      screen.camera.aspect = size.width / size.height;
      screen.camera.fov = cameraFov(size.width / size.height, 50);
      screen.camera.updateProjectionMatrix();
    }
  }
  resize();
  window.addEventListener("resize", resize);

  api.showDocked(lastDockId); // the game starts in the docked view

  // Testing aid for the warp look: ?warppreview=1 goes straight into an endless warp with buttons to compare the looks.
  if (parseWarpPreview(window.location.search)) {
    const docks = getPlanetsOfSystem(seed, current.id).map((p) => p.id);
    api.startFlight({
      originDockId: docks[0] ?? lastDockId,
      destinationDockId: docks[1] ?? docks[0] ?? lastDockId,
      destinationName: "WARP PREVIEW",
      speed: 1,
      getProgress: () => ({ fraction: 0.5, remainingMs: 43_200_000, totalMs: 86_400_000 }),
    });
    mountWarpPreview(parent, parseWarpStyle(window.location.search) ?? WARP_DEFAULT_STYLE, (style) => flight.setWarpStyle(style));
  }

  let last = performance.now();
  function frame(now: number): void {
    const seconds = Math.min((now - last) / 1000, 0.1); // cap so a paused tab does not jump
    last = now;
    if (active) {
      active.update(seconds);
      if (active.render) active.render(renderer);
      else renderer.render(active.scene, active.camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return api;
}
