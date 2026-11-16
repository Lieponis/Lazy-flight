// THE GALAXY MAP PREVIEW PAGE (prototype G2, /galaxy-map-preview.html). A separate page: it never touches the game's own map.
//
// What it shows: the sky and the nearby stars as seen from a place in a stand-in galaxy. Buttons jump to the galaxy centre,
// the start region, the middle and the rim, and turn the view toward the galaxy centre, toward the rim, or up out of the disc,
// so the sky can be seen to change. Counters on screen show what everything costs (stars, triangles, draw calls, times).

import * as THREE from "three";
import { BACKGROUND_COLOR, RENDER_HEIGHT, RENDER_WIDTH } from "../../settings";
import { cameraFov, renderSizeFor } from "../helpers";
import { OrbitView } from "../input";
import {
  TELEPORTS,
  lookDirection,
  spacingAtRadius,
  standInField,
  type LookId,
  type Teleport,
} from "./galaxyfield";
import { countWithin, directionsOf, makeNearStars, DENSITY_SPACINGS, type NearStars } from "./neardata";
import { NearLayers, type NearCounts } from "./nearlayers";
import {
  DIAMOND_CAPS,
  FACE_SIZES,
  NEAR_TOTAL,
  REACHES,
  lyText,
  orbitAnglesFor,
  parsePreviewParams,
  type PreviewParams,
} from "./previewmath";
import { skyCellOf, type SkyCell } from "./skycell";
import { SkyBuilder, type Vec3 } from "./skycube";
import { SKY_LOOKS, skyToTexels, type SkyLookId } from "./skylook";
import { makeFaintStars, removeNearOverlaps, type FaintStars } from "./skystars";
import { SkyView } from "./skyview";

/** Milliseconds per frame the sky build may use (the rest of the frame stays for drawing). */
const SKY_BUDGET_MS = 6;
/** Steps along each sky ray. */
const SKY_STEPS = 56;
/** Real stars closest to the player whose directions keep fake sky dots away. */
const OVERLAP_STARS = 3000;
const OVERLAP_CELL_DEG = 0.35;

interface SkyStats {
  /** Wall-clock milliseconds from the start of the build to the finished sky (frames included). */
  wallMs: number;
  /** Milliseconds of real work (what the build costs the processor). */
  workMs: number;
  frames: number;
  maxFrameMs: number;
  cellSize: number;
  texelsMs: number;
  starsMs: number;
  dots: number;
  dotsRemoved: number;
}

