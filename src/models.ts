// THE MODEL VIEWER (/models.html): look at every ship, outpost and station, and find what is wrong with them.
// Every control is written into the web address, so any exact view can be shared and opened again.
// This page only READS the game's old shapes (for "Compare"); it never changes them.

import * as THREE from "three";
import { boundsOf, checkEntry, checkModel, countModel, type Problem } from "./render/assets/checker";
import { ASSETS } from "./render/assets/registry";
import { REFERENCE_ENTRIES } from "./render/assets/reference";
import { pickOutpostVariant, pickStationVariant, OUTPOST_IDS, STATION_IDS } from "./render/assets/pickers";
import {
  DEFAULT_TINT,
  PAL,
  SWATCHES,
  TINT_EXAMPLES,
  parseHexColor,
  safeTint,
  safeTintDark,
  toHexText,
} from "./render/assets/palette";
import { shadeFor } from "./render/assets/kit";
import {
  BAY_SIZE,
  BLINK_ON,
  BLINK_PERIOD,
  GAME_CAMERA,
  MIN_PART_THICKNESS,
  PAD_DIAMETER,
  RING_SPIN_SPEED,
  RULES,
} from "./render/assets/style";
import type { AssetEntry, AssetModel } from "./render/assets/types";
import { CockpitLens } from "./render/assets/lens";
import { cameraFov, clamp, orbitCameraPosition, renderSizeFor, starfieldPositions } from "./render/helpers";
import { buildCargoHauler } from "./render/ship";
import { makeOutpost, makeStation } from "./render/systemview";
import { RENDER_HEIGHT, RENDER_WIDTH } from "./settings";
import { docksOf, getPlanet, listSystemsNear, type Planet } from "./universe";

// ------------------------------------------------------------------ state (mirrors the address)

type Page = "model" | "grid" | "style";
type Mode = "normal" | "wire" | "flat";
type Bg = "space" | "planet" | "bright";
type Preview = "off" | "desktop" | "phone";

interface ViewState {
  page: Page;
  asset: string;
  variant: number;
  tint: number;
  mode: Mode;
  bg: Bg;
  anim: boolean;
  preview: Preview;
  grid: boolean;
  box: boolean;
  anchors: boolean;
  compare: boolean;
  park: boolean;
  buddy: string;
  seed: number;
  cam: { yaw: number; pitch: number; dist: number } | null;
  /** Cockpits: camera at the pilot's eye. */
  sit: boolean;
  /** Field of view for "Sit inside", degrees side to side (top to bottom on a tall screen). */
  fov: number;
  /** "Sit inside": draw through the cockpit lens (no stretched edges). */
  lens: boolean;
  /** Show the window opening outline in "Sit inside". */
  cut: boolean;
  /** Where the pilot looks in "Sit inside": left-right and up-down, radians. */
  look: { yaw: number; pitch: number };
}

const ALL: AssetEntry[] = [...ASSETS, ...REFERENCE_ENTRIES];
const findEntry = (id: string): AssetEntry | undefined => ALL.find((e) => e.id === id);

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function readAddress(): ViewState {
  const q = new URLSearchParams(window.location.search);
  const show = (q.get("show") ?? "grid,anchors").split(",");
  const asset = findEntry(q.get("asset") ?? "")?.id ?? ASSETS[0]?.id ?? "scale-test";
  let cam: ViewState["cam"] = null;
  const camParts = (q.get("cam") ?? "").split(",").map(Number);
  if (camParts.length === 3 && camParts.every(Number.isFinite)) cam = { yaw: camParts[0]!, pitch: camParts[1]!, dist: camParts[2]! };
  return {
    page: oneOf(q.get("page"), ["model", "grid", "style"] as const, q.has("asset") ? "model" : "style"),
    asset,
    variant: Math.max(0, Math.floor(Number(q.get("variant") ?? 0)) || 0),
    tint: parseHexColor(q.get("tint")) ?? DEFAULT_TINT,
    mode: oneOf(q.get("mode"), ["normal", "wire", "flat"] as const, "normal"),
    bg: oneOf(q.get("bg"), ["space", "planet", "bright"] as const, "space"),
    anim: q.get("anim") !== "0",
    preview: oneOf(q.get("preview"), ["off", "desktop", "phone"] as const, "off"),
    grid: show.includes("grid"),
    box: show.includes("box"),
    anchors: show.includes("anchors"),
    compare: q.get("compare") === "1",
    park: q.get("park") === "1",
    buddy: findEntry(q.get("buddy") ?? "")?.id ?? "",
    sit: q.get("sit") === "1",
    fov: clamp(Number(q.get("fov")) || findEntry(asset)?.eyeFov || 60, 30, 100),
    cut: q.get("cut") === "1",
    lens: q.get("lens") !== "0",
    look: (() => {
      const l = (q.get("look") ?? "").split(",").map(Number);
      return l.length === 2 && l.every(Number.isFinite) ? { yaw: l[0]!, pitch: l[1]! } : { yaw: 0, pitch: 0 };
    })(),
    seed: Number.isFinite(Number(q.get("seed"))) && q.get("seed") ? Number(q.get("seed")) : 12345,
    cam,
  };
}

const S = readAddress();

function addressFor(s: ViewState): string {
  const q = new URLSearchParams();
  q.set("page", s.page);
  q.set("asset", s.asset);
  q.set("variant", String(s.variant));
  q.set("tint", toHexText(s.tint));
  q.set("mode", s.mode);
  q.set("bg", s.bg);
  q.set("anim", s.anim ? "1" : "0");
  q.set("preview", s.preview);
  q.set("show", [s.grid && "grid", s.box && "box", s.anchors && "anchors"].filter(Boolean).join(",") || "none");
  if (s.compare) q.set("compare", "1");
  if (s.park) q.set("park", "1");
  if (s.buddy) q.set("buddy", s.buddy);
  q.set("seed", String(s.seed));
  if (s.sit) {
    q.set("sit", "1");
    q.set("fov", String(s.fov));
    if (!s.lens) q.set("lens", "0");
    q.set("look", `${s.look.yaw.toFixed(2)},${s.look.pitch.toFixed(2)}`);
  }
  if (s.cut) q.set("cut", "1");
  if (s.cam) q.set("cam", [s.cam.yaw, s.cam.pitch, s.cam.dist].map((n) => n.toFixed(2)).join(","));
  return `${window.location.pathname}?${q.toString()}`;
}

