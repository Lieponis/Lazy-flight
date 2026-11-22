// Front door of the render layer. Starts the screens (docked view, starmap, system view, flight) and the frame loop.
//
//   import { startRender } from "./render";
//   const api = startRender(renderer, document.getElementById("app"));
//   api.state.get().selectedSystemId   // star selected on the starmap
//   api.state.get().selectedPlanetId   // planet selected in the system view
//   api.state.subscribe((s) => ...)    // be told when something changes

import type * as THREE from "three";
import { START_POINT, getDocksOfSystem, getPlanetsOfSystem, getSystem, nearestSystems, parseDockId, type Seed, type StarSystem } from "../universe";
import type { FlightInfo } from "./flightplan";
import { Hud } from "./hud";
import { cameraFov, renderSizeFor, resolveRenderSeed } from "./helpers";
import { parseShipParam, resolveShipId } from "./integration";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import type { Screen } from "./screen";
import { LOOK_DEFAULT_STYLE, START_SEED, SYSTEM_MARK_STYLE, SYSTEM_SKY_IDLE_MS, WARP_DEFAULT_STYLE } from "./settings";
import { makeSystemSkyLayer } from "./systemsky";
import { FrameLine, mountMapStats, parseMapStats } from "./mapstats";
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
import { parseMapAt, parseReachParam } from "./starmapradius";
import { parseMapIcons, parseMapLine, parseMapPlan, parseMapTurn, type MapPlace, type MapRoute } from "./routemath";
import type { MapSource } from "./galaxy/mapdata";
import { mountFloatPreview } from "./floatpreview";
import { splitCodedName } from "./namefit";
import { WORST_DOCK_FULL, WORST_PLANET, parseNamePreview, pickSamples } from "./namesamples";
import { mountNamePreview } from "./namepreview";
import { FLOAT_DEFAULT_STYLE } from "./settings";
import { parseWarpPreview, parseWarpStyle } from "./warpmath";
import { orbitSecondsFor, parseStationDemo } from "./stationspin";
import { SkyMemory, parseLaunchMode, parseTripHeading, pickByHeading } from "./skyheading";
import { mountSkyTrip, parseSkyTrip } from "./skytrip";

export { StateStore } from "./state";
export type { RenderState, ScreenName } from "./state";
export type { FlightInfo, FlightProgress } from "./flightplan";
export type { MapPoint, MapSource, MapStarList, StarInfo } from "./galaxy/mapdata";
export type { SkyFunctions } from "./galaxy/universefield";
export type { MapPlace, MapPlaceKind, MapRoute, MapRouteHop, PlaceRowLike, PlanLike, PositionOf, RouteLook } from "./routemath";
export { placesFromRows, routeFromPlan } from "./routemath";

export interface RenderApi {
  state: StateStore;
  /** The home screen: the camera above the ship, parked at this dock (a planet id like "44776692551/2": system number / planet number). */
  showDocked(dockId: string): void;
  showStarmap(): void;
  showSystem(systemId: number): void;
  /** Move the "you are here" system (the starmap ring and label follow). Used by the game on arrival. */
  setCurrentSystem(systemId: number): void;
  /**
   * How far (light years) the current ship can fly (the app works it out). The galaxy map gives a diamond to every star inside this
   * reach (the nearest 5,000 at most); every star is drawn as a pixel anyway. Cheap to call often: only the diamonds are redrawn, and
   * only when the number of stars in reach changes. null = the map's 35 ly fallback.
   */
  setReachLy(reachLy: number | null): void;
  /**
   * NAV-2: the flight plan to draw on the galaxy map (null = none). Build it with `routeFromPlan` from the game's `planRoute` answer;
   * ask the game again after every arrival and hand the new plan over. The line goes from the ship through every stop; a far target
   * is shown on the edge of the picture with its name and distance. Cheap: nothing is rebuilt per frame.
   */
  setMapRoute(route: MapRoute | null): void;
  /** NAV-2: the player's places to mark on the galaxy map (build them with `placesFromRows` from the game's `getPlaces`). */
  setMapPlaces(places: readonly MapPlace[]): void;
  /** NAV-2: show the galaxy map with the camera turned to the ship and the first hops of the plan (the zoom-out limit is respected). */
  showMapRoute(): void;
  /** Show the flight screen (launch, warp, approach) for a trip the game has started. */
  startFlight(info: FlightInfo): void;
  /** The game says the trip is over: finish the animation, then show the docked view at the destination dock. */
  endFlight(): void;
  /**
   * Free travel: show the calm "in space at this planet" scene for a planet WITHOUT a dock (id like "44776692551/4").
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
  /**
   * Makes the star data for the galaxy map from the seed the render layer uses. The app (src/mapsource.ts) owns it because the render
   * layer asks the universe nothing for the map: it gets plain lists of numbers. Without it the map has no stars to show.
   */
  mapSource?: (seed: Seed) => MapSource;
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

