// WHAT GOES ON THE THREE COCKPIT SCREENS (pure logic: numbers and words only, no Three.js, no drawing, so it can be tested).
//   INFO (straight ahead): where to, how long, which phase.
//   MAP  (middle): a simple route with the ship moving along it.
//   FUEL (amber, pilot's wing): the tank, draining as the trip burns fuel.
// The drawing itself is in cockpitscreens.ts.

import { formatCountdown, type FlightPhase, type FlightPlan } from "./flightplan";

/** Pixel width of every screen's picture (about the size a screen has on the game's small picture). */
export const SCREEN_PIXEL_WIDTH = 96;

/** Picture height for a screen of `w` x `h` crates, so the picture is never stretched. Kept between 32 and 160 pixels. */
export function canvasHeightFor(widthPixels: number, w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) return Math.round(widthPixels);
  return Math.min(160, Math.max(32, Math.round((widthPixels * h) / w)));
}

export const PHASE_LABELS: Record<FlightPhase, string> = {
  LAUNCH: "LAUNCH",
  WARP: "WARP",
  APPROACH: "APPROACH",
  DONE: "ARRIVED",
};

/** Capital letters, and cut with a dot if longer than `maxChars`. */
export function shortText(text: string, maxChars: number): string {
  const t = text.trim().toUpperCase();
  return t.length <= maxChars ? t : `${t.slice(0, Math.max(1, maxChars - 1))}.`;
}

/** Splits a name into at most two lines of at most `maxChars` letters, breaking at spaces where it can. */
export function twoLines(text: string, maxChars: number): [string, string] {
  const t = text.trim().toUpperCase();
  if (t.length <= maxChars) return [t, ""];
  const cut = t.lastIndexOf(" ", maxChars);
  if (cut > 0) return [t.slice(0, cut), shortText(t.slice(cut + 1), maxChars)];
  return [t.slice(0, maxChars), shortText(t.slice(maxChars), maxChars)];
}

export interface InfoScreenData {
  destination: string;
  countdown: string;
  phase: string;
}

export function infoScreenData(destinationName: string, plan: FlightPlan): InfoScreenData {
  const remainingMs = plan.phase === "DONE" ? 0 : Math.max(0, plan.totalSeconds - plan.elapsedSeconds) * 1000;
  return {
    destination: destinationName.trim() || "UNKNOWN",
    countdown: formatCountdown(remainingMs),
    phase: PHASE_LABELS[plan.phase],
  };
}

export interface Point {
  x: number;
  y: number;
}
export interface MapScreenData {
  origin: Point;
  destination: Point;
  ship: Point;
  stars: Point[];
}

/** Where the route's ends sit on the map (0..1 across and down). Fixed, so the map always looks the same. */
export const MAP_ORIGIN: Point = { x: 0.16, y: 0.74 };
export const MAP_DESTINATION: Point = { x: 0.84, y: 0.3 };

/** Small repeatable random numbers (0..1) from a seed, so the stars of one trip never move. */
function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export function mapScreenData(tripFraction: number, starSeed: number, starCount = 16): MapScreenData {
  const f = Number.isFinite(tripFraction) ? Math.min(1, Math.max(0, tripFraction)) : 0;
  const rnd = seeded(starSeed);
  const stars: Point[] = [];
  for (let i = 0; i < starCount; i++) stars.push({ x: 0.04 + rnd() * 0.92, y: 0.16 + rnd() * 0.8 });
  return {
    origin: MAP_ORIGIN,
    destination: MAP_DESTINATION,
    ship: { x: MAP_ORIGIN.x + (MAP_DESTINATION.x - MAP_ORIGIN.x) * f, y: MAP_ORIGIN.y + (MAP_DESTINATION.y - MAP_ORIGIN.y) * f },
    stars,
  };
}

export interface FuelScreenData {
  /** False when the game did not tell us the fuel: the screen then shows dashes. */
  available: boolean;
  value: number;
  max: number;
  /** 0..1, how full the tank is. */
  fraction: number;
  text: string;
}

/**
 * The fuel in the tank right now. `fuel` is what is left AFTER the trip was paid (the game burns the fuel when the job starts);
 * `fuelUsed` is what this trip burns, so the bar drains from (fuel + fuelUsed) at take-off down to `fuel` at arrival.
 * Without `fuelUsed` the number simply stays at `fuel`.
 */
export function fuelScreenData(info: { fuel?: number; fuelMax?: number; fuelUsed?: number }, tripFraction: number): FuelScreenData {
  const ok = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n);
  if (!ok(info.fuel) || !ok(info.fuelMax) || info.fuelMax <= 0) return { available: false, value: 0, max: 0, fraction: 0, text: "--" };
  const f = Number.isFinite(tripFraction) ? Math.min(1, Math.max(0, tripFraction)) : 0;
  const used = ok(info.fuelUsed) ? Math.max(0, info.fuelUsed) : 0;
  const value = Math.min(info.fuelMax, Math.max(0, info.fuel + used * (1 - f)));
  return { available: true, value, max: info.fuelMax, fraction: value / info.fuelMax, text: `${Math.round(value)}/${Math.round(info.fuelMax)}` };
}
