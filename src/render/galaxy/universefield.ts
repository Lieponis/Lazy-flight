// THE SKY'S GALAXY, FROM THE REAL UNIVERSE (stage G5a step 3). Pure maths, no Three.js, no universe code.
//
// Plain words: the sky you see from a place is the light of all the stars along each line of sight, dimmed by dust. Until now that came
// from a made-up galaxy (`standInField`). Now the app hands the render layer a few plain functions of the REAL universe (how crowded
// with systems a point is, how far apart neighbours are, how thick the disc is, where the arms are), and this file turns them into the
// same kind of `GalaxyField` the sky builders already use. So the band, the bulge and the arms are where the universe really has them.
// What stays invented (and was already invented in the stand-in): the lumpiness of the star clouds, the dust and its lanes, and the
// colour of the young blue stars in the arms. The universe has no dust and no colours.

import { valueNoise } from "./hash";
import { dustHeight, dustInLayer, edgeTaper, GALAXY_RADIUS_LY, type FieldSample, type GalaxyField } from "./galaxyfield";

/** The universe's functions, as plain numbers in and out (the glue file src/mapsource.ts builds them from src/universe). */
export interface SkyFunctions {
  /** Systems per cubic light year at a point; 0 outside the disc (the universe's own `densityAt`). */
  density(x: number, y: number, z: number): number;
  /** Average distance between neighbouring systems in the middle of the disc at distance `r` from the galaxy centre (`spacingAt`). */
  spacing(r: number): number;
  /** Full thickness of the disc at distance `r` (`thicknessAt`). */
  thickness(r: number): number;
  /** The spiral arms (`armFactor`): 1 on average, above 1 inside an arm. `c` and `s` are the cosine and sine of the angle round the galaxy. */
  armFactor(r: number, c: number, s: number): number;
}

/**
 * Numbers copied from the universe's galaxy shape (src/universe/galaxy/params.ts): how strong the arms get and between which distances
 * from the centre they fade in. The render layer may not import the universe, so a test (tests/galaxymap.test.ts) measures the real
 * `armFactor` and fails if these ever drift apart.
 */
export const UNIVERSE_ARM_STRENGTH = 0.75;
export const UNIVERSE_ARM_FADE_FROM = 1500;
export const UNIVERSE_ARM_FADE_TO = 5000;

/** How narrow the bright arms look (bigger = thinner arms), and how far before an arm its dust lane sits (radians). Same as the stand-in. */
const ARM_SHARP = 2.2;
const DUST_ANGLE_SHIFT = 0.3;

function smoothstep(a: number, b: number, x: number): number {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** How strong the arms are at distance r (0 in the round bulge, 0.75 beyond 5,000 ly): the universe's `armAmplitude`. */
export function armAmplitudeAt(r: number): number {
  return UNIVERSE_ARM_STRENGTH * smoothstep(UNIVERSE_ARM_FADE_FROM, UNIVERSE_ARM_FADE_TO, r);
}

/**
 * 1 on the middle of an arm, falling to nearly 0 between arms (the sharpened version of the universe's arm factor), turned by `shift`
 * radians. 0.5 where there are no arms (the bulge). `c`, `s` = cosine and sine of the angle round the galaxy.
 */
export function armBrightness(fns: SkyFunctions, r: number, c: number, s: number, shift: number): number {
  const amp = armAmplitudeAt(r);
  if (amp < 1e-4) return 0.5;
  let cc = c;
  let ss = s;
  if (shift !== 0) {
    const ck = Math.cos(shift);
    const sk = Math.sin(shift);
    cc = c * ck + s * sk; // the pattern at the angle (phi - shift)
    ss = s * ck - c * sk;
  }
  const cosTheta = Math.max(-1, Math.min(1, (fns.armFactor(r, cc, ss) - 1) / amp)); // +1 on the crest of an arm, -1 between
  return Math.exp(ARM_SHARP * (cosTheta - 1));
}

/**
 * The galaxy field of the real universe. `old` follows the universe's density (so the band's thickness, the bulge, the arms and the
 * rim are the universe's), times a lumpy factor so the glow is cloudy and not a smooth haze. `young` (blue light) comes from the arms.
 * Beyond the universe's hard edge (no systems past 50,000 ly) the light fades out smoothly instead of stopping, so seen from the rim
 * there is a soft glow spilling past the edge (Andy's request in G2).
 */
export function universeField(fns: SkyFunctions): GalaxyField {
  const edge = GALAXY_RADIUS_LY;
  return {
    spacingAt(x, _y, z) {
      return fns.spacing(Math.hypot(x, z));
    },
    sample(x: number, y: number, z: number, out: FieldSample): void {
      const r2 = x * x + z * z;
      const r = Math.sqrt(r2);
      let density: number;
      let taper = 1;
      if (r > edge) {
        // Outside the disc the universe says 0. Ask just inside the edge instead and fade by distance, so the glow has a soft edge.
        const k = (edge * 0.9999) / r;
        density = fns.density(x * k, y, z * k);
        taper = edgeTaper(r);
      } else {
        density = fns.density(x, y, z);
      }
      const yd = dustHeight(x, y, z);
      const inDust = !(yd > 5 || yd < -5);
      if (density <= 0 && !inDust) {
        out.old = 0;
        out.young = 0;
        out.dust = 0;
        return;
      }
      const c = r > 0 ? x / r : 1;
      const s = r > 0 ? z / r : 0;
      const clump = 0.2 + 2.2 * valueNoise(x / 550, y / 260, z / 550, 11) ** 2; // star clouds: lumpy on a scale of a few hundred ly
      out.old = density * taper * clump;
      // Young blue stars: a thin layer, only in the arms, much brighter than the average star.
      const fade = smoothstep(UNIVERSE_ARM_FADE_FROM, UNIVERSE_ARM_FADE_TO, r);
      if (density > 0 && fade > 0) {
        const sigma = fns.thickness(r) / 4;
        const yThin = y / (0.4 * sigma);
        if (yThin > 6 || yThin < -6) {
          out.young = 0;
        } else {
          const spacing = fns.spacing(r);
          const nMid = 1 / (spacing * spacing * spacing);
          const arm = armBrightness(fns, r, c, s, 0);
          out.young = 4 * nMid * fade * Math.pow(arm, 1.3) * Math.exp(-0.5 * yThin * yThin) * taper * clump;
        }
      } else {
        out.young = 0;
      }
      out.dust = inDust ? dustInLayer(x, y, z, r, yd, armBrightness(fns, r, c, s, DUST_ANGLE_SHIFT), taper) : 0;
    },
  };
}