interface PendingSky {
  builder: SkyBuilder;
  cell: SkyCell;
  signature: string;
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
  const camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.5, 800);
  const sky = new SkyView();
  const layers = new NearLayers();
  scene.add(layers.group);
  const orbit = new OrbitView(camera, canvas, 8, 150, 66);
  orbit.attach();

  // ------------------------------------------------------------------ state
  const state = {
    place: TELEPORTS.find((t) => t.id === params.place) ?? (TELEPORTS[1] as Teleport),
    position: { x: 0, y: 0, z: 0 } as Vec3,
    look: params.look as LookId,
    skyLook: params.sky as SkyLookId,
    face: params.face as number,
    density: params.density as "auto" | number,
    reach: params.reach as number,
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
  let pending: PendingSky | null = null;
  let builtSignature: string | null = null;
  let builtRaw: Float32Array | null = null;
  let builtCell: SkyCell | null = null;
  let skyStats: SkyStats | null = null;

  // ------------------------------------------------------------------ near stars
  function currentSpacing(): number {
    return state.density === "auto" ? spacingAtRadius(Math.hypot(state.position.x, state.position.z)) : state.density;
  }

  function refreshNear(): void {
    const t0 = performance.now();
    const spacing = currentSpacing();
    near = makeNearStars(NEAR_TOTAL, spacing, Math.round(spacing * 100) + 7);
    nearMs = performance.now() - t0;
    nearCounts = layers.setStars(near, countWithin(near, state.reach), state.diamondCap);
    camera.far = Math.max(800, near.radius * 3);
    camera.updateProjectionMatrix();
    orbit.maxDist = Math.max(150, near.radius * 1.3);
    layers.setVisible(state.pixels, state.diamondsOn);
    ensureSky();
  }

  // ------------------------------------------------------------------ the sky
  /** Starts a new sky build when the player has left the sky cell, or the size or the near-star radius changed a lot. */
  function ensureSky(): void {
    const cell = skyCellOf(state.position);
    // The near radius is grouped in steps of about 19 % so a small change does not start a new build.
    const radiusStep = Math.round(Math.log2(Math.max(1, near.radius)) * 4);
    const signature = `${cell.key}|${state.face}|${radiusStep}`;
    if (signature === builtSignature || signature === pending?.signature) return;
    pending = {
      builder: new SkyBuilder(standInField, cell.centre, { faceSize: state.face, steps: SKY_STEPS, nearRadius: near.radius }),
      cell,
      signature,
      startMs: performance.now(),
      frames: 0,
      maxFrameMs: 0,
    };
  }

  function applySkyLook(): void {
    if (!builtRaw || !builtCell) return;
    const look = SKY_LOOKS[state.skyLook];
    const t0 = performance.now();
    const texels = skyToTexels(builtRaw, look);
    sky.setTexels(texels, state.face);
    sky.setLook(look);
    const t1 = performance.now();
    const all: FaintStars = makeFaintStars(builtRaw, state.face, look, look.faintStars, builtCell.starSeed);
    const kept = removeNearOverlaps(all, directionsOf(near, OVERLAP_STARS), OVERLAP_CELL_DEG);
    sky.setStars(kept);
    const t2 = performance.now();
    if (skyStats) {
      skyStats.texelsMs = t1 - t0;
      skyStats.starsMs = t2 - t1;
      skyStats.dots = kept.count;
      skyStats.dotsRemoved = all.count - kept.count;
    }
    sky.setVisible(state.glow, state.dots);
  }

  function stepSky(): void {
    if (!pending) return;
    const t0 = performance.now();
    const done = pending.builder.run(SKY_BUDGET_MS);
    const used = performance.now() - t0;
    pending.frames++;
    pending.maxFrameMs = Math.max(pending.maxFrameMs, used);
    if (!done) return;
    const p = pending;
    pending = null;
    builtRaw = p.builder.raw;
    builtCell = p.cell;
    builtSignature = p.signature;
    skyStats = {
      wallMs: performance.now() - p.startMs,
      workMs: p.builder.workMs,
      frames: p.frames,
      maxFrameMs: p.maxFrameMs,
      cellSize: p.cell.size,
      texelsMs: 0,
      starsMs: 0,
      dots: 0,
      dotsRemoved: 0,
    };
    applySkyLook();
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
    orbit.dist = Math.max(60, state.reach * 1.2);
    refreshNear();
    lookAt(state.look);
  }

  function move(towards: "centre" | "rim", ly: number): void {
    const d = lookDirection(towards, state.position);
    state.position = { x: state.position.x + d.x * ly, y: state.position.y + d.y * ly, z: state.position.z + d.z * ly };
    refreshNear();
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
        "SKY SIZE",
        FACE_SIZES.map((f) => ({
          label: `${f}x${f}`,
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
      group(
        "REACH",
        REACHES.map((r) => ({
          label: `${r} LY`,
          on: state.reach === r,
          pick: act(() => {
            state.reach = r;
            refreshNear();
          }),
        })),
      ),
      group(
        "DIAMOND CAP",
        DIAMOND_CAPS.map((c) => ({
          label: c.toLocaleString("en-US"),
          on: state.diamondCap === c,
          pick: act(() => {
            state.diamondCap = c;
            refreshNear();
          }),
        })),
      ),
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
    renderHeight = size.height;
  }
  let renderHeight = RENDER_HEIGHT;
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
    orbit.apply();
    sky.follow(camera, renderHeight);
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
      `NEAR STARS ${near.count.toLocaleString("en-US")} (made in ${nearMs.toFixed(0)} ms)  diamonds ${nearCounts.diamonds.toLocaleString("en-US")}  pixels ${nearCounts.pixels.toLocaleString("en-US")}`,
    ];
    if (pending) {
      lines.push(`SKY BUILDING ${Math.round(pending.builder.progress * 100)}%  (${SKY_BUDGET_MS} ms per frame)`);
    }
    if (skyStats) {
      lines.push(
        `SKY ${state.face}x${state.face}x6, ${SKY_STEPS} steps: built in ${skyStats.wallMs.toFixed(0)} ms over ${skyStats.frames} frames (work ${skyStats.workMs.toFixed(0)} ms, worst frame ${skyStats.maxFrameMs.toFixed(1)} ms)`,
        `SKY CELL ${lyText(skyStats.cellSize)}  colours ${skyStats.texelsMs.toFixed(1)} ms  dots ${skyStats.dots.toLocaleString("en-US")} (${skyStats.dotsRemoved} removed near real stars, ${skyStats.starsMs.toFixed(1)} ms)`,
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
  orbit.dist = Math.max(60, state.reach * 1.2);
  refreshNear();
  lookAt(state.look);
  requestAnimationFrame(frame);
}
