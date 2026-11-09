// THE THREE COCKPIT INTERIORS (stage C1, revision 1). A view only: no steering, no free flight, no combat.
// Origin = the pilot's eye, looking to -Z, up +Y, 1 unit = 1 crate. Agent 3 places the cockpit at the ship's `eye` anchor.
// Design source: docs/cockpit-design-brief.md, plus Andy's revision-1 answers (2026-11-10, his reference pictures):
// low-poly and chunky, glass wrapping around the pilot instead of a box with a hole, a curved wall of screens,
// controls for looks (levers Agent 3 may nudge later), the co-pilot seat beside the pilot (the dog shows at the right edge),
// half glass and half cockpit, colours and mood per ship, up to 3000 triangles.
//
// Same bones for all three: the curved screen console in front, the pilot seat behind the eye, the co-pilot seat ahead-right.
// Different glass cage, frame and colours:
//   cockpit-cargo-hauler     fighter-style wrap-around: glass front, sides and overhead, diagonal pillars; dark grey and orange
//   cockpit-passenger-liner  bright bridge: windows front and sides, solid roof with cyan glow strips; white and cyan
//   cockpit-scout            overhead canopy: glass over the head, diagonal struts, two joysticks; dark and red

import * as THREE from "three";
import { ModelKit, type ColorName } from "./kit";
import type { AssetModel, BuildOptions } from "./types";

type V3 = [number, number, number];

// ------------------------------------------------------------------ the shared bones

const FLOOR_Y = -1.4;
const SILL_Y = -0.2; // where the glass starts (the "belt line")
const CAGE_BACK_Z = 0.5; // the glass ends here; behind it is a short closed cabin
const CABIN_BACK_Z = 1.3;
const ARC = { r1: 1.3, r2: 1.85, yIn: -0.62, yOut: -0.3, angles: [-52, -30, -10, 10, 24] }; // the curved console, degrees
const COPILOT = { x: 1.15, z: -1.3 }; // the co-pilot seat, ahead-right so the dog shows at the edge of the view

/** A point on the console arc: angle in degrees (0 = straight ahead, + = right), distance r, height y. */
const arc = (deg: number, r: number, y: number): V3 => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, y, -Math.cos(a) * r];
};

interface Cage {
  sf: [number, number]; // front sill corner: half width, z
  sb: [number, number]; // back sill corner: half width, z (z = CAGE_BACK_Z)
  tf: V3; // front top corner (right side): x, y, z
  tb: V3; // back top corner (right side)
  roofGlass: boolean;
  frontStruts: number; // extra struts splitting the front glass
  sideStrut: "middle" | "diagonal" | "none";
}

interface CockpitStyle {
  cage: Cage;
  frame: ColorName; // pillars and rails
  frameT: number; // pillar thickness
  hull: ColorName; // lower walls, cabin
  floor: ColorName;
  console: ColorName;
  trim: ColorName;
  switches: ColorName[];
  seat: ColorName;
  dog: boolean;
}

const mirror = (p: V3): V3 => [-p[0], p[1], p[2]];

