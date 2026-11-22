// The planet under a station turns slowly (stage 3o, fix 2). Pure numbers only: no graphics here, so the tests can run anywhere.
//
// The picture: the planet's turning axis points at the sun. The light on the planet is baked into its colours when the ball is made, so
// a turn about the sun's own direction never moves the light (day and night stay where they are), and only the ground and the clouds
// slide past. The point straight below the station is then 60 degrees from the pole: ordinary mid latitude, not the ice cap.

import { hashString } from "./planetlook";
import { DOCKED_STATION_ORBIT_SECONDS, STATION_ORBIT_CLOUD_EXTRA } from "./settings";

export interface Dir3 {
  x: number;
  y: number;
  z: number;
}

/** Where the sun is, seen from the station planet (a direction of length 1). Same light as before the planet turned. */
export const STATION_SUN: Dir3 = (() => {
  const x = 0.45;
  const y = 0.5;
  const z = 0.75;
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
})();

/** Seconds for one full turn of the planet: A slow, B middle, C fast (Andy picks one with ?orbit=A, B or C). */
export const ORBIT_TURN_SECONDS = { A: 300, B: 150, C: 60 } as const;

/**
 * ?orbit=A|B|C|off from the web address: seconds for one turn (0 = the planet stands still), or null when the word is not there
 * (then the game's own setting is used).
 */
export function parseOrbit(search: string): number | null {
  const m = /[?&]orbit=([a-z]+)/i.exec(search);
  const v = m?.[1]?.toLowerCase();
  if (v === "off") return 0;
  if (v === "a") return ORBIT_TURN_SECONDS.A;
  if (v === "b") return ORBIT_TURN_SECONDS.B;
  if (v === "c") return ORBIT_TURN_SECONDS.C;
  return null;
}

/** The turn time to use: the web-address word if there is one, otherwise the game's setting. */
export function orbitSecondsFor(search: string): number {
  return parseOrbit(search) ?? DOCKED_STATION_ORBIT_SECONDS;
}

/** ?stationdemo=1 from the web address: show a station bay in the docked view (a look-only testing aid; anything but 0 or false turns it on). */
export function parseStationDemo(search: string): boolean {
  const m = /[?&]stationdemo=([^&]*)/i.exec(search);
  if (!m) return false;
  const v = (m[1] ?? "").toLowerCase();
  return v !== "0" && v !== "false";
}

/** Where on its turn the planet starts, in radians: the same planet always starts at the same place, other planets elsewhere. */
export function spinPhase(planetId: string): number {
  return ((hashString(`spin:${planetId}`) % 3600) / 3600) * Math.PI * 2;
}

/**
 * How far the ground and the clouds have turned after `seconds` (radians). `turnSeconds` of 0 or less means the planet stands still.
 * The clouds get a little extra, so they drift slightly faster than the ground.
 */
export function spinAngles(seconds: number, turnSeconds: number, phase: number): { ground: number; clouds: number } {
  if (!(turnSeconds > 0) || !(seconds > 0)) return { ground: phase, clouds: 0 };
  const turned = ((seconds / turnSeconds) % 1) * Math.PI * 2;
  return { ground: phase + turned, clouds: turned * STATION_ORBIT_CLOUD_EXTRA };
}

// ------------------------------------------------------------------ what the camera can see (used by the tests)

/** Angle in degrees between the point straight below the station and the planet's pole (the pole sits at the sun). */
export function nadirFromPoleDeg(sun: Dir3 = STATION_SUN): number {
  return (Math.acos(Math.max(-1, Math.min(1, sun.y))) * 180) / Math.PI;
}

/** How far from the pole an ice cap reaches (degrees), for a cap that starts at this sine of latitude (0.75 to 0.9). */
export function capRadiusDeg(caps: number): number {
  return (Math.acos(Math.max(-1, Math.min(1, caps))) * 180) / Math.PI;
}

/** How far (degrees along the ground) the ground reaches that a viewer `height` above a ball of `radius` can see at most. */
export function horizonDeg(radius: number, height: number): number {
  return (Math.acos(radius / (radius + Math.max(0, height))) * 180) / Math.PI;
}
