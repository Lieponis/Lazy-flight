// THE THREE COCKPIT INTERIORS (stage C1). A view only: no steering, no free flight, no combat.
// Origin = the pilot's eye, looking to -Z, up +Y, 1 unit = 1 crate. Agent 3 places the cockpit at the ship's `eye` anchor.
// Design source: docs/cockpit-design-brief.md (approved by Andy).
//
// Same bones for all three: the window wall at z -2.3, the dashboard desk and the screen bank in front, the pilot seat
// behind the eye, a second seat on the right wall. Different frame, window and dashboard styling:
//   cockpit-cargo-hauler     wide and practical: three flat panes split by two struts, dark metal, orange and hazard stripes
//   cockpit-passenger-liner  elegant: one wide panoramic strip, white and cream, blue trim, a little plant
//   cockpit-scout            cramped: a rounded canopy, heavy side bulkheads, low ceiling, red trim, no dog
// The dog (co-pilot, asleep) sits on the second seat in the Hauler and the Liner only.

import * as THREE from "three";
import { ModelKit, type ColorName } from "./kit";
import type { AssetModel, BuildOptions } from "./types";

// ------------------------------------------------------------------ the shared bones

const WALL_X = 1.9; // side walls (inside face)
const FLOOR_Y = -1.4;
const WIN_Z = -2.3; // inside face of the window wall; the window opening is on this plane
const WIN_T = 0.15; // window wall thickness
const BACK_Z = 1.0;
const DESK = { x: 1.1, zNear: -1.2, zFar: -1.9, yNear: -0.62, yFar: -0.42 };
const BANK = { yBottom: -0.45, zBottom: -1.88, yTop: -0.08, zTop: -2.15 };
const DESK_TILT = Math.atan((DESK.yFar - DESK.yNear) / (DESK.zNear - DESK.zFar));
const SEAT2 = { x: 1.5, z: -1.85 }; // the second seat (dog seat), on the right wall, far enough forward to be seen

/** Height of the desk top at depth z. */
const deskY = (z: number): number => DESK.yNear + ((DESK.zNear - z) / (DESK.zNear - DESK.zFar)) * (DESK.yFar - DESK.yNear);

interface CockpitStyle {
  ceiling: number;
  window: [number, number][]; // the opening, counter-clockwise, on the plane z = WIN_Z
  frame: ColorName;
  walls: ColorName;
  desk: ColorName;
  bank: ColorName;
  trim: ColorName;
  switches: ColorName[];
  dog: boolean;
}

function room(k: ModelKit, s: CockpitStyle): void {
  const len = BACK_Z - (WIN_Z - WIN_T);
  const zc = (BACK_Z + WIN_Z - WIN_T) / 2;
  const h = s.ceiling - FLOOR_Y;
  k.box("floor", WALL_X * 2 + 0.3, 0.15, len, "underside", { at: [0, FLOOR_Y - 0.075, zc] });
  k.box("ceiling", WALL_X * 2 + 0.3, 0.15, len, s.walls, { at: [0, s.ceiling + 0.075, zc] });
  for (const side of [1, -1]) k.box(`wall ${side > 0 ? "right" : "left"}`, 0.15, h, len, s.walls, { at: [side * (WALL_X + 0.075), (s.ceiling + FLOOR_Y) / 2, zc] });
  k.box("back wall", WALL_X * 2, h, 0.15, s.walls, { at: [0, (s.ceiling + FLOOR_Y) / 2, BACK_Z + 0.075] });
  k.windowWall("window frame", s.window, [-WALL_X, FLOOR_Y, WALL_X, s.ceiling], WIN_Z - WIN_T, WIN_Z, s.frame);
}