function cage(k: ModelKit, s: CockpitStyle): void {
  const c = s.cage;
  const SFR: V3 = [c.sf[0], SILL_Y, c.sf[1]];
  const SBR: V3 = [c.sb[0], SILL_Y, c.sb[1]];
  const TFR = c.tf;
  const TBR = c.tb;
  const [SFL, SBL, TFL, TBL] = [SFR, SBR, TFR, TBR].map(mirror) as [V3, V3, V3, V3];
  const t = s.frameT;

  // The openings (empty space; the checker keeps them clear).
  k.windowOpening("front glass", [SFL, SFR, TFR, TFL]);
  k.windowOpening("right glass", [SFR, SBR, TBR, TFR]);
  k.windowOpening("left glass", [SBL, SFL, TFL, TBL]);
  if (c.roofGlass) k.windowOpening("roof glass", [TFL, TFR, TBR, TBL]);

  // The frame: every edge of the glass cage is a pillar or rail ("strut": allowed in front of the glass).
  const edges: [string, V3, V3][] = [
    ["sill front", SFL, SFR], ["sill right", SFR, SBR], ["sill left", SFL, SBL],
    ["pillar front right", SFR, TFR], ["pillar front left", SFL, TFL],
    ["top front", TFL, TFR], ["top right", TFR, TBR], ["top left", TFL, TBL],
    ["pillar back right", SBR, TBR], ["pillar back left", SBL, TBL], ["top back", TBL, TBR],
  ];
  for (const [name, a, b] of edges) k.beam(`strut ${name}`, a, b, t, s.frame);
  const lerp = (a: V3, b: V3, f: number): V3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  for (let i = 1; i <= c.frontStruts; i++) {
    const f = i / (c.frontStruts + 1);
    k.beam(`strut front ${i}`, lerp(SFL, SFR, f), lerp(TFL, TFR, f), t * 0.8, s.frame);
  }
  for (const side of [1, -1]) {
    const m = side > 0 ? (p: V3): V3 => p : mirror;
    if (c.sideStrut === "middle") k.beam(`strut side ${side}`, m(lerp(SFR, SBR, 0.5)), m(lerp(TFR, TBR, 0.5)), t * 0.8, s.frame);
    if (c.sideStrut === "diagonal") k.beam(`strut side ${side}`, m(SFR), m(lerp(TFR, TBR, 0.6)), t * 0.9, s.frame);
  }
  if (c.roofGlass) k.beam("strut roof spine", [0, TFR[1] + 0.02, TFR[2]], [0, TBR[1] + 0.02, TBR[2]], t * 0.8, s.frame);
  else {
    k.slab("roof", [TFL, TFR, TBR, TBL], [0, 1, 0.15], 0.12, s.hull);
  }

  // Below the glass: lower walls, the nose under the console, the floor.
  const f = (p: V3): V3 => [p[0], FLOOR_Y, p[2]];
  k.slab("lower wall right", [SFR, SBR, f(SBR), f(SFR)], [1, 0, 0], 0.12, s.hull);
  k.slab("lower wall left", [SBL, SFL, f(SFL), f(SBL)], [-1, 0, 0], 0.12, s.hull);
  k.slab("lower nose", [SFL, SFR, f(SFR), f(SFL)], [0, 0, -1], 0.12, s.hull);
  k.slab("floor", [f(SFL), f(SFR), f(SBR), f(SBL)], [0, -1, 0], 0.12, s.floor);
  k.convex("floor extension", [f(SBL), f(SBR), [SBR[0], FLOOR_Y, CABIN_BACK_Z], [SBL[0], FLOOR_Y, CABIN_BACK_Z],
    [SBL[0], FLOOR_Y - 0.12, CAGE_BACK_Z], [SBR[0], FLOOR_Y - 0.12, CAGE_BACK_Z], [SBR[0], FLOOR_Y - 0.12, CABIN_BACK_Z], [SBL[0], FLOOR_Y - 0.12, CABIN_BACK_Z]], s.floor);

  // The short closed cabin behind the glass (seen only when looking back).
  const back = (p: V3): V3 => [p[0], p[1], CABIN_BACK_Z];
  k.slab("cabin roof", [TBL, TBR, back(TBR), back(TBL)], [0, 1, 0], 0.12, s.hull);
  k.slab("cabin right", [SBR, back(SBR), back(TBR), TBR], [1, 0, 0], 0.12, s.hull);
  k.slab("cabin left", [SBL, back(SBL), back(TBL), TBL], [-1, 0, 0], 0.12, s.hull);
  k.slab("cabin right low", [SBR, back(SBR), [SBR[0], FLOOR_Y, CABIN_BACK_Z], f(SBR)], [1, 0, 0], 0.12, s.hull);
  k.slab("cabin left low", [SBL, back(SBL), [SBL[0], FLOOR_Y, CABIN_BACK_Z], f(SBL)], [-1, 0, 0], 0.12, s.hull);
  k.slab("cabin back wall", [[-SBR[0], FLOOR_Y, CABIN_BACK_Z], [SBR[0], FLOOR_Y, CABIN_BACK_Z], [TBR[0], TBR[1], CABIN_BACK_Z], [-TBR[0], TBR[1], CABIN_BACK_Z]], [0, 0, 1], 0.12, s.hull);

  k.anchor("windowLight", [0, (SILL_Y + TFR[1]) / 2, (SFR[2] + TFR[2]) / 2], [0, 0, 1]);
}

