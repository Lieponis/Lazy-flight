// The game clock. Time is a plain number: milliseconds ("game time").
// Everything saved (travel start and end) uses this number, never a running countdown.
// So if the tab sleeps, the answer is still right when it wakes up.

import { MAX_SPEED } from "./settings";

/** Reads ?speed=NUMBER from a web address part like "?speed=60". Anything else gives 1. */
export function parseSpeedParam(search: string): number {
  const match = /[?&]speed=(\d+(?:\.\d+)?)(?:&|$)/.exec(search);
  if (!match || match[1] === undefined) return 1;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(value, MAX_SPEED);
}

/**
 * The speed the game starts with (stage P3, tester speed switch). ?speed= in the address wins when present;
 * otherwise the stored tester choice (the text kept under "lazy-freight.testspeed", read by the caller); otherwise 1.
 * Junk is ignored the same way as in parseSpeedParam.
 */
export function startSpeed(search: string, storedTestSpeed: string | null): number {
  if (/[?&]speed=/.test(search)) return parseSpeedParam(search);
  if (storedTestSpeed === null || !/^\d+(?:\.\d+)?$/.test(storedTestSpeed.trim())) return 1;
  return parseSpeedParam(`?speed=${storedTestSpeed.trim()}`);
}

export interface GameClock {
  /** Game time now, in milliseconds. */
  now(): number;
  speed: number;
}

/**
 * Game time starts at the real time of loading and then runs `speed` times faster than real time.
 * `realNow` can be replaced in tests.
 */
export function createClock(speed: number, realNow: () => number = Date.now): GameClock {
  const origin = realNow();
  return {
    speed,
    now: () => origin + (realNow() - origin) * speed,
  };
}

/** Time slot = one whole game hour. This is what the job board needs. */
export function slotOf(nowMs: number): number {
  return Math.floor(nowMs / 3_600_000);
}