function dashboard(k: ModelKit, s: CockpitStyle): void {
  const { x, zNear, zFar, yNear, yFar } = DESK;
  k.hull8("desk", [
    [-x, FLOOR_Y, zFar], [x, FLOOR_Y, zFar], [x, FLOOR_Y, zNear], [-x, FLOOR_Y, zNear],
    [-x, yFar, zFar], [x, yFar, zFar], [x, yNear, zNear], [-x, yNear, zNear],
  ], s.desk);
  k.box("desk edge trim", x * 2, 0.08, 0.08, s.trim, { at: [0, yNear - 0.02, zNear + 0.02] });
  k.hull8("screen bank", [
    [-x, BANK.yBottom, WIN_Z], [x, BANK.yBottom, WIN_Z], [x, BANK.yBottom, BANK.zBottom], [-x, BANK.yBottom, BANK.zBottom],
    [-x, BANK.yTop, WIN_Z], [x, BANK.yTop, WIN_Z], [x, BANK.yTop, BANK.zTop], [-x, BANK.yTop, BANK.zTop],
  ], s.bank);

  // Three flat, unshaded screens on the bank's sloped face, with anchors for Agent 5's text.
  const dy = BANK.yTop - BANK.yBottom;
  const dz = BANK.zBottom - BANK.zTop;
  const n = new THREE.Vector3(0, dz, dy).normalize(); // the way the face looks (up and towards the pilot)
  const tilt = -Math.asin(n.y);
  const mid = { y: (BANK.yBottom + BANK.yTop) / 2, z: (BANK.zBottom + BANK.zTop) / 2 };
  const screens: [string, string, number, number, ColorName][] = [
    ["screen info", "screenInfo", -0.62, 0.7, "screenTeal"],
    ["screen map", "screenMap", 0.15, 0.75, "screenTeal"],
    ["screen fuel", "screenFuel", 0.82, 0.4, "screenAmber"],
  ];
  const sh = 0.3;
  for (const [part, anchor, sx, sw, color] of screens) {
    const at: [number, number, number] = [sx, mid.y + n.y * 0.012, mid.z + n.z * 0.012];
    k.box(part, sw, sh, 0.03, color, { at, rot: [tilt, 0, 0], layer: "glow" });
    k.screenAnchor(anchor, [sx, mid.y + n.y * 0.03, mid.z + n.z * 0.03], [0, n.y, n.z], sw, sh);
  }

  // A busy desk: switches, dials, blinking lights and little coloured "labels" (funny ones, no text needed).
  const rows = [-1.32, -1.52, -1.72];
  let i = 0;
  rows.forEach((z, r) => {
    for (let c = -4; c <= 4; c++) {
      const xx = c * 0.21;
      const y = deskY(z);
      const kind = (r * 7 + c * 3 + 11) % 5;
      const rot: [number, number, number] = [DESK_TILT, 0, 0];
      const name = `switch ${++i}`;
      if (kind === 0) k.box(name, 0.07, 0.06, 0.1, s.switches[i % s.switches.length]!, { at: [xx, y + 0.03, z], rot });
      else if (kind === 1) k.cyl(`dial ${i}`, 0.07, 0.07, 0.04, 6, "metalDark", { at: [xx, y + 0.02, z], rot });
      else if (kind === 2) k.box(`light ${i}`, 0.06, 0.04, 0.06, (["lightGreen", "lightRed", "engine"] as const)[i % 3], { at: [xx, y + 0.02, z], rot, layer: i % 2 ? "blinkA" : "blinkB" });
      else if (kind === 3) k.box(`label ${i}`, 0.15, 0.015, 0.06, (["pink", "teal", "yellow", "orange"] as const)[i % 4], { at: [xx, y + 0.008, z], rot });
      else k.box(`button ${i}`, 0.09, 0.03, 0.09, s.switches[(i + 1) % s.switches.length]!, { at: [xx, y + 0.015, z], rot });
    }
  });
  // Small knobs along the bank, between and under the screens.
  for (const bx of [-1.02, -0.19, 0.57, 1.06]) {
    k.box(`bank knob ${bx}`, 0.06, 0.06, 0.05, "lightGreen", { at: [bx, mid.y, mid.z + 0.02], rot: [tilt, 0, 0], layer: bx > 0 ? "blinkA" : "blinkB" });
  }

  // Left side console with a few buttons.
  const cw = WALL_X - x;
  k.box("left console", cw, 0.85, 1.1, s.desk, { at: [-x - cw / 2, FLOOR_Y + 0.425, -1.75] });
  for (let j = 0; j < 4; j++) {
    k.box(`left console button ${j + 1}`, 0.1, 0.03, 0.1, s.switches[j % s.switches.length]!, { at: [-1.3 - (j % 2) * 0.25, FLOOR_Y + 0.865, -1.5 - Math.floor(j / 2) * 0.3] });
  }

  // The little warm lamp at the right end of the desk, leaning towards the second seat.
  const lz = -1.8;
  k.cyl("lamp base", 0.08, 0.1, 0.04, 6, "metalDark", { at: [0.98, deskY(lz) + 0.02, lz] });
  k.box("lamp arm", 0.04, 0.32, 0.04, "metalDark", { at: [1.02, deskY(lz) + 0.17, lz], rot: [0, 0, -0.3] });
  k.cone("lamp shade", 0.09, 0.12, 6, "metalDark", { at: [1.1, deskY(lz) + 0.34, lz], rot: [0, 0, -2.2] });
  k.cone("lamp glow", 0.07, 0.04, 6, "lampWarm", { at: [1.16, deskY(lz) + 0.3, lz], rot: [0, 0, -2.2], layer: "glow" });

  // Surfaces lit by the window (their own mesh: Agent 3 can tint it by planet colour).
  k.box("window light sill", x * 2, 0.02, 0.14, "windowLight", { at: [0, BANK.yTop + 0.01, (WIN_Z + BANK.zTop) / 2], layer: "light" });
  k.box("window light left console", cw - 0.1, 0.02, 0.9, "windowLight", { at: [-x - cw / 2, FLOOR_Y + 0.86, -1.75], layer: "light" });
  k.anchor("windowLight", [0, 0.5, WIN_Z], [0, 0, 1]);
}