/** The curved wall of screens in front of the pilot, with a busy top. */
function consoleArc(k: ModelKit, s: CockpitStyle): void {
  const { r1, r2, yIn, yOut, angles } = ARC;
  const eye = new THREE.Vector3(0, 0, 0);
  const screenNames: (null | [string, string, ColorName])[] = [
    ["screen radar", "", "screenTeal"],
    ["screen info", "screenInfo", "screenTeal"],
    ["screen map", "screenMap", "screenTeal"],
    ["screen fuel", "screenFuel", "screenAmber"],
  ];
  let n = 0;
  for (let i = 0; i + 1 < angles.length; i++) {
    const a0 = angles[i]!;
    const a1 = angles[i + 1]!;
    k.convex(`console ${i + 1}`, [
      arc(a0, r1, FLOOR_Y), arc(a1, r1, FLOOR_Y), arc(a0, r2, FLOOR_Y), arc(a1, r2, FLOOR_Y),
      arc(a0, r1, yIn), arc(a1, r1, yIn), arc(a0, r2, yOut), arc(a1, r2, yOut),
    ], s.console);
    // A coloured trim line along the near edge.
    k.beam(`console trim ${i + 1}`, arc(a0 + 0.5, r1 + 0.02, yIn + 0.02), arc(a1 - 0.5, r1 + 0.02, yIn + 0.02), 0.05, s.trim);
    // The screen stands on the console, facing the pilot.
    const mid = (a0 + a1) / 2;
    const width = 2 * 1.62 * Math.sin((((a1 - a0) / 2) * Math.PI) / 180) * 0.86;
    const h = 0.3;
    const centre = new THREE.Vector3(...arc(mid, 1.66, -0.33));
    const m = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    const look = eye.clone().sub(centre).normalize();
    const spec = screenNames[i];
    if (spec) {
      k.box(`${spec[0]} frame`, width + 0.08, h + 0.08, 0.04, "metalDark", { at: centre.clone().addScaledVector(look, -0.02).toArray() as V3, q });
      k.box(spec[0], width, h, 0.03, spec[2], { at: centre.toArray() as V3, q, layer: "glow" });
      if (spec[1]) {
        const p = centre.clone().addScaledVector(look, 0.02);
        k.screenAnchor(spec[1], [p.x, p.y, p.z], [look.x, look.y, look.z], width, h);
      }
    }
    // Switches, lights and little coloured labels along the top, near the pilot.
    for (let j = 0; j < 4; j++) {
      const deg = a0 + ((a1 - a0) * (j + 0.5)) / 4;
      const r = r1 + 0.12;
      const y = yIn + ((r - r1) / (r2 - r1)) * (yOut - yIn);
      const at = arc(deg, r, y + 0.03);
      const kind = (i * 4 + j) % 5;
      n++;
      if (kind === 0) k.box(`switch ${n}`, 0.08, 0.06, 0.08, s.switches[n % s.switches.length]!, { at });
      else if (kind === 1) k.box(`light ${n}`, 0.07, 0.05, 0.07, (["lightGreen", "lightRed", "engine"] as const)[n % 3], { at, layer: n % 2 ? "blinkA" : "blinkB" });
      else if (kind === 2) k.box(`label ${n}`, 0.14, 0.02, 0.06, (["pink", "teal", "yellow", "orange"] as const)[n % 4], { at });
      else if (kind === 3) k.cyl(`dial ${n}`, 0.06, 0.06, 0.05, 6, "metalDark", { at });
      else k.box(`button ${n}`, 0.09, 0.04, 0.09, s.switches[(n + 1) % s.switches.length]!, { at });
    }
    // Light from the window falls on the far edge of the console (tinted later by planet colour).
    k.beam(`window light ${i + 1}`, arc(a0 + 1, r2 - 0.08, yOut + 0.01), arc(a1 - 1, r2 - 0.08, yOut + 0.01), 0.1, "windowLight", { layer: "light" });
  }
}

