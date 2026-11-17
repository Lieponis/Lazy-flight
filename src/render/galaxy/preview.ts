// THE GALAXY MAP PREVIEW PAGE (prototype G2, /galaxy-map-preview.html). A separate page: it never touches the game's own map.
//
// What it shows: the sky and the nearby stars as seen from a place in a stand-in galaxy. Buttons jump to the galaxy centre,
// the start region, the middle and the rim, and turn the view toward the galaxy centre, toward the rim, or up out of the disc,
// so the sky can be seen to change. Counters on screen show what everything costs (stars, triangles, draw calls, times).

import * as THREE from "three";
import { BACKGROUND_COLOR, RENDER_HEIGHT, RENDER_WIDTH } from "../../settings";
import { cameraFov, orbitCameraPosition, renderSizeFor } from "../helpers";
import { OrbitView } from "../input";
import {
  TELEPORTS,
  lookDirection,
  spacingAtRadius,
  standInField,
  standInProposal,
  type LookId,
  type Teleport,
} from "./galaxyfield";
import { countWithin, directionsOf, makeNearStars, DENSITY_SPACINGS, type NearStars } from "./neardata";
import { NearLayers, type NearCounts } from "./nearlayers";
import {
  DIAMOND_CAPS,
  FACE_SIZES,
  FLY_TO_DIST_LY,
  MIN_ZOOM_LY,
  NEAR_TOTAL,
  REACHES,
  ROOM_AROUND_TARGET_LY,
  TAP_COUNTS,
  ZOOM_OUT_MODES,
  type ZoomOutMode,
  autoReach,
  lyText,
  maxOrbitDistance,
  orbitAnglesFor,
  parsePreviewParams,
  zoomOutLimit,
  type PreviewParams,
} from "./previewmath";
import { skyCellOf, type SkyCell } from "./skycell";
import { DotsBuilder } from "./skydots";
import { layoutFor, SkyBuilder, type Vec3 } from "./skyglow";
import { GLOW_LEVELS, SKY_LOOKS, skyToTexels, type SkyLookId } from "./skylook";
import { removeNearOverlaps } from "./skystars";
import { SkyView } from "./skyview";
import { StarGrid } from "./starpick";

/** Milliseconds per frame the sky build may use (the rest of the frame stays for drawing). */
const SKY_BUDGET_MS = 6;
/** Steps along each sky ray. */
const SKY_STEPS = 56;
/** Real stars closest to the player whose directions keep fake sky dots away. */
const OVERLAP_STARS = 3000;
const OVERLAP_CELL_DEG = 0.35;
/** How far from a star (CSS pixels) a tap still counts as hitting it. */
const TAP_RADIUS_PX = 20;

interface SkyStats {
  /** Wall-clock milliseconds from the start of the build to the finished sky (frames included). */
  wallMs: number;
  /** Milliseconds of real work for the soft glow (0 when the glow did not need building again). */
  glowWorkMs: number;
  /** Milliseconds of real work for the dots (0 when they did not need building again). */
  dotsWorkMs: number;
  frames: number;
  maxFrameMs: number;
  cellSize: number;
  /** Squares in the glow. */
  squares: number;
  colourMs: number;
  overlapMs: number;
  dots: number;
  dotsRemoved: number;
}

