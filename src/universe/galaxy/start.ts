// The start region: one third of the way from the centre to the rim, on the inner edge of a spiral arm.
// In the very middle of an arm the spacing would be 6.7 ly; on the edge of the arm the density is exactly the average
// of the disc there, so the local spacing is the plain curve value, about 8 ly (the brief asked for 8 to 9 ly).

import { lnDet, sincosDet, SC, TWO_PI } from "./detmath";
import { ARM_COUNT, ARM_PITCH_TAN, ARM_R0, START_RADIUS } from "./params";
import type { Vec3 } from "./density";

/** Angle (radians) where the arm centre is at this radius (the arm factor is largest there). */
function armCentreAngle(r: number): number {
  const phase = lnDet(r / ARM_R0) / ARM_PITCH_TAN; // angle of the arm centre
  return phase - TWO_PI * Math.floor(phase / TWO_PI);
}

/** A quarter of the way from the arm centre to the next arm centre = the edge of the arm, where the arm factor is 1. */
const angle = armCentreAngle(START_RADIUS) + Math.PI / (2 * ARM_COUNT);
sincosDet(angle);

/** The point in space where the player starts looking for the first system: 16,667 ly from the centre, on the edge of an arm. */
export const START_POINT: Vec3 = { x: START_RADIUS * SC.cos, y: 0, z: START_RADIUS * SC.sin };
export const START_ANGLE = angle;