function seats(k: ModelKit, s: CockpitStyle): void {
  // Pilot seat, behind the eye (seen only when looking back).
  k.box("pilot seat base", 0.5, 0.5, 0.5, "metalDark", { at: [0, FLOOR_Y + 0.25, 0.45] });
  k.box("pilot seat cushion", 0.75, 0.16, 0.75, s.seat, { at: [0, FLOOR_Y + 0.58, 0.45] });
  k.box("pilot seat back", 0.75, 1.1, 0.16, s.seat, { at: [0, -0.3, 0.88] });
  // Co-pilot seat, ahead and to the right.
  const { x, z } = COPILOT;
  k.box("copilot seat base", 0.45, 0.5, 0.45, "metalDark", { at: [x, FLOOR_Y + 0.25, z] });
  k.box("copilot seat cushion", 0.62, 0.15, 0.7, s.seat, { at: [x, FLOOR_Y + 0.575, z] });
  // A low bucket-seat back, so it never hides the side glass.
  k.box("copilot seat back", 0.62, 0.38, 0.14, s.seat, { at: [x, FLOOR_Y + 0.84, z + 0.4] });
}

/** The co-pilot: an original low-poly dog, curled up asleep on the co-pilot seat, head on its paws, facing the pilot. */
function dog(k: ModelKit): void {
  const top = FLOOR_Y + 0.65; // top of the cushion
  const bx = COPILOT.x + 0.06;
  const bz = COPILOT.z - 0.02;
  k.add("dog body", new THREE.IcosahedronGeometry(0.24, 1).scale(1.0, 0.56, 1.3), "dogTan", { at: [bx, top + 0.13, bz] });
  k.add("dog back patch", new THREE.IcosahedronGeometry(0.11, 0).scale(1.1, 0.6, 1.3), "dogDark", { at: [bx + 0.04, top + 0.24, bz - 0.1] });
  const hx = bx - 0.17;
  const hz = bz + 0.24;
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
  k.box("dog tail", 0.08, 0.07, 0.26, "dogTan", { at: [bx + 0.14, top + 0.05, bz - 0.24], rot: [0, 0.7, 0] });
  k.box("dog tail tip", 0.07, 0.06, 0.1, "hullWhite", { at: [bx + 0.02, top + 0.05, bz - 0.36], rot: [0, 1.2, 0] });
  k.anchor("dog", [bx, top + 0.13, bz], [-1, 0, 0]);
}

/** Two throttle levers on the console, for looks. They turn around their base (Agent 3 may nudge them in flight). */
function throttles(k: ModelKit, knob: ColorName): void {
  for (const [i, deg] of [[1, -6], [2, -1]] as const) {
    const r = ARC.r1 + 0.1;
    const y = ARC.yIn + ((r - ARC.r1) / (ARC.r2 - ARC.r1)) * (ARC.yOut - ARC.yIn);
    k.lever(`throttle ${i}`, arc(deg, r, y + 0.02), [1, 0, 0], 0.5, (l) => {
      l.box("lever stick", 0.04, 0.22, 0.04, "metalDark", { at: [0, 0.11, 0], rot: [0.35, 0, 0] });
      l.box("lever knob", 0.09, 0.06, 0.06, knob, { at: [0, 0.22, 0.04] });
    });
  }
}

function buildCockpit(s: CockpitStyle, extras: (k: ModelKit) => void): AssetModel {
  const k = new ModelKit();
  cage(k, s);
  consoleArc(k, s);
  seats(k, s);
  if (s.dog) dog(k);
  extras(k);
  k.anchor("eye", [0, 0, 0], [0, 0, -1]);
  return k.finish();
}

// ------------------------------------------------------------------ Cargo Hauler: fighter-style wrap-around, dark, orange

export function buildCockpitHauler(_o: BuildOptions = {}): AssetModel {
  return buildCockpit(
    {
      cage: { sf: [1.15, -2.45], sb: [1.9, CAGE_BACK_Z], tf: [0.7, 0.95, -2.0], tb: [1.25, 1.45, CAGE_BACK_Z], roofGlass: true, frontStruts: 2, sideStrut: "middle" },
      frame: "metalDark", frameT: 0.2, hull: "hullDark", floor: "underside", console: "frame", trim: "orange",
      switches: ["orange", "yellow", "red", "hullLight"], seat: "seat", dog: true,
    },
    (k) => {
      throttles(k, "orange");
      // A big orange mug on the console, a hazard stripe along the front sill.
      k.cyl("mug", 0.07, 0.06, 0.14, 6, "orange", { at: arc(-44, 1.5, -0.42) });
      for (let j = 0; j < 7; j++) k.beam(`hazard ${j}`, [-0.9 + j * 0.3, SILL_Y - 0.14, -2.4], [-0.78 + j * 0.3, SILL_Y - 0.14, -2.4], 0.06, j % 2 ? "yellow" : "frame");
    },
  );
}