let addressTimer = 0;
function saveAddress(): void {
  window.clearTimeout(addressTimer);
  addressTimer = window.setTimeout(() => window.history.replaceState(null, "", addressFor(S)), 250);
}

// ------------------------------------------------------------------ page elements

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const view = $("view");
const frame = $("frame");
const labels = $("labels");
const panel = $("panel");
const sizeInfo = $("sizeinfo");
const previewInfo = $("previewinfo");
const assetSelect = $<HTMLSelectElement>("asset");
const variantsBox = $("variants");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}

function button(text: string, on: boolean, onClick: () => void): HTMLButtonElement {
  const b = el("button", { type: "button" }, text);
  if (on) b.classList.add("on");
  b.addEventListener("click", onClick);
  return b;
}

function toast(text: string): void {
  const t = $("toast");
  t.textContent = text;
  t.style.display = "block";
  window.setTimeout(() => (t.style.display = "none"), 1800);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

// ------------------------------------------------------------------ 3D setup

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
} catch {
  view.textContent = "Sorry, this browser cannot show 3D graphics (WebGL is off or unsupported).";
  throw new Error("WebGL not available");
}
frame.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 2000);
const stage = new THREE.Group(); // the model, the old shape and the size buddy
const helpers = new THREE.Group(); // grid, box, ruler, anchor markers
const backdrop = new THREE.Group();
scene.add(backdrop, stage, helpers);

const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(400, 600), 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false }));
backdrop.add(stars);
let bgPlanet: THREE.Mesh | null = null;

let model: AssetModel | null = null;
let bounds = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
const target = new THREE.Vector3();
let floatingLabels: { text: string; pos: THREE.Vector3; color: string }[] = [];
let lastProblems: Problem[] | null = null;
let lastCheckAll: string[] | null = null;

const ANCHOR_COLORS: Record<string, string> = {
  parking: "#7dff8a",
  eye: "#9fe6ff",
  nose: "#ffd23d",
  engineL: "#ff8a3d",
  engineR: "#ff8a3d",
  engineMain: "#ff8a3d",
  beacon: "#ff5a3c",
  entrance: "#ff7fae",
  dockEntrance: "#ff7fae",
  spinAxis: "#c78bd9",
  bayCamera: "#9fe6ff",
};
const anchorColor = (name: string): string => ANCHOR_COLORS[name] ?? "#ffffff";

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (mat) for (const x of Array.isArray(mat) ? mat : [mat]) x.dispose();
  });
}

/** Wireframe or flat colours, for the model and anything shown next to it. */
function applyMode(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      (m as THREE.MeshBasicMaterial).wireframe = S.mode === "wire";
    }
    const g = mesh.geometry;
    const base = g.getAttribute("baseColor");
    if (!base) return;
    if (!g.userData.shaded) g.userData.shaded = g.getAttribute("color");
    g.setAttribute("color", S.mode === "flat" ? base : (g.userData.shaded as THREE.BufferAttribute));
  });
}

/** The rough shape the game uses today, at the size the docked view shows it. Read only. */
function oldShapeFor(entry: AssetEntry): { group: THREE.Group; label: string } | null {
  if (entry.kind === "cockpit") return null; // the old cockpit is a flat overlay, not a model
  if (entry.kind === "ship" || entry.kind === "reference") {
    const ship = buildCargoHauler();
    for (const f of ship.flames) f.scale.z = 0.15;
    return { group: ship.group, label: "OLD ship (in game now)" };
  }
  if (entry.kind === "outpost") {
    const fake = { colors: { primary: `#${toHexText(S.tint)}`, secondary: "#888888", accent: `#${toHexText(S.tint)}` } } as Planet;
    const g = makeOutpost(fake, 1.3, new THREE.Vector3(1, 0, 0));
    g.quaternion.identity();
    g.position.set(0, 0, 0);
    g.scale.setScalar(3.2);
    const wrap = new THREE.Group();
    wrap.add(g);
    return { group: wrap, label: "OLD outpost (in game now)" };
  }
  const st = makeStation();
  st.scale.setScalar(3.5);
  const wrap = new THREE.Group();
  wrap.add(st);
  return { group: wrap, label: "OLD station (in game now)" };
}

/** Puts an object on the ground (lowest point at y = 0) beside the model, to the right (+x) or left (-x). */
function placeBeside(obj: THREE.Object3D, side: 1 | -1): THREE.Box3 {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const gap = 2;
  const x = side > 0 ? bounds.max.x + gap - b.min.x : bounds.min.x - gap - b.max.x;
  obj.position.x += x;
  obj.position.y -= b.min.y;
  obj.position.z -= (b.min.z + b.max.z) / 2;
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
}

function rebuild(): void {
  disposeTree(stage);
  stage.clear();
  disposeTree(helpers);
  helpers.clear();
  floatingLabels = [];
  lastProblems = null;

  const entry = findEntry(S.asset) ?? ALL[0]!;
  S.variant = clamp(S.variant, 0, entry.variants - 1);
  model = entry.build({ variant: S.variant, tint: S.tint });
  stage.add(model.group);
  bounds = boundsOf(model);
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));

  if (S.park && entry.kind !== "ship" && model.anchors.parking) {
    // A Cargo Hauler parked on the pad or in the bay, the way the game will place it.
    const ship = ASSETS.find((a) => a.id === "cargo-hauler")?.build();
    if (ship) {
      ship.group.position.copy(model.anchors.parking.pos);
      stage.add(ship.group);
    }
  }
  if (S.compare) {
    const old = oldShapeFor(entry);
    if (old) {
      stage.add(old.group);
      const b = placeBeside(old.group, 1);
      floatingLabels.push({ text: old.label, pos: new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.5, 0), color: "#ffd23d" });
    }
  }
  if (S.buddy && S.buddy !== entry.id) {
    const buddyEntry = findEntry(S.buddy);
    if (buddyEntry) {
      const buddy = buddyEntry.build({ tint: S.tint });
      const wrap = new THREE.Group();
      wrap.add(buddy.group);
      stage.add(wrap);
      const b = placeBeside(wrap, -1);
      floatingLabels.push({ text: `size buddy: ${buddyEntry.name}`, pos: new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.5, 0), color: "#9fe6ff" });
    }
  }
  applyMode(stage);

  buildHelpers();
  target.copy(bounds.getCenter(new THREE.Vector3()));
  if (!S.cam) fitCamera();
  setBackground();
  refreshTop();
  refreshPanel();
  saveAddress();
}

