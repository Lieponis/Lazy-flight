// THE THREE SHIPS (revision 1). Nose points to -Z, up is +Y, the parking point (between the landing feet) is (0, 0, 0).
// Sizes in crate units (see docs/STYLE-GUIDE.md). Andy's direction for revision 1:
//   faceted tops with a dark industrial underside, white and grey paint with a few company colour marks,
//   dark multi-pane cockpit glass with frame bars, glowing engine strips, red/green blinking nav lights,
//   minimal surface detail, no funny touches on ships, up to 1000 triangles.
//
//   cargo-hauler     wide, flat explorer-style hauler, cargo hidden inside (in the spirit of the Asp Explorer)
//   passenger-liner  long, grand liner with a raised top deck and a row of lit windows (Dolphin + Orca feel)
//   scout            small, angular explorer with two side pods (Diamondback Explorer feel)

import { liveryRecolour } from "./liveries";
import { ModelKit, type ColorName, type LoftSection } from "./kit";
import type { AssetModel, BuildOptions } from "./types";

type V3 = [number, number, number];
const HALF_PI = Math.PI / 2;

/** A landing leg with a foot, from the ground up to `top`. */
function leg(k: ModelKit, name: string, x: number, z: number, top: number): void {
  k.box(`${name} leg`, 0.22, top, 0.22, "metalDark", { at: [x, top / 2, z] });
  k.box(`${name} foot`, 0.45, 0.1, 0.45, "underside", { at: [x, 0.05, z] });
}

/** A pair of mirrored blocks (right side given, left side made from it). */
function pair(k: ModelKit, name: string, right: V3[], color: ColorName): void {
  k.hull8(`${name} right`, right, color);
  k.hull8(`${name} left`, ModelKit.mirrorX(right), color);
}

/** A thin ridge (a frame bar) that follows a list of points along the middle of a canopy. */
function ridge(k: ModelKit, name: string, points: [number, number][], w: number, color: ColorName): void {
  const s: LoftSection[] = points.map(([z, y]) => ({ z, y, w, h: w * 0.85 }));
  k.loft(name, s, color);
}

/** Wing marking that lies on a sloped wing top: x from x1 to x2, z from z1 to z2, wing top height given by topY(x). */
function wingMark(k: ModelKit, name: string, x1: number, x2: number, z1: number, z2: number, topY: (x: number) => number, color: ColorName): void {
  const lo = (x: number): number => topY(x) - 0.02;
  const hi = (x: number): number => topY(x) + 0.04;
  pair(k, name, [
    [x1, lo(x1), z1], [x2, lo(x2), z1], [x2, lo(x2), z2], [x1, lo(x1), z2],
    [x1, hi(x1), z1], [x2, hi(x2), z1], [x2, hi(x2), z2], [x1, hi(x1), z2],
  ], color);
}

/** Two engine flames growing backwards from z, at x = +-dx (or one in the middle when dx = 0). */
function flames(k: ModelKit, dx: number, y: number, z: number, r: number, len: number): void {
  for (const x of dx === 0 ? [0] : [-dx, dx]) {
    k.cone(`flame ${x}`, r, len, 6, "engine", { at: [x, y, z + len / 2], rot: [HALF_PI, 0, 0], layer: "flame" });
  }
  k.flameOrigin([0, y, z]);
}

// ------------------------------------------------------------------ Cargo Hauler