// ------------------------------------------------------------------ Passenger Liner: bright bridge, white and cyan

export function buildCockpitLiner(_o: BuildOptions = {}): AssetModel {
  return buildCockpit(
    {
      cage: { sf: [1.4, -2.5], sb: [2.0, CAGE_BACK_Z], tf: [1.25, 1.1, -2.35], tb: [1.85, 1.5, CAGE_BACK_Z], roofGlass: false, frontStruts: 2, sideStrut: "middle" },
      frame: "paintWhite", frameT: 0.18, hull: "hullWhite", floor: "paintGrey", console: "paintWhite", trim: "cyan",
      switches: ["blue", "teal", "hullLight", "yellow"], seat: "blue", dog: true,
    },
    (k) => {
      throttles(k, "cyan");
      // Cyan glow strips under the solid roof, along both sides and across the front.
      k.beam("roof glow front", [-0.9, 1.11, -2.0], [0.9, 1.11, -2.0], 0.06, "cyan", { layer: "glow" });
      for (const s of [1, -1]) k.beam(`roof glow side ${s}`, [s * 1.1, 1.08, -2.1], [s * 1.65, 1.38, 0.3], 0.06, "cyan", { layer: "glow" });
      k.beam("roof glow centre", [0, 1.18, -1.9], [0, 1.45, 0.3], 0.1, "cyan", { layer: "glow" });
      // A little potted plant on the left console.
      k.cyl("plant pot", 0.07, 0.05, 0.11, 6, "hullWhite", { at: arc(-44, 1.5, -0.42) });
      k.cone("plant", 0.11, 0.2, 5, "teal", { at: arc(-44, 1.5, -0.27) });
    },
  );
}

// ------------------------------------------------------------------ Scout: overhead canopy, joysticks, dark and red

export function buildCockpitScout(_o: BuildOptions = {}): AssetModel {
  return buildCockpit(
    {
      cage: { sf: [0.9, -2.2], sb: [1.5, CAGE_BACK_Z], tf: [0.3, 0.7, -1.75], tb: [0.95, 1.25, CAGE_BACK_Z], roofGlass: true, frontStruts: 0, sideStrut: "diagonal" },
      frame: "underside", frameT: 0.22, hull: "metalDark", floor: "underside", console: "underside", trim: "red",
      switches: ["red", "teal", "hullLight"], seat: "red", dog: false,
    },
    (k) => {
      // Two joysticks on pedestals, left and right, for looks (they turn around their base).
      for (const side of [1, -1]) {
        k.box(`joystick pedestal ${side}`, 0.18, 0.75, 0.18, "metalDark", { at: [side * 0.48, FLOOR_Y + 0.375, -1.05] });
        k.lever(`joystick ${side > 0 ? "right" : "left"}`, [side * 0.48, FLOOR_Y + 0.76, -1.05], [1, 0, 0], 0.35, (l) => {
          l.box("stick", 0.06, 0.28, 0.06, "metalDark", { at: [0, 0.14, 0] });
          l.box("grip", 0.1, 0.14, 0.1, "red", { at: [0, 0.32, 0] });
          l.box("button", 0.05, 0.03, 0.05, "yellow", { at: [0, 0.4, 0] });
        });
      }
      // No dog on the Scout: the co-pilot seat holds a strapped-down toolbox.
      k.box("toolbox", 0.42, 0.28, 0.55, "teal", { at: [COPILOT.x, FLOOR_Y + 0.79, COPILOT.z] });
      k.box("toolbox strap", 0.45, 0.3, 0.08, "yellow", { at: [COPILOT.x, FLOOR_Y + 0.79, COPILOT.z] });
    },
  );
}
