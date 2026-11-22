// SCREEN 1: the galaxy map (stage G5a: the real map).
//
// Plain words: the map shows the 60,000 stars nearest to where you are. Every star is one coloured pixel (closer = brighter, fading
// to nothing at the edge so the cloud has no visible edge). Stars inside your ship's reach also get a small diamond. Tap a star and the
// camera glides to it; the label shows its name, its type, how far it is and the distances to its 5 nearest neighbours.
// Behind the stars is the sky as seen from where you stand: a soft glow plus 60,000 single dots, built from the universe's own density
// and rebuilt only when you move into another "sky cell", a few milliseconds per frame (the old sky stays until the new one is ready).
// The stars come from the app as plain lists (a MapSource), asked ONCE each time you arrive somewhere new, never per frame.

import * as THREE from "three";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import { standInProposal, type GalaxyField } from "./galaxy/galaxyfield";
import { nearStarsFromList, nearestLineText, starsWithin, type MapPoint, type MapSource } from "./galaxy/mapdata";
import { directionsOf, type NearStars } from "./galaxy/neardata";
import { NearLayers, type NearCounts } from "./galaxy/nearlayers";
import {
  FLY_TO_DIST_LY,
  MIN_TAP_VISIBILITY,
  MIN_ZOOM_LY,
  ROOM_AROUND_TARGET_LY,
  diamondSize,
  maxOrbitDistance,
  tapVisibility,
  zoomOutLimit,
} from "./galaxy/previewmath";
import { skyCellOf, type SkyCell } from "./galaxy/skycell";
import { DotsBuilder } from "./galaxy/skydots";
import { SkyBuilder } from "./galaxy/skyglow";
import { skyToTexels } from "./galaxy/skylook";
import { removeNearOverlaps } from "./galaxy/skystars";
import { SkyView } from "./galaxy/skyview";
import { StarGrid, nearestTo } from "./galaxy/starpick";
import { UNIVERSE_BULGE_REACH_LY, universeField } from "./galaxy/universefield";
import { orbitCameraPosition, renderSizeFor, starfieldPositions } from "./helpers";
import type { Hud } from "./hud";
import { OrbitView } from "./input";
import { mapStatsText, mountMapStats, parseMapStats } from "./mapstats";
import { RouteLayer } from "./routelayer";
import {
  demoPlan,
  frameBounds,
  routeLine,
  targetTagText,
  NavInput,
  type MapPlace,
  type MapRoute,
  type RouteLine,
  type RouteLook,
  type SafeRect,
  type TargetMode,
} from "./routemath";
import { MarkerOverlay } from "./markeroverlay";
import { RouteTag } from "./routetag";
import type { Screen } from "./screen";
import {
  MAP_DIAMOND_CAP,
  MAP_EDGE_SIDE_MARGIN_PX,
  MAP_NEAR_STARS,
  MAP_REACH_FALLBACK_LY,
  MAP_ROUTE_FRAME_HOPS,
  MAP_ROUTE_LOOK,
  MAP_TARGET_MODE,
  MAP_ROUTE_MAX_HOPS,
  MAP_SKY_BUDGET_MS,
  MAP_SKY_DOTS,
  MAP_SKY_GLOW,
  MAP_SKY_IDLE_MS,
  MAP_SKY_OVERLAP_CELL_DEG,
  MAP_SKY_OVERLAP_STARS,
  MAP_SKY_SIZE,
  MAP_SKY_STEPS,
  MAP_SKY_WARM_DELAY_FRAMES,
  MAP_TAPPABLE_STARS,
  MAP_TAP_RADIUS_PX,
  MAP_TURN_SMOOTH_MS,
  STARFIELD_COUNT,
} from "./settings";
import { starLabelText, starmapHint } from "./starmapradius";
import type { StateStore } from "./state";

/** The system the player is in: the centre of the map. */
export interface StarMapHere {
  id: number;
  name: string;
  /** For example "Yellow star". */
  starLabel: string;
  /** Galaxy coordinates in light years. */
  position: MapPoint;
}