function seats(k: ModelKit): void {
  // Pilot seat, behind the eye.
  k.box("pilot seat base", 0.6, 0.45, 0.6, "metalDark", { at: [0, FLOOR_Y + 0.225, 0.4] });
  k.box("pilot seat cushion", 0.8, 0.15, 0.8, "seat", { at: [0, FLOOR_Y + 0.525, 0.4] });
  k.box("pilot seat back", 0.8, 1.1, 0.15, "seat", { at: [0, -0.3, 0.86] });
  // Second seat, on the right wall.
  k.box("second seat base", 0.5, 0.52, 0.6, "metalDark", { at: [SEAT2.x, FLOOR_Y + 0.26, SEAT2.z] });
  k.box("second seat cushion", 0.6, 0.15, 0.75, "seat", { at: [SEAT2.x, FLOOR_Y + 0.6, SEAT2.z] });
  k.box("second seat back", 0.12, 0.65, 0.75, "seat", { at: [WALL_X - 0.06, -0.45, SEAT2.z] });
}

/** The co-pilot: an original low-poly dog, curled up asleep on the second seat, head on its paws at the near end (towards the pilot). */
function dog(k: ModelKit): void {
  const top = FLOOR_Y + 0.675; // top of the cushion
  const bx = SEAT2.x + 0.05;
  const bz = SEAT2.z - 0.05;
  k.add("dog body", new THREE.IcosahedronGeometry(0.25, 1).scale(1.0, 0.56, 1.35), "dogTan", { at: [bx, top + 0.13, bz] });
  k.add("dog back patch", new THREE.IcosahedronGeometry(0.11, 0).scale(1.1, 0.6, 1.3), "dogDark", { at: [bx + 0.04, top + 0.24, bz - 0.12] });
  const hx = bx - 0.18;
  const hz = bz + 0.3;
  const hy = top + 0.12;
  k.add("dog head", new THREE.IcosahedronGeometry(0.13, 1).scale(1.0, 0.9, 1.0), "dogTan", { at: [hx, hy, hz] });
  k.box("dog snout", 0.13, 0.08, 0.1, "dogTan", { at: [hx - 0.13, hy - 0.03, hz] });
  k.box("dog nose", 0.04, 0.04, 0.05, "dogNose", { at: [hx - 0.2, hy - 0.01, hz] });
  for (const s of [1, -1]) {
    k.box(`dog ear ${s}`, 0.06, 0.14, 0.04, "dogDark", { at: [hx + 0.02, hy - 0.02, hz + s * 0.13], rot: [s * 0.25, 0, 0] });
    k.box(`dog closed eye ${s}`, 0.02, 0.015, 0.05, "dogNose", { at: [hx - 0.115, hy + 0.04, hz + s * 0.05] });
    k.box(`dog paw ${s}`, 0.16, 0.06, 0.07, "dogTan", { at: [hx - 0.08, top + 0.03, hz + s * 0.07 + 0.02] });
  }
  k.box("dog collar", 0.05, 0.1, 0.18, "teal", { at: [hx + 0.11, hy - 0.02, hz - 0.06] });
  k.box("dog tail", 0.08, 0.07, 0.28, "dogTan", { at: [bx + 0.15, top + 0.05, bz - 0.25], rot: [0, 0.7, 0] });
  k.box("dog tail tip", 0.07, 0.06, 0.1, "hullWhite", { at: [bx + 0.02, top + 0.05, bz - 0.38], rot: [0, 1.2, 0] });
  k.anchor("dog", [bx, top + 0.13, bz], [-1, 0, 0]);
}

function buildCockpit(s: CockpitStyle, extras: (k: ModelKit) => void): AssetModel {
  const k = new ModelKit();
  room(k, s);
  dashboard(k, s);
  seats(k);
  if (s.dog) dog(k);
  extras(k);
  k.anchor("eye", [0, 0, 0], [0, 0, -1]);
  return k.finish();
}

