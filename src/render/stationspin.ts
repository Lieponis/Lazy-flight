// The station goes round its planet (stage 3o, fix 2). Pure numbers only: no graphics here, so the tests can run anywhere.
//
// The picture. Seen from the station, the station stands still and the whole outside turns round it: the planet, the sun's light on it,
// the stars and the faint galaxy sky all turn together about one line, the one running sideways through the planet's centre (the station
// travels along the slot's direction, round the planet). So the ground flows along the slot, not sideways, and the sky and the day and night
// change as the station goes round, which is what a station really sees.
//
// Names: the "world frame" is the frame of that turning outside. At the start of the visit it is lined up with the station's own picture
// (x = sideways, y = up, z = back out of the slot). The station's path is the circle in the world frame's y-z plane.

import { hashString } from "./planetlook";
import {
  DOCKED_STATION_ORBIT_SECONDS,
  STATION_ORBIT_INCLINATION_DEG,
  STATION_START_SPREAD_DEG,
  STATION_SUN_ABOVE_ORBIT_DEG,
} from "./settings";

export interface Dir3 {
  x: number;
  y: number;
  z: number;
}

const RAD = Math.PI / 180;

/** The planet's pole (world frame): tilted from the station's turning line by the orbit's inclination, so the path leans to the equator by that much. */
export const STATION_POLE: Dir3 = { x: Math.cos(STATION_ORBIT_INCLINATION_DEG * RAD), y: Math.sin(STATION_ORBIT_INCLINATION_DEG * RAD), z: 0 };

/** Where the sun is (world frame): above the station's path by a fixed angle, and straight overhead at the nadir when the turn is 0. */
export const STATION_SUN: Dir3 = { x: Math.sin(STATION_SUN_ABOVE_ORBIT_DEG * RAD), y: Math.cos(STATION_SUN_ABOVE_ORBIT_DEG * RAD), z: 0 };

/** Seconds for one full trip round the planet: A slow, B middle, C fast (Andy picks one with ?orbit=A, B or C). */
export const ORBIT_TURN_SECONDS = { A: 300, B: 150, C: 60 } as const;

/**
 * ?orbit=A|B|C|off from the web address: seconds for one trip round, (0 = standing still), or null when the word is not there
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

/** The trip time to use: the web-address word if there is one, otherwise the game's setting. */
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

/** Where on the path the station starts, in radians (0 = the sun straight overhead): near noon, a little different for every planet, always the same for one planet. */
export function startAngle(planetId: string): number {
  const f = (hashString(`orbit:${planetId}`) % 3600) / 3600; // 0..1
  return (f * 2 - 1) * STATION_START_SPREAD_DEG * RAD;
}

/** Which way the planet's ground faces at the start (a turn about its pole, radians): the same planet always the same, other planets elsewhere. */
export function poleYaw(planetId: string): number {
  return ((hashString(`yaw:${planetId}`) % 3600) / 3600) * Math.PI * 2;
}

/**
 * How far the outside has turned about the sideways line. `elapsed` = the turn since the visit began (the sky and the stars turn by this),
 * `angle` = start plus elapsed (the planet and its light turn by this). `turnSeconds` of 0 or less = standing still.
 */
export function orbitAngles(seconds: number, turnSeconds: number, start: number): { elapsed: number; angle: number } {
  if (!(turnSeconds > 0) || !(seconds > 0)) return { elapsed: 0, angle: start };
  const elapsed = ((seconds / turnSeconds) % 1) * Math.PI * 2;
  return { elapsed, angle: start + elapsed };
}

// ------------------------------------------------------------------ what the camera can see (used by the tests)

/** The direction straight "up" from the station, written in the world frame, when the outside has turned by `angle` radians. */
export function upInWorld(angle: number): Dir3 {
  return { x: 0, y: Math.cos(angle), z: -Math.sin(angle) };
}

const dot = (a: Dir3, b: Dir3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** Latitude (degrees) of the ground straight below the station: 0 is the equator, 90 the pole. */
export function groundLatitudeDeg(angle: number): number {
  return (Math.asin(Math.max(-1, Math.min(1, dot(upInWorld(angle), STATION_POLE)))) * 180) / Math.PI;
}

/** How high the sun stands over the ground straight below (1 = overhead, 0 = on the horizon, below 0 = night). */
export function sunOverNadir(angle: number): number {
  return dot(upInWorld(angle), STATION_SUN);
}

/** Latitude (degrees) where an ice cap starts, for a planet whose caps start at this sine of latitude (0.75 to 0.9). */
export function capStartDeg(caps: number): number {
  return (Math.asin(Math.max(-1, Math.min(1, caps))) * 180) / Math.PI;
}

/** How far (degrees along the ground) a viewer `height` above a ball of `radius` can see at most. */
export function horizonDeg(radius: number, height: number): number {
  return (Math.acos(radius / (radius + Math.max(0, height))) * 180) / Math.PI;
}
