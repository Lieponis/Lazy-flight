// STAND-IN GALAXY (prototype G2). A smooth "how much starlight and dust is at this spot" function.
// Agent 2's real density function replaces `standInField` later; everything else only uses the GalaxyField shape below.
//
// Coordinates: light years. The galaxy centre is (0,0,0). The flat disc lies in the x/z plane; y is "up out of the disc".
// Plain words: a "density" says how crowded with stars a place is. Light we see from far away is the sum of the
// starlight along the line of sight, dimmed by dust on the way. Dust is what makes the dark lanes in the Milky Way.

import { valueNoise } from "./hash";

export const GALAXY_RADIUS_LY = 50_000;
export const CENTRE_SPACING_LY = 2;
export const RIM_SPACING_LY = 160;
/** Where a new player starts: one third of the way from the centre to the rim. */
export const START_RADIUS_LY = GALAXY_RADIUS_LY / 3;

/** What the field says at one point. Filled in by `sample`, so the sky builder never allocates in its inner loop. */
export interface FieldSample {
  /** Light from the older, yellow-orange stars (disc, bulge), in made-up units. */
  old: number;
  /** Light from young, hot, blue stars (they sit in the spiral arms). */
  young: number;
  /** How much dust dims the light, per light year. */
  dust: number;
}

export interface GalaxyField {
  /** Fills `out` for the point (x, y, z). */
  sample(x: number, y: number, z: number, out: FieldSample): void;
  /** Typical distance between two neighbouring systems here (light years). */
  spacingAt(x: number, y: number, z: number): number;
}

const LN_RATIO = Math.log(RIM_SPACING_LY / CENTRE_SPACING_LY); // ln 80
const ARM_COUNT = 2;
const ARM_PITCH = (14 * Math.PI) / 180; // how tightly the arms wind
const ARM_TURN = 1 / Math.tan(ARM_PITCH);
const ARM_START_R = 1500;
const ARM_ANGLE_0 = 0.6; // where arm 1 starts (radians): changes which way the pattern points
const ARM_SHARP = 2.2;
const ARM_FLOOR = 0.22; // between the arms there is still this share of the density
const DUST_ANGLE_SHIFT = 0.3; // dust lanes sit a little before the bright part of each arm

