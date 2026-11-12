// Front door of the render layer. Starts the screens (docked view, starmap, system view, flight) and the frame loop.
//
//   import { startRender } from "./render";
//   const api = startRender(renderer, document.getElementById("app"));
//   api.state.get().selectedSystemId   // star selected on the starmap
//   api.state.get().selectedPlanetId   // planet selected in the system view
//   api.state.subscribe((s) => ...)    // be told when something changes

import type * as THREE from "three";
import { getDocksOfSystem, getSystem, listSystemsNear, parseDockId, type StarSystem } from "../universe";
import type { FlightInfo } from "./flightplan";
import { Hud } from "./hud";
import { cameraFov, renderSizeFor, resolveRenderSeed } from "./helpers";
import { parseShipParam, resolveShipId } from "./integration";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import type { Screen } from "./screen";
import { LOOK_DEFAULT_STYLE, START_SEED, SYSTEM_MARK_STYLE, WARP_DEFAULT_STYLE } from "./settings";
import { findStartSystem } from "./start";
import { StateStore } from "./state";
import { DockedScreen } from "./docked";
import { FlightScreen } from "./flight";
import { StarMapScreen } from "./starmap";
import { SystemViewScreen } from "./systemview";
import { PixelLook } from "./look";
import { lookPreset, parseLook, parseLookPreview } from "./lookmath";
import { mountLookPreview } from "./lookpreview";
import { parseMarks, parseSystemPreview, previewList } from "./systemmarks";
import { mountSystemPreview } from "./systempreview";
import { mountWarpPreview } from "./warppreview";
import { parseFloatPreview, parseFloatStyle } from "./floatmath";
import { floatCandidates } from "./floatpick";
import { reachBeyondMap, starmapRadius } from "./starmapradius";
import { mountFloatPreview } from "./floatpreview";
import { FLOAT_DEFAULT_STYLE } from "./settings";
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
  /**
   * How far (light years) the current ship can fly with the fuel it carries (the app works it out: fuel divided by the fuel one light
   * year burns). The galaxy map grows to show every reachable star, up to a cap (see STARMAP_MAX_RADIUS_LY). Call it whenever fuel,
   * ship or engines change; the map is only rebuilt when its radius really changes. null = the normal 35 ly map.
   */
  setReachLy(reachLy: number | null): void;
  /** Show the flight screen (launch, warp, approach) for a trip the game has started. */
  startFlight(info: FlightInfo): void;
  /** The game says the trip is over: finish the animation, then show the docked view at the destination dock. */
  endFlight(): void;
  /**
   * Free travel: show the calm "in space at this planet" scene for a planet WITHOUT a dock (id like "3:-2:5:0/4").
   * Use it when the page opens while the ship floats there. A free trip that ends at such a planet goes into this scene by itself.
   * Returns false for an unknown planet. The screen is "flight" and state.floatingPlanetId holds the planet id while it shows.
   */
  showFloating(planetId: string): boolean;
  /** The planet the ship floats at, or null. */
  floatingPlanetId(): string | null;
  /** Leave the floating scene: the system view of that planet's system. (showDocked / showStarmap / showSystem also leave it.) */
  leaveFloating(): void;
  /** True while the flight screen is showing. */
  isFlying(): boolean;
  /**
   * Which ship design to draw (an id like "scout"). The docked view and the flight use it from now on.
   * Unknown ids give the Cargo Hauler. The ?ship=NAME testing aid in the web address overrides it (looks only).
   */
  setShip(shipId: string, livery?: string): void;
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

  let reachLy: number | null = null; // set by the app (api.setReachLy)
  function makeStarmap(here: StarSystem): StarMapScreen {
    return new StarMapScreen({
      seed,
      host: canvas,
      hud,
      state,
      current: here,
      onOpenSystem: (id) => api.showSystem(id),
      radiusLy: starmapRadius(reachLy),
      farNote: reachBeyondMap(reachLy),
    });
  }
  /** Builds the map again (the map is centred on the current system and sized by the reach), keeping the screen the player is on. */
  function rebuildStarmap(here: StarSystem): void {
    const wasShowing = active === starmap;
    if (wasShowing) {
      starmap.exit();
      active = null;
    }
    starmap = makeStarmap(here);
    resize(); // give the new map the right camera shape
    state.set({ selectedSystemId: null });
    if (wasShowing) show(starmap);
  }
  let starmap = makeStarmap(current);
  // The dock the ship is parked at (the first one shown). Navigation buttons live in src/ui (Agent 5).
  let lastDockId = getDocksOfSystem(seed, current.id)[0]?.id ?? "";
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

  systemView.setMarkStyle(parseMarks(window.location.search) ?? SYSTEM_MARK_STYLE);

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
      state.set({ screen: "docked", dockedDockId: dockId, viewedSystemId: null, selectedPlanetId: null, floatingPlanetId: null });
      show(docked);
      if (systemId && systemId !== state.get().currentSystemId) api.setCurrentSystem(systemId);
    },
    showStarmap(): void {
      state.set({ screen: "starmap", viewedSystemId: null, selectedPlanetId: null, floatingPlanetId: null });
      show(starmap);
    },
    setCurrentSystem(systemId: string): void {
      const here = getSystem(seed, systemId);
      if (!here || here.id === state.get().currentSystemId) return;
      state.set({ currentSystemId: here.id });
      rebuildStarmap(here); // the map is centered on the current system, so build a new one
    },
    setReachLy(value: number | null): void {
      const before = starmapRadius(reachLy);
      const noteBefore = reachBeyondMap(reachLy);
      reachLy = value;
      if (starmapRadius(reachLy) === before && reachBeyondMap(reachLy) === noteBefore) return; // nothing the map shows has changed
      const here = getSystem(seed, state.get().currentSystemId);
      if (here) rebuildStarmap(here);
    },
    setShip(id: string, livery?: string): void {
      shipId = resolveShipId(id, forcedShip);
      docked.setShip(shipId, livery);
      flight.setShip(shipId, livery);
    },
    startFlight(info: FlightInfo): void {
      if (info.shipId) api.setShip(info.shipId, info.livery);
      state.set({ floatingPlanetId: null });
      flight.begin(info);
      state.set({ screen: "flight", selectedPlanetId: null });
      show(flight);
    },
    endFlight(): void {
      if (active !== flight) return;
      const destination = flight.destinationDockId();
      flight.finish(() => {
        if (flight.isFloating()) state.set({ screen: "flight", floatingPlanetId: flight.floatingPlanetId() }); // a planet without a dock: stay in space
        else if (destination) api.showDocked(destination);
        else api.showStarmap();
      });
    },
    showFloating(planetId: string): boolean {
      if (!flight.beginFloat(planetId)) return false;
      state.set({ screen: "flight", selectedPlanetId: null, floatingPlanetId: planetId });
      show(flight);
      return true;
    },
    floatingPlanetId(): string | null {
      return flight.isFloating() && active === flight ? flight.floatingPlanetId() : null;
    },
    leaveFloating(): void {
      const id = flight.isFloating() ? flight.floatingPlanetId() : null;
      const systemId = id ? parseDockId(id)?.systemId : null;
      if (systemId) api.showSystem(systemId);
      else api.showStarmap();
    },
    isFlying(): boolean {
      return active === flight;
    },
    showSystem(systemId: string): void {
      if (!getSystem(seed, systemId) || !systemView.open(systemId)) return;
      state.set({ screen: "system", viewedSystemId: systemId, selectedPlanetId: null, floatingPlanetId: null });
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
    const docks = getDocksOfSystem(seed, current.id).map((d) => d.id);
    api.startFlight({
      originDockId: docks[0] ?? lastDockId,
      destinationDockId: docks[1] ?? docks[0] ?? lastDockId,
      destinationName: "WARP PREVIEW",
      speed: 1,
      getProgress: () => ({ fraction: 0.5, remainingMs: 43_200_000, totalMs: 86_400_000 }),
    });
    mountWarpPreview(parent, parseWarpStyle(window.location.search) ?? WARP_DEFAULT_STYLE, (style) => flight.setWarpStyle(style));
  }

  // Testing aid for the system view (stage U3): ?systempreview=1 gives buttons to compare dock marks and step through systems.
  if (parseSystemPreview(window.location.search)) {
    const near = previewList(listSystemsNear(seed, current.position, 40), 2);
    mountSystemPreview(parent, {
      initial: parseMarks(window.location.search) ?? SYSTEM_MARK_STYLE,
      systems: near.map((s) => `${s.name}: ${s.planetCount} planets, ${getDocksOfSystem(seed, s.id).length} docks`),
      onMark: (style) => systemView.setMarkStyle(style),
      onSystem: (i) => {
        const target = near[i];
        if (target) api.showSystem(target.id);
      },
      triangles: () => systemView.triangleCount(),
    });
  }

  // Testing aid for free travel (stage 3g): ?floatpreview=1 floats at planets without a dock; A / B / C layouts, free trips, triangle count.
  if (parseFloatPreview(window.location.search)) {
    const near = listSystemsNear(seed, current.position, 40);
    const picks = floatCandidates(seed, near, 3);
    const docks = getDocksOfSystem(seed, current.id).map((d) => d.id);
    let shown = 0;
    const tripTo = (toId: string, name: string): void => {
      const fromId = picks[shown]?.planetId;
      if (!fromId) return;
      const startedAt = performance.now();
      const total = 40_000; // a 40 second pretend trip
      api.startFlight({
        originDockId: fromId,
        destinationDockId: toId,
        destinationName: name,
        speed: 1,
        getProgress: () => {
          const used = performance.now() - startedAt;
          if (used >= total) {
            window.setTimeout(() => api.endFlight(), 0);
            return null;
          }
          return { fraction: used / total, remainingMs: total - used, totalMs: total };
        },
      });
    };
    mountFloatPreview(parent, {
      initial: parseFloatStyle(window.location.search) ?? FLOAT_DEFAULT_STYLE,
      planets: picks.map((p) => p.label),
      onStyle: (style) => flight.setFloatStyle(style),
      onPlanet: (i) => {
        const target = picks[i];
        if (!target) return;
        shown = i;
        api.showFloating(target.planetId);
      },
      onTrip: () => {
        const next = picks[(shown + 1) % Math.max(1, picks.length)];
        if (next) tripTo(next.planetId, next.label);
      },
      onTripToDock: () => {
        const dock = docks[0];
        if (dock) tripTo(dock, "DOCK");
      },
      triangles: () => flight.triangleCount(),
    });
  }

  // The PS1 pixel look: one extra pass over the finished picture (see look.ts). ?look=A|B|C|off overrides the default.
  const pixelLook = new PixelLook(renderer);
  const startLook = parseLook(window.location.search) ?? LOOK_DEFAULT_STYLE;
  pixelLook.set(lookPreset(startLook));
  if (parseLookPreview(window.location.search)) {
    mountLookPreview(parent, startLook, (style) => pixelLook.set(lookPreset(style)));
  }

  let last = performance.now();
  function frame(now: number): void {
    const seconds = Math.min((now - last) / 1000, 0.1); // cap so a paused tab does not jump
    last = now;
    if (active) {
      active.update(seconds);
      const screen = active;
      pixelLook.render(
        () => {
          if (screen.render) screen.render(renderer);
          else renderer.render(screen.scene, screen.camera);
        },
        seconds,
      );
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return api;
}