export interface StarMapOptions {
  /** Where the stars come from. Null = the app gave none (the map then only shows the hint). */
  source: MapSource | null;
  host: HTMLElement; // the canvas
  hud: Hud;
  state: StateStore;
  current: StarMapHere;
  onOpenSystem: (systemId: number) => void;
  /** The ship's reach in light years (decides which stars get a diamond). Null = not known yet. */
  reachLy?: number | null;
  /** Testing aid ?mapat=: the name of the place the map is looking from instead of the ship's real one (shown in the title). */
  testView?: string | null;
  /** The look of the flight-plan line (testing aid ?mapline=a|b|c; null = the setting MAP_ROUTE_LOOK). */
  routeLook?: RouteLook | null;
  /** What the plan's target does when it is off the picture (testing aid ?maptarget=a|b; null = the setting MAP_TARGET_MODE). */
  targetMode?: TargetMode | null;
  /** Testing aid ?mapplan=N: a made-up plan of N hops and some made-up places, until the app hands over real ones. */
  testPlan?: number | null;
  /** Milliseconds the camera takes to follow the finger (testing aid `?mapturn=`); null = the standard from settings. */
  turnMs?: number | null;
  /** Draw the markers as a finer layer above the picture (they glide like the stars); false = inside the picture, as before (testing aid `?mapicons=chunky`). */
  iconsFine?: boolean;
}

/** A sky being built, a few milliseconds per frame: the glow first, then the dots. */
interface PendingSky {
  glow: SkyBuilder | null;
  dots: DotsBuilder | null;
  cell: SkyCell;
  glowKey: string;
  dotsKey: string;
  startMs: number;
  frames: number;
  worstSliceMs: number;
}

/** What the last finished sky cost (for the developer counters and the report). */
interface SkyStats {
  wallMs: number;
  glowMs: number;
  dotsMs: number;
  frames: number;
  worstSliceMs: number;
  squares: number;
  dots: number;
  cellLy: number;
}

function makeMarker(color: number): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
}