export function buildCargoHauler(o: BuildOptions = {}): AssetModel {
  const k = new ModelKit({ recolour: liveryRecolour("cargo-hauler", o.livery) });
  // Body: a wide, flat faceted wedge. The cargo is inside.
  k.loft("hull", [
    { z: -3.1, w: 1.3, h: 0.45, y: 1.0, ct: 0.15, cb: 0.1 },
    { z: -2.2, w: 2.7, h: 0.9, y: 1.05, ct: 0.35, cb: 0.2 },
    { z: 0.0, w: 3.4, h: 1.15, y: 1.1, ct: 0.45, cb: 0.25 },
    { z: 2.1, w: 3.3, h: 1.1, y: 1.1, ct: 0.45, cb: 0.25 },
    { z: 2.6, w: 2.9, h: 0.95, y: 1.1, ct: 0.35, cb: 0.2 },
  ], "paintWhite");
  // Industrial underside: a dark belly plate and two intakes.
  k.loft("belly", [
    { z: -2.0, w: 2.0, h: 0.25, y: 0.62, cb: 0.08 },
    { z: 2.4, w: 2.6, h: 0.3, y: 0.62, cb: 0.08 },
  ], "underside");
  for (const s of [1, -1]) k.box(`intake ${s > 0 ? "right" : "left"}`, 0.6, 0.3, 0.9, "metalDark", { at: [0.8 * s, 0.6, -1.4] });
  // The big cockpit: dark glass in panes, with frame bars.
  k.loft("canopy", [
    { z: -3.0, w: 0.9, h: 0.16, y: 1.24, ct: 0.06 },
    { z: -2.2, w: 1.9, h: 0.5, y: 1.55, ct: 0.2 },
    { z: -1.5, w: 1.8, h: 0.45, y: 1.62, ct: 0.18 },
  ], "glassDark");
  ridge(k, "canopy ridge", [[-2.95, 1.31], [-2.2, 1.8], [-1.5, 1.84]], 0.16, "paintWhite");
  k.box("canopy bar front", 1.1, 0.14, 0.16, "paintWhite", { at: [0, 1.56, -2.6] });
  k.box("canopy bar back", 1.55, 0.14, 0.16, "paintWhite", { at: [0, 1.8, -2.2] });
  // Wide wings that droop a little, with dark end plates.
  const wingTop = (x: number): number => 1.15 - ((x - 1.5) / 1.4) * 0.37;
  pair(k, "wing", [
    [1.5, 0.85, -1.4], [2.9, 0.62, 0.4], [2.9, 0.62, 1.5], [1.5, 0.85, 2.0],
    [1.5, 1.15, -1.2], [2.9, 0.78, 0.5], [2.9, 0.78, 1.4], [1.5, 1.15, 1.8],
  ], "paintGrey");
  for (const s of [1, -1]) k.box(`wing end ${s > 0 ? "right" : "left"}`, 0.2, 0.3, 1.2, "metalDark", { at: [2.95 * s, 0.7, 0.95] });
  // Company marks: an orange band across the back and an orange block on each wing.
  k.box("company band", 2.3, 0.05, 0.35, "orange", { at: [0, 1.67, 1.4] });
  wingMark(k, "company mark", 2.2, 2.7, 0.6, 1.3, wingTop, "orange");
  // Two engine pods with glowing exhaust strips, joined by a dark block.
  for (const s of [1, -1]) {
    const side = s > 0 ? "right" : "left";
    k.loft(`engine pod ${side}`, [
      { x: 1.0 * s, z: 1.4, w: 0.9, h: 0.75, y: 1.05, ct: 0.2, cb: 0.2 },
      { x: 1.0 * s, z: 3.1, w: 0.95, h: 0.8, y: 1.05, ct: 0.22, cb: 0.22 },
      { x: 1.0 * s, z: 3.3, w: 0.8, h: 0.65, y: 1.05, ct: 0.18, cb: 0.18 },
    ], "paintGrey");
    k.box(`exhaust ${side}`, 0.62, 0.4, 0.06, "engine", { at: [1.0 * s, 1.05, 3.33], layer: "glow" });
  }
  k.box("engine bridge", 1.2, 0.6, 0.5, "metalDark", { at: [0, 1.05, 2.75] });
  flames(k, 1.0, 1.05, 3.36, 0.26, 1);
  // Nav lights on the wing ends: red left, green right, blinking in turn.
  k.box("nav light left", 0.25, 0.25, 0.25, "lightRed", { at: [-3.1, 0.72, 0.95], layer: "blinkA" });
  k.box("nav light right", 0.25, 0.25, 0.25, "lightGreen", { at: [3.1, 0.72, 0.95], layer: "blinkB" });
  leg(k, "front", 0, -1.9, 0.6);
  leg(k, "back right", 1.0, 1.4, 0.55);
  leg(k, "back left", -1.0, 1.4, 0.55);

  k.anchor("parking", [0, 0, 0])
    .anchor("eye", [0, 1.55, -2.4])
    .anchor("nose", [0, 1.0, -3.1])
    .anchor("engineL", [-1.0, 1.05, 3.36], [0, 0, 1])
    .anchor("engineR", [1.0, 1.05, 3.36], [0, 0, 1]);
  return k.finish();
}