function buildHelpers(): void {
  const size = bounds.getSize(new THREE.Vector3());
  if (S.grid) {
    const extent = Math.ceil(Math.max(20, Math.max(size.x, size.z) * 3) / 2) * 2;
    const grid = new THREE.GridHelper(extent, extent, 0x4a5290, 0x262a4a);
    grid.position.y = Math.min(0, bounds.min.y); // under the model (cockpits have their origin at the eye)
    helpers.add(grid);
  }
  if (S.box) {
    helpers.add(new THREE.Box3Helper(bounds, new THREE.Color(0xffd23d)));
    // Ruler along the front-bottom edge: small tick every crate, big tick every 5.
    const pts: number[] = [];
    const y = bounds.min.y;
    const z = bounds.max.z + 0.3;
    pts.push(bounds.min.x, y, z, bounds.max.x, y, z);
    for (let i = 0; i <= Math.floor(size.x + 1e-6); i++) {
      const x = bounds.min.x + i;
      const len = i % 5 === 0 ? 0.6 : 0.25;
      pts.push(x, y, z, x, y + len, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    helpers.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff })));
    for (let i = 0; i <= Math.floor(size.x + 1e-6); i += 5) {
      floatingLabels.push({ text: String(i), pos: new THREE.Vector3(bounds.min.x + i, y + 0.8, z), color: "#ffffff" });
    }
  }
  if (S.anchors && model) {
    const longest = Math.max(size.x, size.y, size.z);
    const r = clamp(longest * 0.025, 0.08, 0.6);
    for (const [name, a] of Object.entries(model.anchors)) {
      const color = new THREE.Color(anchorColor(name));
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(r), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      marker.position.copy(a.pos);
      marker.renderOrder = 10;
      const axes = new THREE.AxesHelper(r * 4);
      axes.position.copy(a.pos);
      const dirGeo = new THREE.BufferGeometry().setFromPoints([a.pos, a.pos.clone().addScaledVector(a.dir, r * 8)]);
      const dirLine = new THREE.Line(dirGeo, new THREE.LineBasicMaterial({ color, depthTest: false }));
      dirLine.renderOrder = 10;
      helpers.add(marker, axes, dirLine);
      floatingLabels.push({ text: name, pos: a.pos.clone(), color: anchorColor(name) });
    }
  }
  if (S.cut && model?.windowOpenings) {
    // The window openings: magenta outlines and a faint fill. Everything inside them shows the outside.
    for (const w of model.windowOpenings) {
      const pts = w.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff3dd6, depthTest: false }));
      line.renderOrder = 20;
      const mid = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(pts.length);
      const fan: number[] = [];
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length]!;
        fan.push(mid.x, mid.y, mid.z, p.x, p.y, p.z, q.x, q.y, q.z);
      });
      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(fan, 3));
      const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xff3dd6, transparent: true, opacity: 0.18, depthTest: false, side: THREE.DoubleSide }));
      fill.renderOrder = 19;
      helpers.add(line, fill);
    }
  }
  sizeInfo.textContent = `Width ${size.x.toFixed(1)} · Height ${size.y.toFixed(1)} · Length ${size.z.toFixed(1)} crates`;
}

function setBackground(): void {
  if (bgPlanet) {
    backdrop.remove(bgPlanet);
    disposeTree(bgPlanet);
    bgPlanet = null;
  }
  stars.visible = S.bg !== "bright";
  const clear = S.bg === "bright" ? 0xc8cfe0 : S.bg === "planet" ? 0x0d1430 : 0x05060d;
  renderer.setClearColor(clear);
  if (S.bg === "planet") {
    const geo = new THREE.IcosahedronGeometry(120, 3);
    const pos = geo.getAttribute("position");
    const cols = new Float32Array(pos.count * 3);
    const base = new THREE.Color(S.tint);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const s = shadeFor(n);
      for (let k = 0; k < 3; k++) cols.set([base.r * s, base.g * s, base.b * s], (i + k) * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    bgPlanet = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    backdrop.add(bgPlanet);
  }
}

// ------------------------------------------------------------------ camera and controls

const cam = { yaw: 2.3, pitch: 0.45, dist: 10 };
if (S.cam) Object.assign(cam, S.cam);

function fitCamera(): void {
  const size = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  // Outposts are seen from the pad side (their doors and windows face the pad); everything else from the front.
  cam.yaw = findEntry(S.asset)?.kind === "outpost" ? -2.4 : 2.3;
  cam.pitch = 0.45;
  cam.dist = longest * 1.7 + 3;
  target.copy(bounds.getCenter(new THREE.Vector3()));
}

function gameCamera(): void {
  const inside = model?.anchors.bayCamera;
  const park = model?.anchors.parking;
  if (inside && park) {
    // Stations: the camera sits inside the bay and looks at the parked ship (Agent 3 decides the final spot).
    target.copy(park.pos).add(new THREE.Vector3(0, 1, 0));
    const v = inside.pos.clone().sub(target);
    cam.dist = v.length();
    cam.pitch = Math.asin(v.y / cam.dist);
    cam.yaw = Math.atan2(v.x, v.z);
    return;
  }
  cam.pitch = (GAME_CAMERA.angleDeg * Math.PI) / 180;
  cam.dist = GAME_CAMERA.distance;
  const p = model?.anchors.parking?.pos;
  target.set(p?.x ?? 0, (p?.y ?? 0) + 0.8, p?.z ?? 0);
}

const sitting = (): boolean => S.sit && findEntry(S.asset)?.kind === "cockpit";

function camChanged(): void {
  S.cam = { ...cam };
  saveAddress();
}

const pointers = new Map<number, { x: number; y: number }>();
let lastPinch = 0;
view.addEventListener("pointerdown", (e) => {
  try {
    view.setPointerCapture(e.pointerId);
  } catch {
    // not important
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    lastPinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
  }
});
view.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 1 && sitting()) {
    // Look around from the seat (the pilot can turn the head, not the ship).
    S.look.yaw = clamp(S.look.yaw - dx * 0.004, -1.6, 1.6); // left/right reversed (Andy)
    S.look.pitch = clamp(S.look.pitch + dy * 0.004, -1.0, 1.0); // up/down as before (Andy)
  } else if (pointers.size === 1) {
    cam.yaw -= dx * 0.008;
    cam.pitch = clamp(cam.pitch + dy * 0.008, -1.45, 1.45);
  } else if (pointers.size === 2 && sitting()) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    if (lastPinch > 0 && d > 0) S.fov = clamp(S.fov * (lastPinch / d), 30, 100);
    lastPinch = d;
    layout();
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    if (lastPinch > 0 && d > 0) cam.dist = clamp(cam.dist * (lastPinch / d), 0.5, 400);
    lastPinch = d;
  }
  camChanged();
});
const release = (e: PointerEvent): void => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) lastPinch = 0;
};
view.addEventListener("pointerup", release);
view.addEventListener("pointercancel", release);
view.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (sitting()) {
      S.fov = clamp(S.fov * Math.exp(e.deltaY * 0.0005), 30, 100);
      layout();
      saveAddress();
      return;
    }
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 0.5, 400);
    camChanged();
  },
  { passive: false },
);