  const forcedReach = parseReachParam(window.location.search); // testing aid ?reach=NUMBER (diamonds only)
  const mapAt = parseMapAt(window.location.search, START_POINT); // testing aid ?mapat=centre|start|middle|rim: look from there, ship unmoved
  const mapHere = (here: StarSystem) => ({ id: here.id, name: here.name, starLabel: here.star.label, position: mapAt ? mapAt.position : here.position });
  const mapSource = options.mapSource ? options.mapSource(seed) : null; // one source for the map and the system view's faint sky
  const starmap = new StarMapScreen({
    source: mapSource,
    host: canvas,
    hud,
    state,
    current: mapHere(current),
    onOpenSystem: (id) => api.showSystem(id),
    reachLy: forcedReach,
    testView: mapAt ? mapAt.name : null,
    routeLook: parseMapLine(window.location.search), // testing aid ?mapline=a|b|c: the look of the plan line
    testPlan: parseMapPlan(window.location.search), // testing aid ?mapplan=N: a made-up plan of N hops and made-up places
    turnMs: parseMapTurn(window.location.search), // testing aid ?mapturn=MS: how softly the map follows the finger when turning
    iconsFine: parseMapIcons(window.location.search) !== "chunky", // testing aid ?mapicons=chunky: the markers inside the picture (as before)
  });
  // The dock the ship is parked at (the first one shown). Navigation buttons live in src/ui (Agent 5).
  let lastDockId = getDocksOfSystem(seed, current.id)[0]?.id ?? "";
  // The faint galaxy sky behind the docked and flight screens: one layer for both (they are never shown together), built once for the
  // system the ship is in or heading for and reused. The system view has its own (prepared ahead for the star picked on the map).
  const stageSky = mapSource?.sky ? makeSystemSkyLayer(mapSource.sky) : null;
  const orbitSeconds = orbitSecondsFor(window.location.search); // how fast the planet under a station turns (?orbit=A|B|C|off tries speeds)
  const skyMemory = new SkyMemory(); // the sky turn the last trip ended with: docked and floating there keep it, the next take-off starts from it
  const docked = new DockedScreen({
    skyMemory,
    orbitSeconds,
    seed,
    host: canvas,
    hud,
    skyLayer: stageSky,
  });
  const systemView = new SystemViewScreen({
    seed,
    host: canvas,
    hud,
    state,
    sky: mapSource?.sky ?? null, // the faint galaxy sky behind the system view (null = none, the view looks as before)
  });

  systemView.setMarkStyle(parseMarks(window.location.search) ?? SYSTEM_MARK_STYLE);

  // The faint galaxy sky behind the system view is built ahead of time, while other screens show: first for the system the ship is in,
  // then for a star the moment it is picked on the map (or the ship moves), so it is usually already there when the view opens.
  let skyPreparedFor = current.id;
  systemView.prepareSky(current.id);
  state.subscribe((s) => {
    const want = s.selectedSystemId ?? s.currentSystemId;
    if (want === skyPreparedFor) return;
    skyPreparedFor = want;
    systemView.prepareSky(want);
  });

  const flight = new FlightScreen({ orbitSeconds, skyMemory, skyLaunch: parseLaunchMode(window.location.search) ?? undefined, seed, host: canvas, hud, parent, skyLayer: stageSky });
  docked.setShip(shipId);
  flight.setShip(shipId);

  // Testing aid ?stationdemo=1: when the ship is docked at an outpost, the docked view shows a station bay instead (the first station among
  // the nearest stars), so the planet turning under a station can be looked at without travelling. Only the picture changes: the ship, the
  // game state and the save stay as they are.
  const stationDemo = parseStationDemo(window.location.search);
  let demoDockId: string | null | undefined;
  const lookDockFor = (dockId: string): string => {
    if (!stationDemo) return dockId;
    const here = parseDockId(dockId)?.systemId;
    if (here !== undefined && getDocksOfSystem(seed, here).find((d) => d.id === dockId)?.kind === "STATION") return dockId; // already a station
    if (demoDockId === undefined) {
      demoDockId = null;
      for (const near of nearestSystems(seed, current.position, 400)) {
        const station = getDocksOfSystem(seed, near.system.id).find((d) => d.kind === "STATION");
        if (station) {
          demoDockId = station.id;
          break;
        }
      }
    }
    return demoDockId ?? dockId;
  };