// ------------------------------------------------------------------ Cargo Hauler: wide and practical

const HAULER_WINDOW: [number, number][] = [
  [-1.25, -0.05], [1.25, -0.05], [1.45, 0.15], [1.45, 1.05], [1.25, 1.25], [-1.25, 1.25], [-1.45, 1.05], [-1.45, 0.15],
];

export function buildCockpitHauler(_o: BuildOptions = {}): AssetModel {
  return buildCockpit(
    { ceiling: 1.45, window: HAULER_WINDOW, frame: "metalDark", walls: "hullMid", desk: "hullDark", bank: "metalDark", trim: "orange", switches: ["red", "yellow", "orange", "hullLight"], dog: true },
    (k) => {
      // Two struts split the window into three flat panes.
      for (const x of [-0.5, 0.5]) k.box(`strut ${x}`, 0.12, 1.3, 0.12, "metalDark", { at: [x, 0.6, WIN_Z - 0.06] });
      // Hazard stripes along the top of the frame, and a warning light.
      for (let j = 0; j < 9; j++) k.box(`hazard stripe ${j}`, 0.2, 0.1, 0.03, j % 2 ? "yellow" : "frame", { at: [-0.9 + j * 0.225, 1.36, WIN_Z + 0.015] });
      k.box("warning light", 0.12, 0.08, 0.06, "lightRed", { at: [1.15, 1.36, WIN_Z + 0.03], layer: "blinkA" });
      // A big coffee mug on the left console.
      k.cyl("mug", 0.08, 0.07, 0.16, 6, "orange", { at: [-1.6, FLOOR_Y + 0.93, -1.95] });
      k.box("mug handle", 0.03, 0.08, 0.06, "orange", { at: [-1.5, FLOOR_Y + 0.93, -1.95] });
    },
  );
}

// ------------------------------------------------------------------ Passenger Liner: elegant, panoramic

const LINER_WINDOW: [number, number][] = [
  [-1.6, -0.05], [1.6, -0.05], [1.75, 0.08], [1.8, 0.47], [1.75, 0.87], [1.6, 1.0], [-1.6, 1.0], [-1.75, 0.87], [-1.8, 0.47], [-1.75, 0.08],
];

export function buildCockpitLiner(_o: BuildOptions = {}): AssetModel {
  return buildCockpit(
    { ceiling: 1.5, window: LINER_WINDOW, frame: "paintWhite", walls: "hullLight", desk: "paintWhite", bank: "hullMid", trim: "blue", switches: ["blue", "hullLight", "yellow"], dog: true },
    (k) => {
      // A slim blue trim line along the frame under the window, and a little potted plant.
      k.box("frame trim", 3.4, 0.05, 0.03, "blue", { at: [0, -0.07, WIN_Z + 0.015] });
      k.cyl("plant pot", 0.08, 0.06, 0.12, 6, "hullWhite", { at: [-1.6, FLOOR_Y + 0.91, -1.95] });
      k.cone("plant", 0.12, 0.22, 5, "teal", { at: [-1.6, FLOOR_Y + 1.08, -1.95] });
    },
  );
}

// ------------------------------------------------------------------ Scout: cramped, rounded canopy, no dog

const SCOUT_WINDOW: [number, number][] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * 1.2, 0.58 + Math.sin(a) * 0.62] as [number, number];
});

export function buildCockpitScout(_o: BuildOptions = {}): AssetModel {
  return buildCockpit(
    { ceiling: 1.3, window: SCOUT_WINDOW, frame: "metalDark", walls: "underside", desk: "metalDark", bank: "underside", trim: "red", switches: ["red", "teal", "hullLight"], dog: false },
    (k) => {
      // Heavy bulkheads crowd in from both sides above the consoles: the cramped feel.
      for (const s of [1, -1]) {
        k.box(`bulkhead ${s > 0 ? "right" : "left"}`, 0.45, 1.5, 1.7, "metalDark", { at: [s * (WALL_X - 0.225), 0.55, -1.45] });
        k.box(`bulkhead stripe ${s > 0 ? "right" : "left"}`, 0.03, 0.08, 1.6, "red", { at: [s * (WALL_X - 0.465), 0.2, -1.45] });
      }
      // No dog here: the second seat holds a strapped-down toolbox.
      k.box("toolbox", 0.45, 0.3, 0.6, "teal", { at: [SEAT2.x, FLOOR_Y + 0.825, SEAT2.z] });
      k.box("toolbox strap", 0.48, 0.32, 0.08, "yellow", { at: [SEAT2.x, FLOOR_Y + 0.825, SEAT2.z] });
    },
  );
}
