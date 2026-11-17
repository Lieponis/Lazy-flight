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

/** Vertical spread of the disc's stars (light years): a quarter of the thickness. Used by the sky glow and by the near stars. */
export function discSigma(r: number): number {
  return discThickness(r) / 4;
}

/** Past the galaxy's edge the starlight fades out: 1 up to the edge, then a bell curve over about 3,000 ly (6% of the radius). */
export function edgeTaper(r: number): number {
  return r <= GALAXY_RADIUS_LY ? 1 : Math.exp(-(((r - GALAXY_RADIUS_LY) / (0.06 * GALAXY_RADIUS_LY)) ** 2));
}

/**
 * The SHAPE of the galaxy's stars (0..1) at a point, ignoring arms and clumps: how thick the disc is there and where its edge is.
 * 1 on the middle of the disc inside the edge, falling like a bell curve above and below it, and fading out beyond the edge.
 * The sky glow uses exactly these two pieces (`discSigma`, `edgeTaper`); the near stars use this to take the same shape.
 */
export function discEnvelope(x: number, y: number, z: number): number {
  const r = Math.hypot(x, z);
  const yv = y / discSigma(r);
  if (yv > 6 || yv < -6) return 0;
  return Math.exp(-0.5 * yv * yv) * edgeTaper(r);
}

/** 1 on the middle of an arm, small between arms. `shift` moves the pattern (used for the dust lanes). */
function armWeight(r: number, phi: number, shift: number): number {
  const armPhi = ARM_ANGLE_0 + Math.log(Math.max(r, 1) / ARM_START_R) * ARM_TURN + shift;
  return Math.exp(ARM_SHARP * (Math.cos(ARM_COUNT * (phi - armPhi)) - 1));
}

const DUST_AT_START = 6.5e-4; // optical depth per light year in the mid-plane at the start radius (about 0.5 "magnitudes" per 1,000 ly)
const DUST_MAX = 3.2e-3;
/** How far the dust layer waves up and down (light years), and the height above which there is never any dust (5 x 90 ly + the wave). */
const DUST_WARP_LY = 150;
/** Closer to the centre than this (light years) there is no dust; it reaches full strength at the second distance. */
const DUST_CORE_CLEAR_LY = 3000;
const DUST_CORE_FULL_LY = 9000;
export const DUST_REACH_LY = 5 * 90 + DUST_WARP_LY + 10;

/**
 * Where a point is relative to the wavy dust layer, in units of 90 ly (the layer's thickness): 0 = its middle, beyond +-5 there is no dust.
 * The layer is not perfectly flat: it waves up and down by up to about 150 light years over thousands of light years, like the lane of
 * a real edge-on galaxy. Without this, seen from the rim the lane is one perfectly straight line.
 */
export function dustHeight(x: number, y: number, z: number): number {
  const warp = Math.abs(y) > DUST_REACH_LY ? 0 : DUST_WARP_LY * (2 * valueNoise(x / 4200, 0.5, z / 4200, 41) - 1);
  return (y - warp) / 90;
}

/**
 * The dust at a point inside the layer (`yd` = `dustHeight`, between -5 and 5). `laneArm` (0..1) says how close the point is to the
 * middle of a dust lane (the arm pattern turned a little before the bright arms): 1 on a lane, small between lanes. `taper` is
 * the galaxy's edge fade. Shared by the stand-in galaxy and the real one (`universefield.ts`): only the arms differ.
 */
export function dustInLayer(x: number, y: number, z: number, r: number, yd: number, laneArm: number, taper: number): number {
  const lane = ARM_FLOOR + (1 - ARM_FLOOR) * laneArm;
  const nz = valueNoise(x / 800, y / 190, z / 800, 3);
  // Big patches (a few thousand light years across) on top of the small lumps: where a patch is thin, the dark lane breaks up
  // and the stars behind it shine through. Seen from far away this is what stops the lane being one perfect straight line.
  const nBig = valueNoise(x / 3200, y / 700, z / 3200, 29);
  const patch = 0.1 + 1.9 * smoothstep(0.3, 0.7, nBig);
  const lump = (0.03 + 4.5 * nz * nz * nz) * patch; // cubed: more empty gaps, fewer but denser clouds
  const radial = Math.min(2, Math.exp(-(r - START_RADIUS_LY) / 9000)); // more dust toward the centre, but not too much (the centre should still glow)
  // No dust clouds near the centre: the dust fades out between 3,000 and 9,000 ly from the centre (Andy's request).
  const core = smoothstep(DUST_CORE_CLEAR_LY, DUST_CORE_FULL_LY, r);
  return Math.min(DUST_MAX, DUST_AT_START * radial * core * Math.exp(-0.5 * yd * yd) * lane * lump * taper);
}