// ------------------------------------------------------------------ Passenger Liner

/** Half the width of the liner's side wall at z (between z -0.8 and 1.8 it widens from 1.3 to 1.7). */
const linerHalfWidth = (z: number): number => 1.3 + ((z + 0.8) / 2.6) * 0.4;
const LINER_SIDE_ANGLE = Math.atan(0.4 / 2.6);

export function buildPassengerLiner(o: BuildOptions = {}): AssetModel {
  const k = new ModelKit({ recolour: liveryRecolour("passenger-liner", o.livery) });
  k.loft("hull", [
    { z: -3.8, w: 0.4, h: 0.3, y: 1.05, ct: 0.1, cb: 0.1 },
    { z: -2.6, w: 1.6, h: 0.95, y: 1.15, ct: 0.35, cb: 0.2 },
    { z: -0.8, w: 2.6, h: 1.3, y: 1.25, ct: 0.5, cb: 0.25 },
    { z: 1.8, w: 3.4, h: 1.35, y: 1.25, ct: 0.5, cb: 0.3 },
    { z: 3.2, w: 3.6, h: 1.1, y: 1.2, ct: 0.4, cb: 0.3 },
  ], "paintWhite");
  // The raised top deck (the grand "liner" look).
  k.loft("top deck", [
    { z: -1.8, w: 0.5, h: 0.2, y: 1.78, ct: 0.08 },
    { z: 0.2, w: 1.7, h: 0.5, y: 1.95, ct: 0.2 },
    { z: 2.4, w: 1.9, h: 0.5, y: 1.95, ct: 0.2 },
    { z: 3.0, w: 1.5, h: 0.3, y: 1.85, ct: 0.12 },
  ], "paintTrim");
  k.loft("belly", [
    { z: -2.4, w: 1.2, h: 0.25, y: 0.75, cb: 0.08 },
    { z: 3.0, w: 2.8, h: 0.3, y: 0.66, cb: 0.1 },
  ], "underside");
  // Cockpit: dark glass panes with a frame ridge and one cross bar.
  k.loft("canopy", [
    { z: -3.35, w: 0.4, h: 0.16, y: 1.38, ct: 0.05 },
    { z: -2.5, w: 1.2, h: 0.36, y: 1.66, ct: 0.14 },
    { z: -2.0, w: 1.1, h: 0.3, y: 1.72, ct: 0.12 },
  ], "glassDark");
  ridge(k, "canopy ridge", [[-3.3, 1.47], [-2.5, 1.84], [-2.0, 1.88]], 0.14, "paintWhite");
  k.box("canopy bar", 0.9, 0.12, 0.14, "paintWhite", { at: [0, 1.84, -2.5] });
  // A row of eight lit windows on each side, with a blue company stripe under them.
  for (const s of [1, -1]) {
    const side = s > 0 ? "right" : "left";
    [-0.5, -0.2, 0.1, 0.4, 0.7, 1.0, 1.3, 1.6].forEach((z, i) => {
      k.box(`window ${side} ${i + 1}`, 0.1, 0.24, 0.2, "window", {
        at: [linerHalfWidth(z) * s, 1.2, z],
        rot: [0, LINER_SIDE_ANGLE * s, 0],
        layer: "glow",
      });
    });
  }
  const sx = (z: number, dx: number): number => linerHalfWidth(z) + dx;
  pair(k, "company stripe", [
    [sx(-0.7, -0.03), 0.9, -0.7], [sx(-0.7, 0.04), 0.9, -0.7], [sx(1.75, 0.04), 0.9, 1.75], [sx(1.75, -0.03), 0.9, 1.75],
    [sx(-0.7, -0.03), 1.04, -0.7], [sx(-0.7, 0.04), 1.04, -0.7], [sx(1.75, 0.04), 1.04, 1.75], [sx(1.75, -0.03), 1.04, 1.75],
  ], "blue");
  // One swept tail fin with a blue company mark, and two short side wings with nav lights.
  k.hull8("tail fin", [
    [-0.12, 2.1, 1.9], [0.12, 2.1, 1.9], [0.12, 2.1, 3.0], [-0.12, 2.1, 3.0],
    [-0.08, 2.85, 2.85], [0.08, 2.85, 2.85], [0.08, 2.85, 3.25], [-0.08, 2.85, 3.25],
  ], "paintTrim");
  k.box("fin company mark", 0.2, 0.3, 0.45, "blue", { at: [0, 2.7, 2.98] });
  pair(k, "side wing", [
    [1.55, 0.85, 0.9], [2.4, 0.78, 2.3], [2.4, 0.78, 3.0], [1.55, 0.85, 3.0],
    [1.55, 1.1, 1.1], [2.4, 0.92, 2.4], [2.4, 0.92, 2.95], [1.55, 1.1, 2.95],
  ], "paintGrey");
  k.box("nav light left", 0.22, 0.22, 0.22, "lightRed", { at: [-2.5, 0.85, 2.65], layer: "blinkA" });
  k.box("nav light right", 0.22, 0.22, 0.22, "lightGreen", { at: [2.5, 0.85, 2.65], layer: "blinkB" });
  // Wide engine bank: a dark frame with two glowing strips.
  k.box("engine frame", 3.0, 0.55, 0.2, "metalDark", { at: [0, 1.2, 3.12] });
  for (const s of [1, -1]) k.box(`exhaust ${s > 0 ? "right" : "left"}`, 1.2, 0.32, 0.06, "engine", { at: [0.8 * s, 1.2, 3.22], layer: "glow" });
  flames(k, 0.8, 1.2, 3.25, 0.22, 1);
  leg(k, "front", 0, -2.4, 0.7);
  leg(k, "back right", 1.2, 1.8, 0.6);
  leg(k, "back left", -1.2, 1.8, 0.6);

  k.anchor("parking", [0, 0, 0])
    .anchor("eye", [0, 1.65, -2.6])
    .anchor("nose", [0, 1.05, -3.8])
    .anchor("engineL", [-0.8, 1.2, 3.25], [0, 0, 1])
    .anchor("engineR", [0.8, 1.2, 3.25], [0, 0, 1]);
  return k.finish();
}