interface PendingSky {
  glow: SkyBuilder | null;
  dots: DotsBuilder | null;
  cell: SkyCell;
  glowSignature: string;
  dotsSignature: string;
  startMs: number;
  frames: number;
  maxFrameMs: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

export function mountGalaxyPreview(root: HTMLElement): void {
  const params: PreviewParams = parsePreviewParams(window.location.search);

  // ------------------------------------------------------------------ the page
  const canvas = el("canvas", "gm-canvas");
  const stats = el("pre", "gm-stats");
  const panel = el("div", "gm-panel");
  const menuButton = el("button", "gm-menu", "MENU");
  root.append(canvas, stats, panel, menuButton);
  menuButton.addEventListener("click", () => panel.classList.toggle("hidden"));

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  } catch {
    root.textContent = "This page needs WebGL, and the browser did not give it.";
    return;
  }
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  renderer.setClearColor(BACKGROUND_COLOR);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.2, 800);
  const sky = new SkyView();
  const layers = new NearLayers();
  scene.add(layers.group);
  const orbit = new OrbitView(camera, canvas, MIN_ZOOM_LY, 150, 66);
  orbit.attach();
  const tapRay = new THREE.Vector3();

  // ------------------------------------------------------------------ state
  const state = {
    place: TELEPORTS.find((t) => t.id === params.place) ?? (TELEPORTS[1] as Teleport),
    position: { x: 0, y: 0, z: 0 } as Vec3,
    look: params.look as LookId,
    skyLook: params.sky as SkyLookId,
    /** Glow strength chosen with the GLOW LEVEL buttons (null = the look's own). */
    glowLevel: null as number | null,
    face: params.face as number,
    density: params.density as "auto" | number,
    /** Ship reach in light years, or "auto" (see autoReach). */
    reach: params.reach as "auto" | number,
    tapCount: params.tap as number,
    zoomOut: params.zoom as ZoomOutMode,
    diamondCap: params.diamonds as number,
    glow: params.glow,
    dots: params.dots,
    pixels: params.pixels,
    diamondsOn: params.diamondsOn,
  };
  state.position = { ...state.place.position };

  let near: NearStars = makeNearStars(1, 8.6, 1);
  let nearCounts: NearCounts = { diamonds: 0, pixels: 0, triangles: 0 };
  let nearMs = 0;
  /** The reach in light years actually used now ("auto" resolved). */
  let reachNow = 55;
  let grid: StarGrid | null = null;
  let gridMs = 0;
  /** The star the player tapped last (null = none). */
  let selected: number | null = null;
  const tapStats = { taps: 0, lastMs: 0, worstMs: 0, lastTested: 0, message: "no tap yet" };
  let pending: PendingSky | null = null;
  let builtGlowSignature: string | null = null;
  let builtDotsSignature: string | null = null;
  let skyStats: SkyStats | null = null;

  // ------------------------------------------------------------------ near stars
  function currentSpacing(): number {
    return state.density === "auto" ? spacingAtRadius(Math.hypot(state.position.x, state.position.z)) : state.density;
  }

  /** How far the camera starts from the player at a place: far enough to see the stars within reach. */
  function defaultDist(): number {
    return Math.min(Math.max(60, reachNow * 1.2), zoomLimit());
  }

  /** The farthest the camera may be from the player now (see zoomOutLimit). */
  function zoomLimit(): number {
    return zoomOutLimit(state.zoomOut, near.distances, near.count, near.radius);
  }

  /** `keepView`: the stars are the same (only reach, caps or tap count changed), so the camera stays where it is. */
  function refreshNear(keepView = false): void {
    const t0 = performance.now();
    const spacing = currentSpacing();
    near = makeNearStars(NEAR_TOTAL, spacing, Math.round(spacing * 100) + 7);
    nearMs = performance.now() - t0;
    reachNow = state.reach === "auto" ? autoReach((r) => countWithin(near, r)) : state.reach;
    nearCounts = layers.setStars(near, countWithin(near, reachNow), state.diamondCap);
    const t1 = performance.now();
    grid = new StarGrid(near.positions, state.tapCount);
    gridMs = performance.now() - t1;
    if (!keepView) {
      selected = null;
      orbit.resetFocus();
      tapStats.message = "no tap yet";
    }
    layers.setSelected(near, selected);
    // The camera stays within the zoom-out limit of the player (see maxOrbitDistance), so it is also inside the bubble.
    camera.far = Math.max(800, near.radius * 2.2 + 50);
    camera.updateProjectionMatrix();
    layers.setVisible(state.pixels, state.diamondsOn);
    ensureSky();
  }

  /** A tap on the picture: the star under the finger becomes the camera's new centre, and the camera glides to it. */
  function tapAt(clientX: number, clientY: number): void {
    if (!grid) return;
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    tapRay.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    const halfFov = (camera.fov * Math.PI) / 360;
    const maxAngle = Math.atan((TAP_RADIUS_PX / (Math.max(1, rect.height) / 2)) * Math.tan(halfFov));
    const t0 = performance.now();
    const hit = grid.pick(camera.position.x, camera.position.y, camera.position.z, tapRay.x, tapRay.y, tapRay.z, maxAngle, camera.far, camera.near);
    const ms = performance.now() - t0;
    tapStats.taps++;
    tapStats.lastMs = ms;
    tapStats.worstMs = Math.max(tapStats.worstMs, ms);
    tapStats.lastTested = grid.tested;
    if (!hit) {
      tapStats.message = "tap found no star within " + TAP_RADIUS_PX + " px";
      return;
    }
    selected = hit.index;
    layers.setSelected(near, selected);
    const x = near.positions[hit.index * 3] ?? 0;
    const y = near.positions[hit.index * 3 + 1] ?? 0;
    const z = near.positions[hit.index * 3 + 2] ?? 0;
    orbit.focusOn(x, y, z, FLY_TO_DIST_LY);
    tapStats.message = `star #${near.ids[hit.index] ?? hit.index} (the ${(hit.index + 1).toLocaleString("en-US")}th nearest), ${(near.distances[hit.index] ?? 0).toFixed(0)} ly from you`;
  }

  /** Back to looking at the player, at the starting zoom. */
  function backToPlayer(): void {
    selected = null;
    layers.setSelected(near, null);
    orbit.focusOn(0, 0, 0, defaultDist());
    tapStats.message = "back on the player";
  }

  // ------------------------------------------------------------------ the sky
  /**
   * Starts a new sky build when the player has left the sky cell, or the sky size, the dot count or the near-star radius changed.
   * The soft glow and the dots are separate builds: changing only the look (dot count) leaves a finished glow alone.
   */
  function ensureSky(): void {
    const cell = skyCellOf(state.position);
    // The near radius is grouped in steps of about 19 % so a small change does not start a new build.
    const radiusStep = Math.round(Math.log2(Math.max(1, near.radius)) * 4);
    const glowSignature = `${cell.key}|${state.face}|${radiusStep}`;
    const dotsSignature = `${cell.key}|${radiusStep}|${SKY_LOOKS[state.skyLook].dots}`;
    if (pending && pending.glowSignature === glowSignature && pending.dotsSignature === dotsSignature) return;
    const needGlow = glowSignature !== builtGlowSignature;
    const needDots = dotsSignature !== builtDotsSignature;
    if (!needGlow && !needDots) {
      pending = null;
      return;
    }
    pending = {
      glow: needGlow ? new SkyBuilder(standInField, cell.centre, { faceSize: state.face, steps: SKY_STEPS, nearRadius: near.radius }) : null,
      dots: needDots
        ? new DotsBuilder(standInField, standInProposal, cell.centre, { count: SKY_LOOKS[state.skyLook].dots, nearRadius: near.radius, seed: cell.starSeed, squeeze: 0.5 })
        : null,
      cell,
      glowSignature,
      dotsSignature,
      startMs: performance.now(),
      frames: 0,
      maxFrameMs: 0,
    };
  }

  /** The glow strength now: the look's own, or the one picked with the GLOW LEVEL buttons (only for looks that have a glow). */
  function glowStrength(): number {
    const own = SKY_LOOKS[state.skyLook].glow;
    return own > 0 && state.glowLevel !== null ? state.glowLevel : own;
  }

  /** The look changed: the glow strength changes at once, a different dot count starts a new dots build. */
  function applySkyLook(): void {
    sky.setGlowStrength(glowStrength());
    ensureSky();
  }

  function stepSky(): void {
    if (!pending) return;
    const t0 = performance.now();
    const p = pending;
    // The glow is built first, then the dots (each frame spends about SKY_BUDGET_MS on one of them).
    if (p.glow && !p.glow.done) p.glow.run(SKY_BUDGET_MS);
    else if (p.dots && !p.dots.done) p.dots.run(SKY_BUDGET_MS);
    const used = performance.now() - t0;
    p.frames++;
    p.maxFrameMs = Math.max(p.maxFrameMs, used);
    if (!((!p.glow || p.glow.done) && (!p.dots || p.dots.done))) return;
    pending = null;
    const stats: SkyStats = {
      wallMs: performance.now() - p.startMs,
      glowWorkMs: p.glow?.workMs ?? 0,
      dotsWorkMs: p.dots?.workMs ?? 0,
      frames: p.frames,
      maxFrameMs: p.maxFrameMs,
      cellSize: p.cell.size,
      squares: skyStats?.squares ?? 0,
      colourMs: 0,
      overlapMs: 0,
      dots: skyStats?.dots ?? 0,
      dotsRemoved: skyStats?.dotsRemoved ?? 0,
    };
    if (p.glow) {
      const t1 = performance.now();
      sky.setTexels(skyToTexels(p.glow.raw), p.glow.layout);
      stats.colourMs = performance.now() - t1;
      stats.squares = p.glow.layout.total;
      builtGlowSignature = p.glowSignature;
    }
    if (p.dots) {
      const t1 = performance.now();
      const all = p.dots.result();
      const kept = removeNearOverlaps(all, directionsOf(near, OVERLAP_STARS), OVERLAP_CELL_DEG);
      sky.setStars(kept);
      stats.overlapMs = performance.now() - t1;
      stats.dots = kept.count;
      stats.dotsRemoved = all.count - kept.count;
      builtDotsSignature = p.dotsSignature;
    }
    skyStats = stats;
    sky.setGlowStrength(glowStrength());
    sky.setVisible(state.glow, state.dots);
  }

  // ------------------------------------------------------------------ actions
  function lookAt(id: LookId): void {
    state.look = id;
    const a = orbitAnglesFor(lookDirection(id, state.position));
    orbit.yaw = a.yaw;
    orbit.pitch = Math.max(-1.5, Math.min(1.5, a.pitch));
  }

  function teleport(place: Teleport): void {
    state.place = place;
    state.position = { ...place.position };
    refreshNear();
    orbit.dist = defaultDist();
    lookAt(state.look);
  }

  function move(towards: "centre" | "rim", ly: number): void {
    const d = lookDirection(towards, state.position);
    state.position = { x: state.position.x + d.x * ly, y: state.position.y + d.y * ly, z: state.position.z + d.z * ly };
    refreshNear();
    orbit.dist = defaultDist();
    lookAt(state.look);
  }

  // ------------------------------------------------------------------ panel
  /** Runs an action, then draws the panel again so the highlighted buttons are right. */
  function act(fn: () => void): () => void {
    return () => {
      fn();
      renderPanel();
    };
  }

  function group(title: string, options: { label: string; on: boolean; pick: () => void }[]): HTMLElement {
    const g = el("div", "gm-group");
    g.append(el("span", "gm-title", title));
    for (const o of options) {
      const b = el("button", o.on ? "on" : "", o.label);
      b.type = "button";
      b.addEventListener("click", o.pick);
      g.append(b);
    }
    return g;
  }

  function renderPanel(): void {
    panel.textContent = "";
    panel.append(
      group(
        "PLACE",
        TELEPORTS.map((t) => ({ label: t.label, on: state.place.id === t.id && sameSpot(t), pick: act(() => teleport(t)) })),
      ),
      group("LOOK", [
        { label: "TOWARD CENTRE", on: state.look === "centre", pick: act(() => lookAt("centre")) },
        { label: "TOWARD RIM", on: state.look === "rim", pick: act(() => lookAt("rim")) },
        { label: "UP", on: state.look === "up", pick: act(() => lookAt("up")) },
      ]),
      group("MOVE 1,000 LY", [
        { label: "TOWARD CENTRE", on: false, pick: act(() => move("centre", 1000)) },
        { label: "TOWARD RIM", on: false, pick: act(() => move("rim", 1000)) },
      ]),
      group(
        "SKY LOOK",
        (["A", "B", "C"] as SkyLookId[]).map((id) => ({
          label: `${id} ${SKY_LOOKS[id].label}`,
          on: state.skyLook === id,
          pick: act(() => {
            state.skyLook = id;
            applySkyLook();
          }),
        })),
      ),
      group(
        "GLOW LEVEL",
        GLOW_LEVELS.map((g) => ({
          label: g === 0.14 ? "LOW" : g === 0.24 ? "MEDIUM" : "HIGH",
          on: glowStrength() === g,
          pick: act(() => {
            state.glowLevel = g;
            applySkyLook();
          }),
        })),
      ),
      group(
        "SKY SIZE",
        FACE_SIZES.map((f) => ({
          label: `${Math.round(layoutFor(f).total / 100) / 10}K SQUARES`,
          on: state.face === f,
          pick: act(() => {
            state.face = f;
            ensureSky();
          }),
        })),
      ),
      group("STAR SPACING", [
        {
          label: "AUTO",
          on: state.density === "auto",
          pick: act(() => {
            state.density = "auto";
            refreshNear();
          }),
        },
        ...DENSITY_SPACINGS.map((spacing) => ({
          label: `${spacing} LY`,
          on: state.density === spacing,
          pick: act(() => {
            state.density = spacing;
            refreshNear();
          }),
        })),
      ]),
      group("SHIP REACH", [
        {
          label: "AUTO",
          on: state.reach === "auto",
          pick: act(() => {
            state.reach = "auto";
            refreshNear(true);
          }),
        },
        ...REACHES.map((r) => ({
          label: `${r} LY`,
          on: state.reach === r,
          pick: act(() => {
            state.reach = r;
            refreshNear(true);
          }),
        })),
      ]),
      group(
        "DIAMOND CAP",
        DIAMOND_CAPS.map((c) => ({
          label: c.toLocaleString("en-US"),
          on: state.diamondCap === c,
          pick: act(() => {
            state.diamondCap = c;
            refreshNear(true);
          }),
        })),
      ),
      group(
        "TAPPABLE STARS",
        TAP_COUNTS.map((c) => ({
          label: c.toLocaleString("en-US"),
          on: state.tapCount === c,
          pick: act(() => {
            state.tapCount = c;
            refreshNear(true);
          }),
        })),
      ),
      group(
        "ZOOM OUT LIMIT",
        ZOOM_OUT_MODES.map((m) => ({
          label: `${m.toUpperCase()} ${lyText(zoomOutLimit(m, near.distances, near.count, near.radius))}`,
          on: state.zoomOut === m,
          pick: act(() => {
            state.zoomOut = m;
          }),
        })),
      ),
      group("CAMERA", [{ label: "BACK TO PLAYER", on: false, pick: act(() => backToPlayer()) }]),
      group("LAYERS", [
        {
          label: "GLOW",
          on: state.glow,
          pick: act(() => {
            state.glow = !state.glow;
            sky.setVisible(state.glow, state.dots);
          }),
        },
        {
          label: "DOTS",
          on: state.dots,
          pick: act(() => {
            state.dots = !state.dots;
            sky.setVisible(state.glow, state.dots);
          }),
        },
        {
          label: "PIXELS",
          on: state.pixels,
          pick: act(() => {
            state.pixels = !state.pixels;
            layers.setVisible(state.pixels, state.diamondsOn);
          }),
        },
        {
          label: "DIAMONDS",
          on: state.diamondsOn,
          pick: act(() => {
            state.diamondsOn = !state.diamondsOn;
            layers.setVisible(state.pixels, state.diamondsOn);
          }),
        },
      ]),
    );
  }

  function sameSpot(t: Teleport): boolean {
    return Math.abs(t.position.x - state.position.x) < 1 && Math.abs(t.position.y - state.position.y) < 1 && Math.abs(t.position.z - state.position.z) < 1;
  }

  // ------------------------------------------------------------------ size and loop
  function resize(): void {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const size = renderSizeFor(aspect, RENDER_WIDTH, RENDER_HEIGHT);
    renderer.setSize(size.width, size.height, false);
    camera.aspect = size.width / size.height;
    camera.fov = cameraFov(camera.aspect, 50);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let last = performance.now();
  let frameMs = 16.7;
  let jsMs = 1;
  let statsClock = 0;

  function frame(now: number): void {
    const dt = now - last;
    last = now;
    frameMs += (dt - frameMs) * 0.1;
    const t0 = performance.now();
    stepSky();
    orbit.glide(Math.min(0.1, dt / 1000));
    // The camera may not zoom out farther than the zoom-out limit: no separate ball of stars (Andy).
    const u = orbitCameraPosition(orbit.yaw, orbit.pitch, 1);
    orbit.maxDist = maxOrbitDistance(orbit.target, u, zoomLimit(), Math.max(orbit.minDist, ROOM_AROUND_TARGET_LY));
    if (orbit.dist > orbit.maxDist) orbit.dist = orbit.maxDist;
    orbit.apply();
    sky.follow(camera);
    renderer.info.reset();
    renderer.clear();
    renderer.render(sky.scene, sky.camera);
    renderer.render(scene, camera);
    jsMs += (performance.now() - t0 - jsMs) * 0.1;
    statsClock += dt;
    if (statsClock > 250) {
      statsClock = 0;
      stats.textContent = statsText();
    }
    requestAnimationFrame(frame);
  }

  function statsText(): string {
    const p = state.position;
    const r = Math.hypot(p.x, p.z);
    const info = renderer.info.render;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const lines = [
      `PLACE ${sameSpot(state.place) ? state.place.label : "MOVED"}  ${lyText(r)} from centre  spacing ${currentSpacing().toFixed(1)} ly`,
      `NEAR STARS ${near.count.toLocaleString("en-US")} (made in ${nearMs.toFixed(0)} ms, bubble radius ${lyText(near.radius)})  REACH ${state.reach === "auto" ? "auto = " : ""}${reachNow} ly  diamonds ${nearCounts.diamonds.toLocaleString("en-US")}  pixels ${nearCounts.pixels.toLocaleString("en-US")}`,
      `CAMERA ${lyText(orbit.dist)} from its target (closest ${MIN_ZOOM_LY} ly, farthest now ${lyText(orbit.maxDist)}; zoom-out limit ${state.zoomOut} = ${lyText(zoomLimit())} from you)  target ${lyText(Math.hypot(orbit.target.x, orbit.target.y, orbit.target.z))} from you`,
      `TAP grid of ${state.tapCount.toLocaleString("en-US")} stars built in ${gridMs.toFixed(1)} ms  taps ${tapStats.taps}  last ${tapStats.lastMs.toFixed(2)} ms (looked at ${tapStats.lastTested} stars)  worst ${tapStats.worstMs.toFixed(2)} ms  -> ${tapStats.message}`,
    ];
    if (pending) {
      const glowShare = pending.glow ? pending.glow.progress : 1;
      const dotsShare = pending.dots ? pending.dots.progress : 1;
      lines.push(`SKY BUILDING glow ${Math.round(glowShare * 100)}%  dots ${Math.round(dotsShare * 100)}%  (${SKY_BUDGET_MS} ms per frame)`);
    }
    if (skyStats) {
      lines.push(
        `SKY BUILT in ${skyStats.wallMs.toFixed(0)} ms over ${skyStats.frames} frames (glow work ${skyStats.glowWorkMs.toFixed(0)} ms + dots work ${skyStats.dotsWorkMs.toFixed(0)} ms, worst frame ${skyStats.maxFrameMs.toFixed(1)} ms)`,
        `SKY CELL ${lyText(skyStats.cellSize)}  glow ${skyStats.squares.toLocaleString("en-US")} squares (${SKY_STEPS} steps, colours ${skyStats.colourMs.toFixed(1)} ms)  dots ${skyStats.dots.toLocaleString("en-US")} (${skyStats.dotsRemoved} removed near real stars, ${skyStats.overlapMs.toFixed(1)} ms)`,
      );
    }
    lines.push(
      `FRAME ${frameMs.toFixed(1)} ms (${(1000 / Math.max(1, frameMs)).toFixed(0)} fps)  JS ${jsMs.toFixed(1)} ms  draw calls ${info.calls}  triangles ${info.triangles.toLocaleString("en-US")}` +
        (mem ? `  heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : ""),
    );
    return lines.join("\n");
  }

  // Everything for the first picture.
  renderPanel();
  refreshNear();
  renderPanel(); // again: the zoom-out limit buttons show distances that depend on the stars
  orbit.dist = defaultDist();
  orbit.onTap = tapAt;
  lookAt(state.look);
  requestAnimationFrame(frame);
}