export class StarMapScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.2, 800);

  private readonly view: OrbitView;
  private readonly layers = new NearLayers();
  private readonly selectionMarker = makeMarker(0xffffff);
  private readonly currentMarker = makeMarker(0x5dff7a);
  private readonly backdrop: THREE.Points;
  private readonly tapRay = new THREE.Vector3();

  /** The sky seen from where you stand (glow + dots). `skyField` null = the app gave no sky functions: the plain backdrop stays. */
  private readonly sky = new SkyView();
  private readonly skyField: GalaxyField | null;
  private pendingSky: PendingSky | null = null;
  private builtGlowKey: string | null = null;
  private builtDotsKey: string | null = null;
  private skyBuilt = false;
  private skyStats: SkyStats | null = null;
  /**
   * The star set the sky is built from while the map is NOT shown (the real `near` only exists once the map has been opened here).
   * It comes from the same source answer the map asks for later, so the radius, and with it the sky's keys, are identical.
   */
  private preNear: NearStars | null = null;
  private warmFrames = 0;

  /** Developer counters (?mapstats=1): the text block and the averaged frame numbers. */
  private readonly statsEl: HTMLPreElement | null;
  private statsClock = 0;
  private frameMs = 16.7;
  private jsMs = 0;
  private drawInfo = { calls: 0, triangles: 0 };

  /** The flight-plan line and the place markers (NAV-2), and the words next to the target. */
  private readonly route: RouteLayer;
  private readonly targetMode: TargetMode;
  /** Made the first time a plan is shown (the page needs no extra element until then). */
  private routeTag: RouteTag | null = null;
  private marks: MarkerOverlay | null = null;
  /** What the app told the map to draw (and the made-up plan of ?mapplan=N, until a real plan arrives). */
  private readonly nav: NavInput;
  private routeShape: RouteLine | null = null;
  private layoutClock = 0;
  private canvasRect = { left: 0, top: 0, width: 1, height: 1 };
  private freeRows = { top: 0, bottom: 0 };

  private current: StarMapHere;
  private reachLy: number | null;
  private active = false;

  /** The stars around `builtFor` (null = not asked yet). Filled the first time the map is shown after a move. */
  private near: NearStars | null = null;
  private builtFor: number | null = null;
  private grid: StarGrid | null = null;
  /** How visible each tappable star is (0..1): a star too faint to see never wins a tap over a visible one. */
  private tapVis = new Float32Array(0);
  private counts: NearCounts = { diamonds: 0, pixels: 0, triangles: 0 };
  /** The tapped star (index into the star lists), or null. */
  private selected: number | null = null;
  private nearestLine = "";
  /** Milliseconds the last star lookup and set-up took (the app's list plus the grid): for the report. */
  private lastBuildMs = 0;

  constructor(private readonly opts: StarMapOptions) {
    this.current = opts.current;
    this.reachLy = opts.reachLy ?? null;

    this.scene.add(this.layers.group);

    // Plain background stars: single dots far away. They only show until the first sky is built (or when the app gave no sky functions).
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(STARFIELD_COUNT, 450), 3));
    this.backdrop = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false }));
    this.scene.add(this.backdrop);

    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker, this.currentMarker);

    this.targetMode = opts.targetMode ?? MAP_TARGET_MODE;
    this.route = new RouteLayer(opts.routeLook ?? MAP_ROUTE_LOOK, this.targetMode);
    this.scene.add(this.route.group);
    this.nav = new NavInput((opts.testPlan ?? 0) > 0);

    this.skyField = opts.source?.sky ? universeField(opts.source.sky) : null;
    this.sky.setGlowStrength(MAP_SKY_GLOW);
    this.statsEl = parseMapStats(window.location.search) ? mountMapStats(opts.host.parentElement ?? document.body) : null;

    this.view = new OrbitView(this.camera, opts.host, MIN_ZOOM_LY, 150, 60);
    this.view.onTap = (x, y) => this.handleTap(x, y);
    this.view.turnSmoothSeconds = (opts.turnMs ?? MAP_TURN_SMOOTH_MS) / 1000;
  }

  // ------------------------------------------------------------------ what the app tells the map

  /** The player is in another system: the map is centred on it, the stars are asked for again (when the map is next shown). */
  setCurrent(here: StarMapHere): void {
    const same =
      here.id === this.current.id &&
      here.position.x === this.current.position.x &&
      here.position.y === this.current.position.y &&
      here.position.z === this.current.position.z;
    this.current = here;
    if (same) return; // same place (maybe a new name text): nothing to rebuild
    this.applyRoute(); // the plan and the places are drawn relative to where the ship is
    this.near = null; // the stars are asked for again the next time the map is shown
    this.preNear = null; // and the sky is prepared again for the new place (after a short wait, see warmSky)
    this.warmFrames = 0;
    this.builtFor = null;
    this.selected = null;
    this.opts.state.set({ selectedSystemId: null });
    if (this.active) {
      this.ensureData();
      this.refreshTitle();
      this.refreshHud();
    }
  }

  /** The ship's reach changed: only the diamonds change (cheap, the stars are the same). */
  setReachLy(reachLy: number | null): void {
    const clean = reachLy !== null && Number.isFinite(reachLy) && reachLy > 0 ? reachLy : null;
    if (clean === this.reachLy) return;
    this.reachLy = clean;
    if (this.near) this.applyReach();
  }

  // ------------------------------------------------------------------ the stars

  /** Asks the app for the nearest stars around the player (once per move) and sets up the pixels, diamonds and the tap grid. */
  private ensureData(): void {
    if (this.near && this.builtFor === this.current.id) return;
    const source = this.opts.source;
    if (!source) return;
    const t0 = performance.now();
    const near = nearStarsFromList(source.nearest(this.current.position, MAP_NEAR_STARS));
    this.near = near;
    this.preNear = null;
    this.builtFor = this.current.id;
    this.selected = null;
    this.nearestLine = "";
    this.selectionMarker.visible = false;
    this.counts = this.layers.setStars(near, this.reachCount(near), MAP_DIAMOND_CAP);
    this.grid = new StarGrid(near.positions, MAP_TAPPABLE_STARS);
    this.refreshTapVisibility(near);
    // The camera can see out to twice the bubble (and as far as the flight plan goes).
    this.applyFar();
    this.view.resetFocus();
    this.view.dist = this.defaultDist(near);
    this.lastBuildMs = performance.now() - t0;
    if (this.nav.demo) {
      // Testing aid ?mapplan=N: a made-up plan through real near stars, and made-up places, so the line can be looked at.
      const demo = demoPlan(this.current.position, near, this.reachLy ?? MAP_REACH_FALLBACK_LY, this.opts.testPlan ?? 20);
      this.nav.setDemo(demo.route, demo.places);
      this.applyRoute();
      this.frameRoute(); // and the camera help turns the map to look at the first hops
    }
    this.ensureSky(near);
  }

  // ------------------------------------------------------------------ the flight plan and my places (NAV-2)

  /** The flight plan to draw (null = none). The app asks the game again after every arrival and hands the new plan over. */
  setRoute(route: MapRoute | null): void {
    this.nav.setRoute(route);
    this.applyRoute();
  }

  /** My places to mark (start dock, outposts, starred, recent). */
  setPlaces(places: readonly MapPlace[]): void {
    this.nav.setPlaces(places);
    this.applyRoute();
  }

  /** The line and the markers are drawn relative to the ship: work them out again (plan, places or the ship's place changed). */
  private applyRoute(): void {
    const origin = this.current.position;
    const plan = this.nav.route();
    this.routeShape = plan ? routeLine(origin, plan, MAP_ROUTE_MAX_HOPS) : null;
    this.route.setRoute(this.routeShape);
    this.route.setPlaces(this.nav.places(), origin);
    if (!this.marks && this.opts.iconsFine !== false && typeof document !== "undefined" && (this.routeShape || this.nav.places().length > 0)) {
      this.marks = new MarkerOverlay(this.opts.host.parentElement ?? document.body);
      this.route.setSink(this.marks);
    }
    if (this.routeShape && plan) {
      this.routeTag ??= new RouteTag(this.opts.host.parentElement ?? document.body);
      this.routeTag.setText(targetTagText(plan.target.name, this.routeShape.targetLy));
    } else {
      this.routeTag?.setText("");
    }
    this.applyFar();
  }

  /** The camera sees out to twice the drawn stars, and as far as the plan's line goes. */
  private applyFar(): void {
    const near = this.near;
    if (!near) return;
    const far = Math.max(800, near.radius * 2.2 + 50, this.route.extentLy() * 1.05 + 50);
    if (far === this.camera.far) return;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Camera help for the plan screen: turns the camera to look at the ship and the first few hops, as close as fits, never beyond the
   * zoom-out limit. Does nothing until the map has its stars and there is a plan with at least one hop.
   */
  frameRoute(): void {
    const near = this.near;
    const shape = this.routeShape;
    if (!near || !shape || shape.count < 2) return;
    const frame = frameBounds(shape.points, Math.min(shape.count, 1 + MAP_ROUTE_FRAME_HOPS), this.camera.fov, this.camera.aspect, 1.3);
    this.view.focusOn(frame.centre.x, frame.centre.y, frame.centre.z, Math.min(frame.dist, this.zoomLimit(near)));
  }

  /** Where the picture's free area is (window pixels), measured twice a second: the canvas, and the rows the title and label take. */
  private refreshLayout(seconds: number): void {
    this.layoutClock -= seconds;
    if (this.layoutClock > 0) return;
    this.layoutClock = 0.5;
    const r = this.opts.host.getBoundingClientRect();
    this.canvasRect = { left: r.left, top: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height) };
    this.freeRows = this.opts.hud.freeRows();
  }

  /** Moves the plan's markers to match the camera and puts the target's words next to its marker. */
  private updateRoute(seconds: number, near: NearStars): void {
    if (!this.routeShape && this.nav.places().length === 0) return; // nothing to draw: nothing to measure
    this.refreshLayout(seconds);
    const size = renderSizeFor(this.camera.aspect, RENDER_WIDTH, RENDER_HEIGHT);
    const rect = this.canvasRect;
    const k = size.height / rect.height; // pixels of the small picture per window pixel
    const safe: SafeRect = {
      left: MAP_EDGE_SIDE_MARGIN_PX,
      right: MAP_EDGE_SIDE_MARGIN_PX,
      top: Math.max(0, this.freeRows.top - rect.top) * k + 6,
      bottom: Math.max(0, this.freeRows.bottom) * k + 6,
    };
    this.marks?.setView({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, picW: size.width, picH: size.height, dpr: window.devicePixelRatio || 1 });
    const tag = this.route.update(seconds, this.camera, this.view.dist, size.width, size.height, safe, near.radius);
    if (!tag || !this.routeTag) {
      this.routeTag?.hide();
      return;
    }
    this.routeTag.place(rect.left + (tag.x / size.width) * rect.width, rect.top + (tag.y / size.height) * rect.height, tag.side, {
      left: rect.left + 4,
      right: rect.left + rect.width - 4,
      top: this.freeRows.top + 4,
      bottom: window.innerHeight - this.freeRows.bottom - 4,
    });
  }

  private reachCount(near: NearStars): number {
    return starsWithin(near.distances, near.count, this.reachLy ?? MAP_REACH_FALLBACK_LY);
  }

  private applyReach(): void {
    const near = this.near;
    if (!near) return;
    this.counts = this.layers.setDiamonds(near, this.reachCount(near), MAP_DIAMOND_CAP);
    this.refreshTapVisibility(near);
    this.layers.setSelected(near, this.selected);
  }

  private refreshTapVisibility(near: NearStars): void {
    const grid = this.grid;
    if (!grid) return;
    if (this.tapVis.length !== grid.count) this.tapVis = new Float32Array(grid.count);
    for (let i = 0; i < grid.count; i++) this.tapVis[i] = tapVisibility(near.distances[i] ?? 0, near.radius, i < this.counts.diamonds);
  }

  /** How far the camera may be from the player (light years): out to the nearest-1,000-stars distance of the local spacing. */
  private zoomLimit(near: NearStars): number {
    return zoomOutLimit("near", near.distances, near.count, near.radius, near.zoomNearLy);
  }

  /** The camera starts far enough away to see the stars within reach (at least 60 ly), but never beyond the zoom-out limit. */
  private defaultDist(near: NearStars): number {
    const reach = this.reachLy ?? MAP_REACH_FALLBACK_LY;
    return Math.min(Math.max(60, reach * 1.2), this.zoomLimit(near));
  }

  // ------------------------------------------------------------------ the sky behind the stars

  /**
   * Starts a new sky build when the player is in another sky cell, or the near-star bubble changed size. The glow and the dots are
   * separate builds, and one that is already finished for this cell is left alone. The old sky stays on screen until the new one is done.
   */
  private ensureSky(near: NearStars | null = this.near): void {
    const field = this.skyField;
    if (!near || !field) return;
    const fns = this.opts.source?.sky;
    // The real universe is a thin disc: the sky cell is as tall as a third of the disc there, centred on the plane (see skyCellOf).
    const cell = skyCellOf(this.current.position, fns ? (r) => fns.thickness(r) / 3 : undefined);
    // The bubble radius is grouped in steps of about 19 % so a small change does not start a new build.
    const radiusStep = Math.round(Math.log2(Math.max(1, near.radius)) * 4);
    const glowKey = `${cell.key}|${MAP_SKY_SIZE}|${radiusStep}`;
    const dotsKey = `${cell.key}|${radiusStep}|${MAP_SKY_DOTS}`;
    const pending = this.pendingSky;
    if (pending && pending.glowKey === glowKey && pending.dotsKey === dotsKey) return;
    const needGlow = glowKey !== this.builtGlowKey;
    const needDots = dotsKey !== this.builtDotsKey;
    if (!needGlow && !needDots) {
      this.pendingSky = null;
      return;
    }
    this.pendingSky = {
      glow: needGlow ? new SkyBuilder(field, cell.centre, { faceSize: MAP_SKY_SIZE, steps: MAP_SKY_STEPS, nearRadius: near.radius, bulgeReach: UNIVERSE_BULGE_REACH_LY }) : null,
      dots: needDots
        ? new DotsBuilder(field, standInProposal, cell.centre, { count: MAP_SKY_DOTS, nearRadius: near.radius, seed: cell.starSeed, squeeze: 0.5 })
        : null,
      cell,
      glowKey,
      dotsKey,
      startMs: performance.now(),
      frames: 0,
      worstSliceMs: 0,
    };
  }

  /** Spends about `budgetMs` of this frame on the sky build (glow first, then dots); puts the finished sky on screen. */
  private stepSky(budgetMs: number = MAP_SKY_BUDGET_MS): void {
    const p = this.pendingSky;
    const near = this.near ?? this.preNear;
    if (!p || !near) return;
    const t0 = performance.now();
    if (p.glow && !p.glow.done) p.glow.run(budgetMs);
    else if (p.dots && !p.dots.done) p.dots.run(budgetMs);
    p.frames++;
    p.worstSliceMs = Math.max(p.worstSliceMs, performance.now() - t0);
    if (!((!p.glow || p.glow.done) && (!p.dots || p.dots.done))) return;
    this.pendingSky = null;
    const stats: SkyStats = {
      wallMs: performance.now() - p.startMs,
      glowMs: p.glow?.workMs ?? 0,
      dotsMs: p.dots?.workMs ?? 0,
      frames: p.frames,
      worstSliceMs: p.worstSliceMs,
      squares: this.skyStats?.squares ?? 0,
      dots: this.skyStats?.dots ?? 0,
      cellLy: p.cell.size,
    };
    if (p.glow) {
      this.sky.setTexels(skyToTexels(p.glow.raw), p.glow.layout);
      stats.squares = p.glow.layout.total;
      this.builtGlowKey = p.glowKey;
    }
    if (p.dots) {
      // Sky dots that share a patch of sky with one of the nearest real stars are left out (the real star is drawn one by one).
      const kept = removeNearOverlaps(p.dots.result(), directionsOf(near, MAP_SKY_OVERLAP_STARS), MAP_SKY_OVERLAP_CELL_DEG);
      this.sky.setStars(kept);
      stats.dots = kept.count;
      this.builtDotsKey = p.dotsKey;
    }
    this.skyStats = stats;
    this.sky.setGlowStrength(MAP_SKY_GLOW);
    this.sky.setVisible(true, true);
    this.skyBuilt = true;
    this.backdrop.visible = false; // the real sky replaces the plain backdrop dots
  }

  /**
   * Called every frame while ANOTHER screen is showing: builds the sky for the place the player stands in, a few milliseconds per frame,
   * so it is already there when the map opens (Andy: "make the galaxy map's backdrop as fast as the system view's"). After the start
   * or a jump it waits about half a second, then asks the source for the stars (the answer is kept, so the map's own request later
   * costs nothing) and builds from them. Nothing else about the map changes: the stars, diamonds and sky look exactly as before.
   */
  warmSky(budgetMs: number = MAP_SKY_IDLE_MS): void {
    if (this.active || !this.skyField || !this.opts.source) return;
    if (!this.near && !this.preNear) {
      this.warmFrames++;
      if (this.warmFrames < MAP_SKY_WARM_DELAY_FRAMES) return;
      this.preNear = nearStarsFromList(this.opts.source.nearest(this.current.position, MAP_NEAR_STARS));
      this.ensureSky(this.preNear);
    }
    this.stepSky(budgetMs);
  }

  // ------------------------------------------------------------------ the Screen interface

  enter(): void {
    this.active = true;
    this.ensureData();
    this.view.attach();
    this.refreshTitle();
    this.refreshHud();
  }

  exit(): void {
    this.active = false;
    this.view.detach();
    this.routeTag?.hide();
    this.marks?.hide();
    if (this.statsEl) this.statsEl.style.display = "none";
  }

  update(seconds: number): void {
    const t0 = performance.now();
    const near = this.near;
    if (near) {
      this.view.glide(Math.min(0.1, seconds));
      const u = orbitCameraPosition(this.view.yaw, this.view.pitch, 1);
      this.view.maxDist = maxOrbitDistance(this.view.target, u, this.zoomLimit(near), Math.max(this.view.minDist, ROOM_AROUND_TARGET_LY));
      if (this.view.dist > this.view.maxDist) this.view.dist = this.view.maxDist;
    }
    this.view.apply();
    if (near) this.updateRoute(seconds, near);
    // Keep the markers about the same size on screen, however far you zoom.
    const s = this.view.dist * 0.045;
    this.currentMarker.scale.setScalar(s * 1.3);
    this.selectionMarker.scale.setScalar(s);
    this.selectionMarker.rotation.y += 0.02;
    this.backdrop.position.copy(this.camera.position); // the plain backdrop dots stay around the camera
    this.stepSky();
    this.sky.follow(this.camera);
    this.jsMs += (performance.now() - t0 - this.jsMs) * 0.1;
    this.frameMs += (seconds * 1000 - this.frameMs) * 0.1;
    this.updateStats(seconds);
  }

  /** Draws the sky first (it never moves, only turns with the camera), then the stars over it. */
  render(renderer: THREE.WebGLRenderer): void {
    const autoClear = renderer.autoClear;
    const autoReset = renderer.info.autoReset;
    renderer.autoClear = false;
    renderer.info.autoReset = false;
    renderer.info.reset();
    renderer.clear();
    if (this.skyBuilt) renderer.render(this.sky.scene, this.sky.camera);
    renderer.render(this.scene, this.camera);
    this.drawInfo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    renderer.info.autoReset = autoReset;
    renderer.autoClear = autoClear;
  }

  /** What the map holds now, for the developer counters and the report. */
  stats(): { stars: number; diamonds: number; tappable: number; buildMs: number; zoomLimitLy: number; radiusLy: number; diamondLy: number; sky: SkyStats | null } {
    const near = this.near;
    return {
      stars: near?.count ?? 0,
      diamonds: this.counts.diamonds,
      tappable: this.grid?.count ?? 0,
      buildMs: this.lastBuildMs,
      zoomLimitLy: near ? this.zoomLimit(near) : 0,
      radiusLy: near?.radius ?? 0,
      diamondLy: diamondSize(1, near?.spacingLy),
      sky: this.skyStats,
    };
  }

  private updateStats(seconds: number): void {
    const el = this.statsEl;
    if (!el) return;
    this.statsClock += seconds;
    if (this.statsClock < 0.5) return;
    this.statsClock = 0;
    el.style.display = "block";
    const st = this.stats();
    const p = this.pendingSky;
    let progress: number | null = null;
    if (p) {
      const glowShare = p.glow ? (p.glow.done ? 1 : p.glow.progress) : 1;
      const dotsShare = p.dots ? (p.dots.done ? 1 : p.dots.progress) : 1;
      progress = (glowShare + dotsShare) / 2;
    }
    const block = mapStatsText({
      stars: st.stars,
      diamonds: st.diamonds,
      tappable: st.tappable,
      radiusLy: st.radiusLy,
      zoomLimitLy: st.zoomLimitLy,
      diamondLy: st.diamondLy,
      lookupMs: st.buildMs,
      sky: st.sky,
      skyProgress: this.skyField ? progress : null,
      frameMs: this.frameMs,
      jsMs: this.jsMs,
      drawCalls: this.drawInfo.calls,
      triangles: this.drawInfo.triangles,
    });
    el.textContent = block + this.routeStatsText();
  }

  /** One extra line for the developer counters when a plan or places are shown: the look, the stops and what was drawn. */
  private routeStatsText(): string {
    const shape = this.routeShape;
    if (!shape && this.nav.places().length === 0) return `\nTURN EASING ${Math.round(this.view.turnSmoothSeconds * 1000)} ms`;
    const c = this.route.counts();
    const marks = c.hop + c.refuel + c.target + c.start + c.outpost + c.starred + c.recent;
    return `\nPLAN ${shape ? shape.count - 1 : 0} hops, ${shape ? Math.round(shape.targetLy) : 0} ly to target (edge option ${this.targetMode}); markers ${marks} (far ${c.far}), dashes ${c.dashes}, dots ${c.dots}; icons ${this.marks ? "fine" : "chunky"}; turn easing ${Math.round(this.view.turnSmoothSeconds * 1000)} ms`;
  }

  // ------------------------------------------------------------------ taps

  /** A tap on the picture: the nearest star to the finger (inside the tap circle) is picked and the camera glides to it. */
  private handleTap(clientX: number, clientY: number): void {
    const near = this.near;
    const grid = this.grid;
    if (!near || !grid) return;
    const rect = this.opts.host.getBoundingClientRect();
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    this.camera.updateMatrixWorld();
    this.tapRay.set(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const maxAngle = Math.atan((MAP_TAP_RADIUS_PX / (Math.max(1, rect.height) / 2)) * Math.tan(halfFov));
    const p = this.camera.position;
    const hit = grid.pick(p.x, p.y, p.z, this.tapRay.x, this.tapRay.y, this.tapRay.z, maxAngle, this.camera.far, this.camera.near, {
      visibility: this.tapVis,
      minVisible: MIN_TAP_VISIBILITY,
    });
    this.select(hit ? hit.index : null);
  }

  private select(index: number | null): void {
    const near = this.near;
    if (!near || index === null || index < 0 || index >= near.count) {
      this.selected = null;
      this.nearestLine = "";
      this.selectionMarker.visible = false;
      if (near) this.layers.setSelected(near, null);
      this.opts.state.set({ selectedSystemId: null });
      this.refreshHud();
      return;
    }
    this.selected = index;
    this.layers.setSelected(near, index);
    const x = near.positions[index * 3] ?? 0;
    const y = near.positions[index * 3 + 1] ?? 0;
    const z = near.positions[index * 3 + 2] ?? 0;
    this.selectionMarker.position.set(x, y, z);
    this.selectionMarker.visible = true;
    this.view.focusOn(x, y, z, FLY_TO_DIST_LY);
    // The only extra text on the map: the tapped star's 5 nearest neighbours (no label per star in the picture).
    const around = nearestTo(near.positions, Math.min(MAP_TAPPABLE_STARS, near.count), index, 5);
    this.nearestLine = nearestLineText(around.map((n) => n.distance));
    this.opts.state.set({ selectedSystemId: near.ids[index] ?? null });
    this.refreshHud();
  }

  // ------------------------------------------------------------------ the words on screen

  private refreshTitle(): void {
    const test = this.opts.testView;
    this.opts.hud.setTitle(
      test ? `STARMAP TEST VIEW: ${test} (not where your ship is)` : `STARMAP - you are in ${this.current.name} (${this.current.starLabel})`,
    );
  }

  private refreshHud(): void {
    const hud = this.opts.hud;
    const source = this.opts.source;
    const near = this.near;
    const index = this.selected;
    const id = near && index !== null ? (near.ids[index] ?? null) : null;
    const info = id !== null && source ? source.describe(id) : null;
    if (near && index !== null && id !== null) {
      const d = near.distances[index] ?? 0;
      const here = id === this.current.id;
      const head = info ? starLabelText(info.name, info.starLabel, d, here) : starLabelText(`System ${id}`, "unknown star", d, here);
      hud.setLabel(this.nearestLine ? `${head}\n${this.nearestLine}` : head);
    } else {
      hud.setLabel(starmapHint());
    }
    hud.setButtons([
      {
        text: "Open system",
        disabled: id === null,
        onClick: () => {
          if (id !== null) this.opts.onOpenSystem(id);
        },
      },
    ]);
  }
}