// ------------------------------------------------------------------ Scout

export function buildScout(o: BuildOptions = {}): AssetModel {
  const k = new ModelKit({ recolour: liveryRecolour("scout", o.livery) });
  // Angular body with a sharp wedge nose.
  k.loft("body", [
    { z: -2.0, w: 0.5, h: 0.2, y: 0.8, ct: 0.08, cb: 0.05 },
    { z: -0.6, w: 1.6, h: 0.6, y: 0.85, ct: 0.3, cb: 0.15 },
    { z: 0.8, w: 2.0, h: 0.75, y: 0.9, ct: 0.35, cb: 0.2 },
    { z: 1.7, w: 1.7, h: 0.7, y: 0.9, ct: 0.3, cb: 0.2 },
  ], "paintGrey");
  k.loft("belly", [
    { z: -1.0, w: 0.8, h: 0.2, y: 0.5, cb: 0.06 },
    { z: 1.6, w: 1.3, h: 0.25, y: 0.5, cb: 0.06 },
  ], "underside");
  // Two dark side pods, joined to the body, with short swept fins.
  for (const s of [1, -1]) {
    const side = s > 0 ? "right" : "left";
    k.loft(`side pod ${side}`, [
      { x: 1.2 * s, z: -0.4, w: 0.5, h: 0.4, y: 0.75, ct: 0.15, cb: 0.1 },
      { x: 1.2 * s, z: 0.4, w: 0.75, h: 0.6, y: 0.78, ct: 0.22, cb: 0.15 },
      { x: 1.2 * s, z: 1.9, w: 0.75, h: 0.6, y: 0.78, ct: 0.22, cb: 0.15 },
      { x: 1.2 * s, z: 2.1, w: 0.6, h: 0.45, y: 0.78, ct: 0.15, cb: 0.1 },
    ], "metalDark");
    k.box(`pod company mark ${side}`, 0.3, 0.04, 1.0, "teal", { at: [1.2 * s, 1.085, 1.0] });
  }
  pair(k, "pod joint", [
    [0.8, 0.65, 0.0], [1.0, 0.62, 0.4], [1.0, 0.62, 1.6], [0.8, 0.65, 1.6],
    [0.8, 0.95, 0.2], [1.0, 0.9, 0.5], [1.0, 0.9, 1.5], [0.8, 0.95, 1.5],
  ], "paintGrey");
  pair(k, "fin", [
    [1.5, 0.7, 0.6], [2.1, 0.6, 1.5], [2.1, 0.6, 1.9], [1.5, 0.7, 1.8],
    [1.5, 0.85, 0.7], [2.1, 0.7, 1.55], [2.1, 0.7, 1.85], [1.5, 0.85, 1.75],
  ], "paintGrey");
  // Cockpit: dark glass panes, frame ridge, one cross bar.
  k.loft("canopy", [
    { z: -1.5, w: 0.36, h: 0.12, y: 1.0, ct: 0.04 },
    { z: -0.6, w: 0.9, h: 0.3, y: 1.2, ct: 0.12 },
    { z: -0.1, w: 0.85, h: 0.28, y: 1.24, ct: 0.1 },
  ], "glassDark");
  ridge(k, "canopy ridge", [[-1.45, 1.06], [-0.6, 1.35], [-0.1, 1.38]], 0.12, "paintGrey");
  k.box("canopy bar", 0.7, 0.1, 0.12, "paintGrey", { at: [0, 1.35, -0.6] });
  k.box("company band", 0.9, 0.04, 0.25, "teal", { at: [0, 1.27, 1.2] });
  // One big central engine with a glowing strip.
  k.loft("engine housing", [
    { z: 1.5, w: 1.1, h: 0.5, y: 0.9, ct: 0.15, cb: 0.1 },
    { z: 1.95, w: 1.0, h: 0.45, y: 0.9, ct: 0.13, cb: 0.1 },
  ], "metalDark");
  k.box("exhaust", 0.8, 0.28, 0.06, "engine", { at: [0, 0.9, 1.97], layer: "glow" });
  flames(k, 0, 0.9, 2.0, 0.3, 1.1);
  k.box("nav light left", 0.2, 0.2, 0.2, "lightRed", { at: [-2.15, 0.65, 1.7], layer: "blinkA" });
  k.box("nav light right", 0.2, 0.2, 0.2, "lightGreen", { at: [2.15, 0.65, 1.7], layer: "blinkB" });
  leg(k, "front", 0, -1.0, 0.6);
  leg(k, "back right", 0.6, 1.0, 0.5);
  leg(k, "back left", -0.6, 1.0, 0.5);

  k.anchor("parking", [0, 0, 0])
    .anchor("eye", [0, 1.2, -0.7])
    .anchor("nose", [0, 0.8, -2.0])
    .anchor("engineMain", [0, 0.9, 2.0], [0, 0, 1]);
  return k.finish();
}