  const api: RenderApi = {
    state,
    showDocked(dockId: string): void {
      if (!docked.open(lookDockFor(dockId))) {
        api.showStarmap(); // unknown dock: fall back to the map rather than a blank screen
        return;
      }
      lastDockId = dockId;
      const systemId = parseDockId(dockId)?.systemId ?? null;
      state.set({ screen: "docked", dockedDockId: dockId, viewedSystemId: null, selectedPlanetId: null, floatingPlanetId: null });
      show(docked);
      if (systemId !== null && systemId !== state.get().currentSystemId) api.setCurrentSystem(systemId);
    },
    showStarmap(): void {
      state.set({ screen: "starmap", viewedSystemId: null, selectedPlanetId: null, floatingPlanetId: null });
      show(starmap);
    },
    setCurrentSystem(systemId: number): void {
      const here = getSystem(seed, systemId);
      if (!here || here.id === state.get().currentSystemId) return;
      state.set({ currentSystemId: here.id });
      starmap.setCurrent(mapHere(here)); // the map is centered on the current system: it asks for the stars around it when it is next shown
    },
    setReachLy(value: number | null): void {
      starmap.setReachLy(forcedReach ?? value);
    },
    setMapRoute(route: MapRoute | null): void {
      starmap.setRoute(route);
    },
    setMapPlaces(places: readonly MapPlace[]): void {
      starmap.setPlaces(places);
    },
    showMapRoute(): void {
      api.showStarmap();
      starmap.frameRoute();
    },
    setShip(id: string, livery?: string): void {
      shipId = resolveShipId(id, forcedShip);
      docked.setShip(shipId, livery);
      flight.setShip(shipId, livery);
    },
    startFlight(info: FlightInfo): void {
      if (info.shipId) api.setShip(info.shipId, info.livery);
      state.set({ floatingPlanetId: null });
      flight.begin(info, docked.stationSeconds(info.originDockId), docked.currentSkyFrame(info.originDockId));
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
      if (typeof systemId === "number") api.showSystem(systemId);
      else api.showStarmap();
    },
    isFlying(): boolean {
      return active === flight;
    },
    showSystem(systemId: number): void {
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

  // Testing aid for the sky (stage 3p): ?skytrip=1 gives TEST TRIP IN / OUT buttons: a pretend 40 second trip from the dock you are in to a real
  // nearby system towards the centre or the rim, ending docked there. ?skylaunch=A|B|C picks what the sky does at take-off. Look only: nothing is saved.
  if (parseSkyTrip(window.location.search)) {
    mountSkyTrip(parent, (heading) => {
      if (active === flight) return;
      const here = getSystem(seed, parseDockId(lastDockId)?.systemId ?? -1);
      if (!here) return;
      const near = nearestSystems(seed, here.position, 400)
        .map((n) => n.system)
        .filter((s) => s.id !== here.id && getDocksOfSystem(seed, s.id).length > 0);
      const target = pickByHeading(here.position, near, heading);
      const dock = target ? getDocksOfSystem(seed, target.id)[0] : undefined;
      if (!dock) return;
      const startedAt = performance.now();
      const total = 40_000;
      let ended = false;
      api.startFlight({
        originDockId: lastDockId,
        destinationDockId: dock.id,
        destinationName: `TEST TRIP ${heading === "in" ? "TOWARDS THE CENTRE" : "TOWARDS THE RIM"}`,
        speed: 1,
        getProgress: () => {
          const used = performance.now() - startedAt;
          if (used >= total) {
            if (!ended) {
              ended = true;
              window.setTimeout(() => api.endFlight(), 0);
            }
            return null;
          }
          return { fraction: used / total, remainingMs: total - used, totalMs: total };
        },
      });
    });
  }

  // Testing aid for the warp look: ?warppreview=1 goes straight into an endless warp with buttons to compare the looks.
  if (parseWarpPreview(window.location.search)) {
    const docks = getDocksOfSystem(seed, current.id).map((d) => d.id);
    // ?heading=in or ?heading=out (stage 3o, fix 3): a real trip from here to the nearby system that lies most towards the galaxy centre
    // (in) or most towards the rim (out), so the sky ahead of the ship can be checked with a trip of each kind.
    const heading = parseTripHeading(window.location.search);
    const target = heading
      ? pickByHeading(
          current.position,
          nearestSystems(seed, current.position, 400)
            .map((n) => n.system)
            .filter((s) => s.id !== current.id && getDocksOfSystem(seed, s.id).length > 0),
          heading,
        )
      : null;
    const targetDock = target ? getDocksOfSystem(seed, target.id)[0] : undefined;
    api.startFlight({
      originDockId: docks[0] ?? lastDockId,
      destinationDockId: targetDock?.id ?? docks[1] ?? docks[0] ?? lastDockId,
      destinationName: heading && target ? `WARP PREVIEW ${heading === "in" ? "TOWARDS THE CENTRE" : "TOWARDS THE RIM"}` : "WARP PREVIEW",
      speed: 1,
      getProgress: () => ({ fraction: 0.5, remainingMs: 43_200_000, totalMs: 86_400_000 }),
    });
    mountWarpPreview(parent, parseWarpStyle(window.location.search) ?? WARP_DEFAULT_STYLE, (style) => flight.setWarpStyle(style));
  }

  // Testing aid for the system view (stage U3): ?systempreview=1 gives buttons to compare dock marks and step through systems.
  if (parseSystemPreview(window.location.search)) {
    const region = nearestSystems(seed, current.position, 400).map((n) => n.system); // the 400 nearest systems
    // Stage 3i: the longest system name and a pure-name system (no code) come first, to check long names in the title and the summary.
    const longest = [...region].sort((a, b) => b.name.length - a.name.length)[0];
    const pure = region.find((s) => splitCodedName(s.name) === null && getDocksOfSystem(seed, s.id).length > 0);
    const lead = [longest, pure].filter((s): s is NonNullable<typeof s> => s !== undefined);
    const near = [...lead, ...previewList(region, 2).filter((s) => !lead.some((l) => l.id === s.id))];
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
    const near = nearestSystems(seed, current.position, 400).map((n) => n.system);
    const picks = floatCandidates(seed, near, 3);
    const docks = getDocksOfSystem(seed, current.id).map((d) => d.id);
    let shown = 0;
    const tripTo = (toId: string, name: string, stops?: string[]): void => {
      const fromId = picks[shown]?.planetId;
      if (!fromId) return;
      const startedAt = performance.now();
      const total = 40_000; // a 40 second pretend trip
      api.startFlight({
        originDockId: fromId,
        destinationDockId: toId,
        destinationName: name,
        ...(stops ? { stops } : {}),
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
      // Stage 3i: the longest names the universe allows, on the cockpit screen (a plain trip, and a tour with three stops).
      onLongTrip: () => {
        const next = picks[(shown + 1) % Math.max(1, picks.length)];
        if (next) tripTo(next.planetId, WORST_PLANET);
      },
      onLongTour: () => {
        const next = picks[(shown + 1) % Math.max(1, picks.length)];
        if (next) tripTo(next.planetId, WORST_DOCK_FULL, [WORST_DOCK_FULL, WORST_PLANET, WORST_DOCK_FULL]);
      },
      triangles: () => flight.triangleCount(),
    });
  }

  // Testing aid for long unique names (stage 3i): ?namepreview=1 shows a sheet of cockpit information screens with real and worst-case names.
  if (parseNamePreview(window.location.search)) {
    const region = nearestSystems(seed, current.position, 1500).map((n) => n.system); // the 1,500 nearest systems
    const sources = region.map((s) => ({
      system: s.name,
      planets: getPlanetsOfSystem(seed, s.id).map((p) => p.name),
      docks: getDocksOfSystem(seed, s.id).map((d) => ({ name: d.name, fullName: d.fullName })),
    }));
    mountNamePreview(parent, { samples: pickSamples(sources) });
  }

  // The PS1 pixel look: one extra pass over the finished picture (see look.ts). ?look=A|B|C|off overrides the default.
  const pixelLook = new PixelLook(renderer);
  const startLook = parseLook(window.location.search) ?? LOOK_DEFAULT_STYLE;
  pixelLook.set(lookPreset(startLook));
  if (parseLookPreview(window.location.search)) {
    mountLookPreview(parent, startLook, (style) => pixelLook.set(lookPreset(style)));
  }

  // Testing aid (?mapstats=1, the same switch as the map's block): a FRAME line on the docked and flight screens for the phone speed check.
  const stageStats = parseMapStats(window.location.search) ? mountMapStats(canvas.parentElement ?? document.body) : null;
  if (stageStats) stageStats.style.display = "none";
  const stageLine = new FrameLine();

  let last = performance.now();
  function frame(now: number): void {
    const jsStart = performance.now();
    const seconds = Math.min((now - last) / 1000, 0.1); // cap so a paused tab does not jump
    last = now;
    if (active !== systemView) systemView.warmSky(); // the system view's sky is prepared in the background while other screens show
    if (active !== starmap) starmap.warmSky(); // and the map's sky the same way, so it is already there when the map opens
    if (active !== docked && active !== flight) stageSky?.warm(SYSTEM_SKY_IDLE_MS); // finish a sky the docked or flight screen asked for
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
    if (stageStats) {
      const stage = active === docked || active === flight;
      stageStats.style.display = stage ? "block" : "none";
      if (!stage) stageLine.reset();
      else {
        const text = stageLine.add(seconds * 1000, performance.now() - jsStart);
        if (text) stageStats.textContent = `${active === docked ? "DOCKED" : "FLIGHT"}  ${text}`;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return api;
}