function smoothstep(a: number, b: number, x: number): number {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** Typical distance between systems at distance r from the centre: 2 ly in the middle, 160 ly at the rim (exponential). */
export function spacingAtRadius(r: number): number {
  return CENTRE_SPACING_LY * Math.exp((LN_RATIO * Math.min(r, GALAXY_RADIUS_LY * 1.1)) / GALAXY_RADIUS_LY);
}

/** Thickness of the disc (light years, full): 2,000 at the centre, 500 at the rim. */
export function discThickness(r: number): number {
  return 2000 - 1500 * Math.min(r / GALAXY_RADIUS_LY, 1);
}

/** 1 on the middle of an arm, small between arms. `shift` moves the pattern (used for the dust lanes). */
function armWeight(r: number, phi: number, shift: number): number {
  const armPhi = ARM_ANGLE_0 + Math.log(Math.max(r, 1) / ARM_START_R) * ARM_TURN + shift;
  return Math.exp(ARM_SHARP * (Math.cos(ARM_COUNT * (phi - armPhi)) - 1));
}

const DUST_AT_START = 9e-4; // optical depth per light year in the mid-plane at the start radius (about 0.5 "magnitudes" per 1,000 ly)
const DUST_MAX = 3.2e-3;

export const standInField: GalaxyField = {
  spacingAt(x, _y, z) {
    return spacingAtRadius(Math.hypot(x, z));
  },
  sample(x, y, z, out) {
    const r2 = x * x + z * z;
    const rho = Math.sqrt(r2 + y * y);
    const bulge = 0.06 * Math.exp(-rho / 900);
    const r = Math.sqrt(r2);
    const sigma = discThickness(r) / 4;
    const yv = y / sigma;
    // Far above or below the disc only the bulge is left: quick answer (most of the sky's rays spend their time here).
    if (yv > 6 || yv < -6) {
      out.old = bulge;
      out.young = 0;
      out.dust = 0;
      return;
    }
    const nMid = Math.exp((-3 * LN_RATIO * Math.min(r, GALAXY_RADIUS_LY * 1.1)) / GALAXY_RADIUS_LY) / (CENTRE_SPACING_LY * CENTRE_SPACING_LY * CENTRE_SPACING_LY);
    const taper = r <= GALAXY_RADIUS_LY ? 1 : Math.exp(-(((r - GALAXY_RADIUS_LY) / (0.06 * GALAXY_RADIUS_LY)) ** 2));
    const vert = Math.exp(-0.5 * yv * yv);
    const strength = smoothstep(ARM_START_R, 5500, r);
    const phi = Math.atan2(z, x);
    const arm = strength > 0 ? armWeight(r, phi, 0) : 0;
    const armMul = 1 - strength + strength * (ARM_FLOOR + (1 - ARM_FLOOR) * arm);
    // Star clouds: the light is lumpy on a scale of a few hundred light years (the glow is not a smooth haze).
    const n1 = valueNoise(x / 550, y / 260, z / 550, 11);
    const clump = 0.2 + 2.2 * n1 * n1;
    out.old = nMid * vert * armMul * taper * clump + bulge;
    // Young blue stars: thin layer, only in the arms, much brighter than the average star.
    const yThin = y / (0.4 * sigma);
    out.young = yThin > 6 || yThin < -6 ? 0 : 4 * nMid * strength * Math.pow(arm, 1.3) * Math.exp(-0.5 * yThin * yThin) * taper * clump;

    // Dust: a thin lumpy layer, most in the dust lanes just before the arms, fewer far from the centre.
    const yd = y / 90;
    if (yd > 5 || yd < -5) {
      out.dust = 0;
    } else {
      const lane = ARM_FLOOR + (1 - ARM_FLOOR) * (strength > 0 ? armWeight(r, phi, DUST_ANGLE_SHIFT) : 0.5);
      const nz = valueNoise(x / 500, y / 190, z / 500, 3);
      const lump = 0.05 + 3.4 * nz * nz;
      const radial = Math.exp(-(r - START_RADIUS_LY) / 9000);
      out.dust = Math.min(DUST_MAX, DUST_AT_START * radial * Math.exp(-0.5 * yd * yd) * lane * lump * taper);
    }
  },
};

/** The four places Andy can jump to in the preview. Positions are in light years from the galaxy centre. */
export interface Teleport {
  id: "centre" | "start" | "middle" | "rim";
  label: string;
  position: { x: number; y: number; z: number };
}

/** A point at distance r from the centre, turned by `angle` (radians) around the disc, at height y. */
export function pointAt(r: number, angle: number, y = 0): { x: number; y: number; z: number } {
  return { x: r * Math.cos(angle), y, z: r * Math.sin(angle) };
}

export const TELEPORTS: Teleport[] = [
  { id: "centre", label: "CENTRE", position: pointAt(400, 0.3) },
  { id: "start", label: "START", position: pointAt(START_RADIUS_LY, 2.1) },
  { id: "middle", label: "MIDDLE", position: pointAt(GALAXY_RADIUS_LY * 0.6, 4.0) },
  { id: "rim", label: "RIM", position: pointAt(GALAXY_RADIUS_LY * 0.96, 5.2) },
];

/** Where, in the stand-in, a place sits: distance from the centre in the disc and its local spacing. */
export function describePlace(p: { x: number; y: number; z: number }): { radius: number; spacing: number } {
  const radius = Math.hypot(p.x, p.z);
  return { radius, spacing: spacingAtRadius(radius) };
}

/** Unit-length directions the preview can look in, as seen from the position p. */
export type LookId = "centre" | "rim" | "up";

export function lookDirection(id: LookId, p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  if (id === "up") return { x: 0, y: 1, z: 0 };
  const r = Math.hypot(p.x, p.z);
  // At the very centre "toward the centre" has no meaning: use a fixed side so the button still does something.
  if (r < 50) return id === "centre" ? { x: 1, y: 0, z: 0 } : { x: -1, y: 0, z: 0 };
  const sign = id === "centre" ? -1 : 1;
  return { x: (sign * p.x) / r, y: 0, z: (sign * p.z) / r };
}