export const standInField: GalaxyField = {
  spacingAt(x, _y, z) {
    return spacingAtRadius(Math.hypot(x, z));
  },
  sample(x, y, z, out) {
    const r2 = x * x + z * z;
    const rho = Math.sqrt(r2 + y * y);
    const bulge = 0.06 * Math.exp(-rho / 900);
    const r = Math.sqrt(r2);
    const sigma = discSigma(r);
    const yv = y / sigma;
    // Far above or below the disc only the bulge is left: quick answer (most of the sky's rays spend their time here).
    if (yv > 6 || yv < -6) {
      out.old = bulge;
      out.young = 0;
      out.dust = 0;
      return;
    }
    const nMid = Math.exp((-3 * LN_RATIO * Math.min(r, GALAXY_RADIUS_LY * 1.1)) / GALAXY_RADIUS_LY) / (CENTRE_SPACING_LY * CENTRE_SPACING_LY * CENTRE_SPACING_LY);
    const taper = edgeTaper(r);
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

    // Dust: a thin lumpy layer, most in the dust lanes just before the arms, fewer far from the centre (see `dustHeight`, `dustInLayer`).
    const yd = dustHeight(x, y, z);
    out.dust = yd > 5 || yd < -5 ? 0 : dustInLayer(x, y, z, r, yd, strength > 0 ? armWeight(r, phi, DUST_ANGLE_SHIFT) : 0.5, taper);
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

// ------------------------------------------------------------------------------------------ placing sky dots

/**
 * A simple "where could a star be" guess used to place sky dots (importance sampling): most stars sit in a thin disc that
 * thins out with distance from the centre, plus a round bulge. `draw` picks a point from this guess and returns how likely
 * the guess was to pick it. The dot builder then keeps points in proportion to the real field divided by this guess.
 * Agent 2's real generator can use the same guess (or its own) later; it only has to return a point and its probability.
 */
export interface StarProposal {
  draw(rand: () => number, out: { x: number; y: number; z: number }): number;
}

const DISC_SCALE_LY = GALAXY_RADIUS_LY / (3 * LN_RATIO); // the stand-in disc's density falls by e every 3,800 ly
const BULGE_SCALE_LY = 900;
const DISC_SHARE = 0.8;

export const standInProposal: StarProposal = {
  draw(rand, out) {
    if (rand() < DISC_SHARE) {
      const r = -DISC_SCALE_LY * Math.log(Math.max(1e-12, rand() * rand()));
      const a = rand() * Math.PI * 2;
      const sigma = Math.max(50, discThickness(r) / 4);
      // A normal (bell curve) random number from two uniform ones.
      const g = Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(Math.PI * 2 * rand());
      out.x = r * Math.cos(a);
      out.z = r * Math.sin(a);
      out.y = g * sigma * 1.6; // a bit wider than the real disc, so the arms' thin young layer is still covered
    } else {
      const rho = -BULGE_SCALE_LY * Math.log(Math.max(1e-18, rand() * rand() * rand()));
      const c = rand() * 2 - 1;
      const sn = Math.sqrt(1 - c * c);
      const a = rand() * Math.PI * 2;
      out.x = rho * sn * Math.cos(a);
      out.y = rho * c;
      out.z = rho * sn * Math.sin(a);
    }
    const r = Math.hypot(out.x, out.z);
    const rho = Math.hypot(r, out.y);
    const sigma = Math.max(50, discThickness(r) / 4) * 1.6;
    const disc = Math.exp(-r / DISC_SCALE_LY) / (2 * Math.PI * DISC_SCALE_LY * DISC_SCALE_LY) * Math.exp(-0.5 * (out.y / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
    const bulge = Math.exp(-rho / BULGE_SCALE_LY) / (8 * Math.PI * BULGE_SCALE_LY ** 3);
    return DISC_SHARE * disc + (1 - DISC_SHARE) * bulge;
  },
};