// ------------------------------------------------------------------ layout and the game-resolution preview

/** "Sit inside" fields of view are side to side on a wide screen; the camera wants top to bottom. */
function sideToUpDown(fov: number, aspect: number): number {
  if (aspect < 1) return fov;
  return (2 * Math.atan(Math.tan((fov * Math.PI) / 360) / aspect) * 180) / Math.PI;
}

let frameW = 1;
let frameH = 1;
function layout(): void {
  const vw = Math.max(1, view.clientWidth);
  const vh = Math.max(1, view.clientHeight);
  let aspect: number;
  let rw: number;
  let rh: number;
  if (S.preview === "off") {
    frameW = vw;
    frameH = vh;
    aspect = vw / vh;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    rw = Math.round(vw * pr);
    rh = Math.round(vh * pr);
    camera.fov = sitting() ? sideToUpDown(S.fov, aspect) : GAME_CAMERA.fov;
    previewInfo.style.display = "none";
  } else {
    aspect = S.preview === "desktop" ? 16 / 9 : 9 / 19.5;
    const pad = 16;
    frameW = Math.min(vw - pad, (vh - pad) * aspect);
    frameH = frameW / aspect;
    const size = renderSizeFor(aspect, RENDER_WIDTH, RENDER_HEIGHT);
    rw = size.width;
    rh = size.height;
    camera.fov = sitting() ? sideToUpDown(S.fov, aspect) : cameraFov(aspect, GAME_CAMERA.fov);
    previewInfo.style.display = "block";
    previewInfo.textContent = `What a ${S.preview} player sees: ${rw} x ${rh} pixels, stretched without smoothing`;
  }
  frame.classList.toggle("preview", S.preview !== "off");
  frame.style.width = `${frameW}px`;
  frame.style.height = `${frameH}px`;
  renderer.setPixelRatio(1);
  renderer.setSize(rw, rh, false);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
new ResizeObserver(layout).observe(view);

// ------------------------------------------------------------------ the frame loop

const clock = new THREE.Clock();
let lens: CockpitLens | null = null;
let animTime = 0;
const labelEls: HTMLDivElement[] = [];

function placeLabels(): void {
  while (labelEls.length < floatingLabels.length) {
    const d = el("div", { class: "alabel" });
    labels.appendChild(d);
    labelEls.push(d);
  }
  labelEls.forEach((d, i) => {
    const l = floatingLabels[i];
    if (!l || S.page !== "model") {
      d.style.display = "none";
      return;
    }
    const p = l.pos.clone().project(camera);
    if (p.z > 1 || p.z < -1) {
      d.style.display = "none";
      return;
    }
    d.style.display = "block";
    d.textContent = l.text;
    d.style.color = l.color;
    d.style.left = `${((p.x + 1) / 2) * frameW}px`;
    d.style.top = `${((1 - p.y) / 2) * frameH}px`;
  });
}

function tick(): void {
  const dt = clock.getDelta();
  if (S.page === "model") {
    if (S.anim) animTime += dt;
    model?.update(S.anim ? animTime : 0);
    const eye = model?.anchors.eye?.pos;
    if (sitting() && eye) {
      camera.position.copy(eye);
      // Start from the way the eye anchor looks, then add the pilot's head turn.
      const d = model?.anchors.eye?.dir;
      const baseYaw = d ? Math.atan2(-d.x, -d.z) : 0;
      const basePitch = d ? -Math.asin(Math.max(-1, Math.min(1, d.y))) : 0;
      const yaw = baseYaw + S.look.yaw;
      const pitch = basePitch + S.look.pitch;
      camera.lookAt(eye.x - Math.sin(yaw) * Math.cos(pitch), eye.y - Math.sin(pitch), eye.z - Math.cos(yaw) * Math.cos(pitch));
    } else {
      const p = orbitCameraPosition(cam.yaw, cam.pitch, cam.dist);
      camera.position.set(target.x + p.x, target.y + p.y, target.z + p.z);
      camera.lookAt(target);
    }
    if (bgPlanet) {
      // Keep the planet ahead of the camera, a little below, whichever way you turn.
      // When sitting inside, it sits a little above the horizon so it shows through the window.
      const away = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      bgPlanet.position.copy(camera.position).addScaledVector(away, 420).add(new THREE.Vector3(0, sitting() ? -60 : -170, 0));
    }
    if (sitting() && S.lens) {
      lens ??= new CockpitLens(renderer);
      lens.render(scene, camera, S.fov);
    } else renderer.render(scene, camera);
    placeLabels();
  }
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ checks and the report

function countRows(entry: AssetEntry): { label: string; value: number; max: number }[] {
  if (!model) return [];
  const c = countModel(model);
  const r = RULES[entry.kind];
  return [
    { label: "Triangles", value: c.triangles, max: r.maxTriangles },
    { label: "Meshes", value: c.meshes, max: r.maxMeshes },
    { label: "Materials", value: c.materials, max: r.maxMaterials },
  ];
}

function problemText(list: Problem[]): string {
  if (list.length === 0) return "No problems found.";
  return list.map((p) => `- ${p.level === "error" ? "PROBLEM" : "warning"}: ${p.text}`).join("\n");
}

function checkAll(): string[] {
  const lines: string[] = [];
  for (const entry of ALL) {
    for (const r of checkEntry(entry)) {
      const errors = r.problems.length;
      lines.push(`${entry.id} (variant ${r.variant}): ${errors === 0 ? "OK" : `${errors} problem(s)`}`);
      for (const p of r.problems) lines.push(`    ${p.level === "error" ? "PROBLEM" : "warning"}: ${p.text}`);
    }
  }
  return lines;
}

function reportText(): string {
  const entry = findEntry(S.asset)!;
  const problems = model ? checkModel(model, entry.kind, entry) : [];
  const size = bounds.getSize(new THREE.Vector3());
  return [
    "LAZY FREIGHT MODEL REPORT",
    `Asset: ${entry.id} (${entry.name}), variant ${S.variant}, status ${entry.status}`,
    `Planet tint: ${toHexText(S.tint)}`,
    `View: ${S.mode}, background ${S.bg}, preview ${S.preview}, animation ${S.anim ? "on" : "off"}${sitting() ? `, sitting inside (field of view ${Math.round(S.fov)}, look ${S.look.yaw.toFixed(2)},${S.look.pitch.toFixed(2)})` : ""}`,
    `Counts: ${countRows(entry).map((r) => `${r.label.toLowerCase()} ${r.value}/${r.max} ${r.value <= r.max ? "OK" : "OVER"}`).join(", ")}`,
    `Size: width ${size.x.toFixed(2)}, height ${size.y.toFixed(2)}, length ${size.z.toFixed(2)} crates`,
    `Check: ${problemText(problems)}`,
    `Window: ${window.innerWidth} x ${window.innerHeight}, pixel ratio ${window.devicePixelRatio}`,
    `Browser: ${navigator.userAgent}`,
    `Address: ${window.location.origin}${addressFor(S)}`,
    `Time: ${new Date().toISOString()}`,
  ].join("\n");
}

// ------------------------------------------------------------------ top bar and side panel

function refreshTop(): void {
  for (const [id, page] of [["tabModel", "model"], ["tabGrid", "grid"], ["tabStyle", "style"]] as const) {
    $(id).classList.toggle("on", S.page === page);
  }
  assetSelect.innerHTML = "";
  for (const kind of ["ship", "outpost", "station", "cockpit", "reference"] as const) {
    const list = ALL.filter((e) => e.kind === kind);
    if (list.length === 0) continue;
    const group = el("optgroup", { label: kind === "reference" ? "Test and reference" : `${kind[0]!.toUpperCase()}${kind.slice(1)}s` });
    for (const e of list) {
      const o = el("option", { value: e.id }, `${e.name}${e.status === "DRAFT" && e.kind !== "reference" ? " (draft)" : ""}`);
      if (e.id === S.asset) o.selected = true;
      group.appendChild(o);
    }
    assetSelect.appendChild(group);
  }
  variantsBox.innerHTML = "";
  const entry = findEntry(S.asset);
  if (entry && entry.variants > 1) {
    for (let v = 0; v < entry.variants; v++) {
      variantsBox.appendChild(button(`Look ${v + 1}`, v === S.variant, () => ((S.variant = v), rebuild())));
    }
  }
  assetSelect.style.display = S.page === "model" ? "" : "none";
  variantsBox.style.display = S.page === "model" ? "" : "none";
  $("fold").style.display = S.page === "model" ? "" : "none";
}

function section(title: string): HTMLDivElement {
  panel.appendChild(el("h3", {}, title));
  const row = el("div", { class: "row" });
  panel.appendChild(row);
  return row;
}

function set<K extends keyof ViewState>(key: K, value: ViewState[K], full = true): void {
  S[key] = value;
  if (full) rebuild();
  else {
    layout();
    setBackground();
    refreshPanel();
    saveAddress();
  }
}

function refreshPanel(): void {
  panel.innerHTML = "";
  if (S.page !== "model") {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "";
  const entry = findEntry(S.asset)!;
  panel.appendChild(el("div", { class: "note" }, `${entry.name}: ${entry.description}`));

  let row: HTMLDivElement;
  if (entry.kind === "cockpit") {
    row = section("Sit inside (pilot's eye)");
    row.appendChild(button(S.sit ? "Sitting inside" : "Sit inside", S.sit, () => {
      S.look = { yaw: 0, pitch: 0 };
      set("sit", !S.sit, false);
    }));
    row.appendChild(button("Window cut-out", S.cut, () => set("cut", !S.cut)));
    row.appendChild(button("Look ahead", false, () => ((S.look = { yaw: 0, pitch: 0 }), saveAddress())));
    row = section(`Field of view: ${Math.round(S.fov)} degrees side to side`);
    for (const f of [50, 60, 70, 80, 90]) row.appendChild(button(String(f), Math.round(S.fov) === f, () => set("fov", f, false)));
    row.appendChild(button(S.lens ? "Lens: on" : "Lens: off", S.lens, () => set("lens", !S.lens, false)));
    if (S.sit) panel.appendChild(el("p", { class: "note" }, "Drag to look around, scroll or pinch to change the field of view."));
  }
  row = section("Look");
  row.appendChild(button("Normal", S.mode === "normal", () => set("mode", "normal")));
  row.appendChild(button("Wireframe", S.mode === "wire", () => set("mode", "wire")));
  row.appendChild(button("Flat colours", S.mode === "flat", () => set("mode", "flat")));
  row = section("Background");
  row.appendChild(button("Space", S.bg === "space", () => set("bg", "space", false)));
  row.appendChild(button("Planet-lit", S.bg === "planet", () => set("bg", "planet", false)));
  row.appendChild(button("Bright", S.bg === "bright", () => set("bg", "bright", false)));
  row.appendChild(button(S.anim ? "Animation: on" : "Animation: off", S.anim, () => set("anim", !S.anim, false)));

  row = section("Game resolution preview");
  row.appendChild(button("Off", S.preview === "off", () => set("preview", "off", false)));
  row.appendChild(button("Desktop", S.preview === "desktop", () => set("preview", "desktop", false)));
  row.appendChild(button("Phone", S.preview === "phone", () => set("preview", "phone", false)));
  row = section("Camera");
  row.appendChild(button("Fit model", false, () => (fitCamera(), camChanged())));
  row.appendChild(button("Game camera", false, () => (gameCamera(), camChanged())));

  row = section("Planet colour (tint)");
  const tints = el("div", { class: "tints" });
  for (const t of TINT_EXAMPLES) {
    const b = button("", t.hex === S.tint, () => set("tint", t.hex));
    b.className = `tint${t.hex === S.tint ? " on" : ""}`;
    b.style.background = `#${toHexText(t.hex)}`;
    b.title = t.name;
    tints.appendChild(b);
  }
  const picker = el("input", { type: "color", value: `#${toHexText(S.tint)}`, title: "Any colour" });
  picker.addEventListener("change", () => set("tint", parseHexColor(picker.value) ?? S.tint));
  tints.appendChild(picker);
  row.appendChild(tints);

  row = section("Measure");
  row.appendChild(button("Grid floor", S.grid, () => set("grid", !S.grid)));
  row.appendChild(button("Box + ruler", S.box, () => set("box", !S.box)));
  row.appendChild(button("Anchors", S.anchors, () => set("anchors", !S.anchors)));
  row.appendChild(button("Compare with old", S.compare, () => set("compare", !S.compare)));
  if (entry.kind !== "ship") row.appendChild(button("Park a ship", S.park, () => set("park", !S.park)));
  const buddy = el("select", { "aria-label": "Size buddy" });
  buddy.appendChild(el("option", { value: "" }, "Size buddy: none"));
  for (const e of ALL) if (e.id !== entry.id && e.id !== "broken-demo") {
    const o = el("option", { value: e.id }, `Size buddy: ${e.name}`);
    if (e.id === S.buddy) o.selected = true;
    buddy.appendChild(o);
  }
  buddy.addEventListener("change", () => set("buddy", buddy.value));
  row.appendChild(buddy);

  panel.appendChild(el("h3", {}, "Counts (green = within budget)"));
  for (const r of countRows(entry)) {
    const d = el("div", { class: `count ${r.value <= r.max ? "pass" : "fail"}` });
    d.appendChild(el("span", {}, r.label));
    d.appendChild(el("span", {}, `${r.value} / ${r.max} ${r.value <= r.max ? "PASS" : "FAIL"}`));
    panel.appendChild(d);
  }

  row = section("Problem checker");
  row.appendChild(
    button("Check this asset", false, () => {
      lastProblems = model ? checkModel(model, entry.kind, entry) : [];
      lastCheckAll = null;
      refreshPanel();
    }),
  );
  row.appendChild(
    button("Check all assets", false, () => {
      lastCheckAll = checkAll();
      lastProblems = null;
      refreshPanel();
    }),
  );
  if (lastProblems) {
    const ul = el("ul", { class: "problems" });
    if (lastProblems.length === 0) ul.appendChild(el("li", { class: "ok" }, "No problems found."));
    for (const p of lastProblems) ul.appendChild(el("li", { class: p.level }, `${p.level === "error" ? "Problem" : "Warning"}: ${p.text}`));
    panel.appendChild(ul);
  }
  if (lastCheckAll) {
    const ul = el("ul", { class: "problems" });
    for (const line of lastCheckAll) {
      const cls = line.includes(": OK") ? "ok" : line.trim().startsWith("warning") ? "warning" : "error";
      ul.appendChild(el("li", { class: cls }, line.trim()));
    }
    panel.appendChild(ul);
  }

  row = section("Share");
  row.appendChild(button("Copy problem report", false, () => void copyText(reportText()).then((ok) => toast(ok ? "Report copied. Paste it to the Lead." : "Could not copy."))));
  row.appendChild(button("Copy link to this view", false, () => void copyText(`${window.location.origin}${addressFor(S)}`).then((ok) => toast(ok ? "Link copied." : "Could not copy."))));

  if (model) {
    panel.appendChild(el("h3", {}, "Anchors"));
    const t = el("table");
    for (const [name, a] of Object.entries(model.anchors)) {
      const tr = el("tr");
      const td = el("td", {}, name);
      td.style.color = anchorColor(name);
      tr.appendChild(td);
      tr.appendChild(el("td", {}, `${a.pos.x.toFixed(1)}, ${a.pos.y.toFixed(1)}, ${a.pos.z.toFixed(1)}`));
      t.appendChild(tr);
    }
    panel.appendChild(t);
  }
}

// ------------------------------------------------------------------ "All variants" page

let thumbRenderer: THREE.WebGLRenderer | null = null;
function thumbnail(entry: AssetEntry, variant: number, tint: number, w = 160, h = 120): HTMLCanvasElement {
  if (!thumbRenderer) thumbRenderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.setSize(w, h, false);
  thumbRenderer.setClearColor(0x05060d);
  const sc = new THREE.Scene();
  const m = entry.build({ variant, tint });
  m.update(0);
  sc.add(m.group);
  const b = boundsOf(m);
  const size = b.getSize(new THREE.Vector3());
  const c = new THREE.PerspectiveCamera(GAME_CAMERA.fov, w / h, 0.05, 1000);
  const p = orbitCameraPosition(entry.kind === "outpost" ? -2.4 : 2.3, 0.5, Math.max(size.x, size.y, size.z) * 1.5 + 1.5);
  const mid = b.getCenter(new THREE.Vector3());
  c.position.set(mid.x + p.x, mid.y + p.y, mid.z + p.z);
  c.lookAt(mid);
  thumbRenderer.render(sc, c);
  const out = el("canvas", { width: String(w), height: String(h) });
  out.getContext("2d")?.drawImage(thumbRenderer.domElement, 0, 0);
  disposeTree(m.group);
  return out;
}

function renderGridPage(): void {
  const page = $("pageGrid");
  page.innerHTML = "";
  page.appendChild(el("h2", {}, "Every asset and look"));
  page.appendChild(el("p", { class: "note" }, "Small pictures at game resolution. Green = the checker found nothing. Tap one to open it."));
  const tints = el("div", { class: "tints" });
  for (const t of TINT_EXAMPLES) {
    const b = button("", t.hex === S.tint, () => ((S.tint = t.hex), saveAddress(), renderGridPage()));
    b.className = `tint${t.hex === S.tint ? " on" : ""}`;
    b.style.background = `#${toHexText(t.hex)}`;
    b.title = t.name;
    tints.appendChild(b);
  }
  page.appendChild(tints);
  const grid = el("div", { class: "grid" });
  if (ASSETS.length === 0) page.appendChild(el("p", { class: "note" }, "No game designs yet. Ships come next (stage S1). Shown below: the test and reference models."));
  for (const entry of ALL) {
    for (let v = 0; v < entry.variants; v++) {
      const cell = el("div", { class: "cell" });
      cell.appendChild(thumbnail(entry, v, S.tint));
      const errors = checkModel(entry.build({ variant: v, tint: S.tint }), entry.kind, entry).length;
      const line = el("div");
      line.appendChild(el("span", { class: `badge ${errors === 0 ? "ok" : "bad"}` }, errors === 0 ? "OK" : `${errors} problem(s)`));
      line.appendChild(el("span", {}, ` ${entry.name}${entry.variants > 1 ? `, look ${v + 1}` : ""}`));
      cell.appendChild(line);
      cell.appendChild(el("small", {}, entry.id));
      cell.addEventListener("click", () => {
        S.asset = entry.id;
        S.variant = v;
        S.cam = null;
        showPage("model");
      });
      grid.appendChild(cell);
    }
  }
  page.appendChild(grid);

  // What the player will meet: a sample of real docks from the universe and the look each one gets.
  page.appendChild(el("h2", {}, "What players will meet (sample of docks)"));
  page.appendChild(
    el("p", { class: "note" }, "Real docks near the start of the universe with this seed. Each gets its look from its dock id, the same every time."),
  );
  const seedRow = el("div", { class: "row" });
  const seedInput = el("input", { type: "number", value: String(S.seed), "aria-label": "Seed" });
  seedInput.style.width = "120px";
  seedRow.appendChild(el("span", {}, "Seed "));
  seedRow.appendChild(seedInput);
  seedRow.appendChild(button("Show", false, () => ((S.seed = Number(seedInput.value) || 12345), saveAddress(), renderGridPage())));
  page.appendChild(seedRow);

  const docks: { id: string; planet: Planet; kind: string }[] = [];
  for (const system of listSystemsNear(S.seed, { x: 0, y: 0, z: 0 }, 25)) {
    for (const dock of docksOf(S.seed, system)) {
      const planet = getPlanet(S.seed, dock.id);
      if (planet) docks.push({ id: dock.id, planet, kind: dock.kind });
      if (docks.length >= 16) break;
    }
    if (docks.length >= 16) break;
  }
  const table = el("table");
  const head = el("tr");
  for (const h of ["Dock id", "Kind", "Planet", "Planet colour", "Safe tint", "Look picked"]) head.appendChild(el("th", {}, h));
  table.appendChild(head);
  const used = new Set<string>();
  for (const d of docks) {
    const tr = el("tr");
    tr.appendChild(el("td", {}, d.id));
    tr.appendChild(el("td", {}, d.kind === "OUTPOST" ? "Outpost" : "Station"));
    tr.appendChild(el("td", {}, d.planet.type));
    const raw = parseHexColor(d.planet.colors.primary) ?? 0x888888;
    for (const hex of [raw, safeTint(raw)]) {
      const td = el("td");
      const chip = el("span", { class: "badge" }, `#${toHexText(hex)}`);
      chip.style.background = `#${toHexText(hex)}`;
      chip.style.color = "#111";
      td.appendChild(chip);
      tr.appendChild(td);
    }
    const picked = d.kind === "OUTPOST" ? pickOutpostVariant(d.id, d.planet.type) : pickStationVariant(d.id);
    if (picked) used.add(picked);
    tr.appendChild(el("td", {}, picked ?? (d.kind === "OUTPOST" ? "(outposts come in S2)" : "(stations come in S3)")));
    table.appendChild(tr);
  }
  page.appendChild(table);
  const never = [...OUTPOST_IDS, ...STATION_IDS].filter((id) => !used.has(id));
  if (OUTPOST_IDS.length + STATION_IDS.length > 0) {
    page.appendChild(el("p", { class: "note" }, never.length === 0 ? "Every look appears in this sample." : `Not picked in this sample: ${never.join(", ")}.`));
  }
}

// ------------------------------------------------------------------ "Style guide" page (stage S0)

function shadeHex(hex: number, s: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(s).getHexString()}`;
}

function renderStylePage(): void {
  const page = $("pageStyle");
  page.innerHTML = "";
  page.appendChild(el("h2", {}, "Style guide (stage S0)"));
  page.appendChild(
    el(
      "p",
      { class: "note" },
      "Cozy, toy-like, PS1-era low poly. Bold shapes and big colour blocks that still read at 320 x 180 pixels. Every model is built from simple shapes in code, with flat colours in four brightness steps. Each one gets one small funny touch.",
    ),
  );

  page.appendChild(el("h2", {}, "1. Palette"));
  page.appendChild(el("p", { class: "note" }, "Each chip shows the colour in the four brightness steps it gets on lit, half-lit, side and shadow faces. Glow colours are never shaded."));
  const grid = el("div", { class: "swatches" });
  const steps = [1, 0.72, 0.5, 0.32].map((f) => 0.4 + 0.6 * f);
  for (const s of SWATCHES) {
    const box = el("div", { class: "sw" });
    const chip = el("div", { class: "chip" });
    chip.style.background = s.glow
      ? `#${toHexText(s.hex)}`
      : `linear-gradient(90deg, ${steps.map((k, i) => `${shadeHex(s.hex, k)} ${i * 25}% ${(i + 1) * 25}%`).join(", ")})`;
    box.appendChild(chip);
    const text = el("div");
    text.appendChild(el("b", {}, s.name));
    text.appendChild(el("small", {}, s.use));
    box.appendChild(text);
    grid.appendChild(box);
  }
  page.appendChild(grid);

  page.appendChild(el("h2", {}, "2. Planet colours on outposts"));
  page.appendChild(
    el("p", { class: "note" }, "Outposts take the planet's colour for roofs, ground plates and stripes (never for windows or lights). Left: planet colour. Middle: made safe (never too dark or neon). Right: darker partner for trims."),
  );
  const tt = el("table");
  for (const t of TINT_EXAMPLES) {
    const tr = el("tr");
    tr.appendChild(el("td", {}, t.name));
    for (const hex of [t.hex, safeTint(t.hex), safeTintDark(t.hex)]) {
      const td = el("td");
      td.style.background = `#${toHexText(hex)}`;
      td.style.width = "70px";
      tr.appendChild(td);
    }
    tt.appendChild(tr);
  }
  page.appendChild(tt);

  page.appendChild(el("h2", {}, "3. Sizes (1 unit = 1 cargo crate, about 2 metres)"));
  const st = el("table");
  const sizes: [string, string][] = [
    ["Pilot", "about 0.9 crates tall"],
    ["Scout", "3 to 4 long"],
    ["Cargo Hauler", "5 to 6 long"],
    ["Passenger Liner", "6.5 to 7.5 long"],
    ["Any ship", `2.5 to 8 long; parts at least ${MIN_PART_THICKNESS} thick`],
    ["Landing pad", `${PAD_DIAMETER} wide (fits every ship)`],
    ["Outpost", "8 to 28 across, pad included"],
    ["Station bay", `${BAY_SIZE.width} wide, ${BAY_SIZE.height} tall, ${BAY_SIZE.depth} deep`],
    ["Station", "16 to 48 across"],
  ];
  for (const [a, b] of sizes) {
    const tr = el("tr");
    tr.appendChild(el("td", {}, a));
    tr.appendChild(el("td", {}, b));
    st.appendChild(tr);
  }
  page.appendChild(st);
  page.appendChild(
    button("Open the size yard in 3D", false, () => {
      S.asset = "scale-test";
      S.cam = null;
      showPage("model");
    }),
  );

  page.appendChild(el("h2", {}, "4. Budgets (green and red in the viewer)"));
  const bt = el("table");
  const hr = el("tr");
  for (const h of ["Kind", "Triangles", "Meshes", "Materials"]) hr.appendChild(el("th", {}, h));
  bt.appendChild(hr);
  for (const kind of ["ship", "outpost", "station"] as const) {
    const r = RULES[kind];
    const tr = el("tr");
    for (const v of [kind, String(r.maxTriangles), String(r.maxMeshes), String(r.maxMaterials)]) tr.appendChild(el("td", {}, v));
    bt.appendChild(tr);
  }
  page.appendChild(bt);

  page.appendChild(el("h2", {}, "5. Shape and motion rules"));
  const ul = el("ul", { class: "note" });
  for (const line of [
    "One big main shape you can recognise as a black outline. Each ship class must look different from the top and from the side.",
    "No detail smaller than a fifth of a crate: it disappears at game resolution.",
    "At most 2 or 3 accent colours per model, used in big blocks.",
    "Ships: no funny touches (Andy, revision 1). Outposts and stations may have one small funny touch.",
    "Ships: white and grey paint, a few company colour marks, dark multi-pane cockpit glass, angled tops and a dark industrial underside.",
    "Nothing that looks like a weapon. Ever.",
    `Lights blink every ${BLINK_PERIOD} seconds (on for ${BLINK_ON}); two groups take turns.`,
    `Station rings turn slowly: about one turn per ${Math.round((Math.PI * 2) / RING_SPIN_SPEED)} seconds.`,
    "Engine flames are short when parked, longer in flight, longest in warp.",
  ]) {
    ul.appendChild(el("li", {}, line));
  }
  page.appendChild(ul);
  const sample = el("div", { class: "steps" });
  ["hullLight", "orange", "teal"].forEach((key) => {
    const hex = PAL[key as keyof typeof PAL];
    steps.forEach((k, i) => {
      const d = el("div", {}, i === 0 ? key : "");
      d.style.background = shadeHex(hex, k);
      sample.appendChild(d);
    });
  });
  page.appendChild(el("p", { class: "note" }, "The four brightness steps, big:"));
  page.appendChild(sample);
}

// ------------------------------------------------------------------ pages

function showPage(page: Page): void {
  S.page = page;
  $("pageModel").style.display = page === "model" ? "flex" : "none";
  $("pageGrid").style.display = page === "grid" ? "block" : "none";
  $("pageStyle").style.display = page === "style" ? "block" : "none";
  if (page === "grid") renderGridPage();
  if (page === "style") renderStylePage();
  if (page === "model") {
    rebuild();
    layout();
  } else {
    refreshTop();
    refreshPanel();
    saveAddress();
  }
}

$("tabModel").addEventListener("click", () => showPage("model"));
$("tabGrid").addEventListener("click", () => showPage("grid"));
$("tabStyle").addEventListener("click", () => showPage("style"));
$("fold").addEventListener("click", () => panel.classList.toggle("folded"));
assetSelect.addEventListener("change", () => {
  S.asset = assetSelect.value;
  S.variant = 0;
  S.cam = null;
  if (findEntry(S.asset)?.kind === "cockpit") {
    S.sit = true;
    S.look = { yaw: 0, pitch: 0 };
  }
  rebuild();
  layout();
});

if (window.innerWidth <= 760) panel.classList.add("folded");
rebuild();
if (S.cam) Object.assign(cam, S.cam);
showPage(S.page);
requestAnimationFrame(tick);
