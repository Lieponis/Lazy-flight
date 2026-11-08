// Decides WHICH PHASE of the flight we are in, and how far into it. Pure logic: no Three.js, no clock, no browser.
// The screen asks this every frame. Because the answer depends only on "how much time is left", opening the page
// (or coming back to the tab) in the middle of a flight lands in the right phase on its own.

export type FlightPhase = "LAUNCH" | "WARP" | "APPROACH" | "DONE";

/** How far the trip is. Same shape the game gives (game time in ms). */
export interface FlightProgress {
  fraction: number;
  remainingMs: number;
  totalMs: number;
}

/** Everything the flight screen needs to know about the trip. The game is connected to it by the glue code (src/ui/index.ts). */
export interface FlightInfo {
  originDockId: string;
  destinationDockId: string;
  destinationName: string;
  /** The ship the player flies (an id like "scout"). The render layer draws that ship's design; unknown or missing = the Cargo Hauler. */
  shipId?: string;
  /** Game seconds per real second (the ?speed=NUMBER setting). */
  speed: number;
  /** Returns the current progress, or null if no flight is running any more. */
  getProgress: () => FlightProgress | null;
}

export interface PhaseSettings {
  /** Real seconds the launch takes (on trips long enough). */
  launchSeconds: number;
  /** Real seconds the approach takes (on trips long enough). */
  approachSeconds: number;
  /** The shortest warp we still want to show. If the trip is shorter than all three, everything is squeezed. */
  minWarpSeconds: number;
}

export interface PhaseDurations {
  launch: number;
  warp: number;
  approach: number;
}

/** Splits a trip (real seconds) into launch / warp / approach. Short trips are squeezed in proportion. */
export function phaseDurations(totalSeconds: number, s: PhaseSettings): PhaseDurations {
  const total = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
  const base = s.launchSeconds + s.minWarpSeconds + s.approachSeconds;
  if (base <= 0) return { launch: 0, warp: total, approach: 0 };
  if (total >= base) {
    return { launch: s.launchSeconds, warp: total - s.launchSeconds - s.approachSeconds, approach: s.approachSeconds };
  }
  const k = total / base;
  return { launch: s.launchSeconds * k, warp: s.minWarpSeconds * k, approach: s.approachSeconds * k };
}

export interface FlightPlan {
  phase: FlightPhase;
  /** 0 to 1 inside the current phase. */
  progress: number;
  /** Length of the current phase in real seconds. */
  phaseSeconds: number;
  /** Real seconds since take-off. */
  elapsedSeconds: number;
  /** Real seconds the whole trip takes. */
  totalSeconds: number;
}

function inside(elapsed: number, length: number): number {
  return length > 0 ? Math.min(1, Math.max(0, elapsed / length)) : 1;
}

/** Input: the progress fraction, and the REAL time left and in total (game time divided by the speed). */
export function planFlight(fraction: number, remainingRealMs: number, totalRealMs: number, s: PhaseSettings): FlightPlan {
  const total = Math.max(0, Number.isFinite(totalRealMs) ? totalRealMs : 0) / 1000;
  const remaining = Math.min(total, Math.max(0, Number.isFinite(remainingRealMs) ? remainingRealMs : 0) / 1000);
  if (total <= 0 || fraction >= 1 || remaining <= 0) {
    return { phase: "DONE", progress: 1, phaseSeconds: 0, elapsedSeconds: total, totalSeconds: total };
  }
  const elapsed = total - remaining;
  const d = phaseDurations(total, s);
  if (elapsed < d.launch) {
    return { phase: "LAUNCH", progress: inside(elapsed, d.launch), phaseSeconds: d.launch, elapsedSeconds: elapsed, totalSeconds: total };
  }
  if (elapsed < d.launch + d.warp) {
    return { phase: "WARP", progress: inside(elapsed - d.launch, d.warp), phaseSeconds: d.warp, elapsedSeconds: elapsed, totalSeconds: total };
  }
  return {
    phase: "APPROACH",
    progress: inside(elapsed - d.launch - d.warp, d.approach),
    phaseSeconds: d.approach,
    elapsedSeconds: elapsed,
    totalSeconds: total,
  };
}

/** Turns game-time progress into real time, using the clock speed. */
export function realTimes(progress: FlightProgress, speed: number): { remainingRealMs: number; totalRealMs: number } {
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return { remainingRealMs: progress.remainingMs / s, totalRealMs: progress.totalMs / s };
}

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** How white the screen flash is, 0 to 1: a flash going into warp and another coming out of it. */
export function flashAmount(plan: FlightPlan): number {
  if (plan.phase === "LAUNCH") return smooth((plan.progress - 0.8) / 0.2);
  if (plan.phase === "WARP") {
    const sinceStart = plan.progress * plan.phaseSeconds;
    const untilEnd = (1 - plan.progress) * plan.phaseSeconds;
    return Math.max(1 - sinceStart / 0.6, 1 - untilEnd / 0.4, 0);
  }
  if (plan.phase === "APPROACH") return Math.max(0, 1 - (plan.progress * plan.phaseSeconds) / 0.5);
  return 0;
}

/** Which ship-computer line to show. It changes every `secondsPerLine` real seconds. */
export function computerLineIndex(elapsedSeconds: number, lineCount: number, salt: number, secondsPerLine: number): number {
  if (lineCount <= 0) return 0;
  const step = Math.floor(Math.max(0, elapsedSeconds) / Math.max(1, secondsPerLine));
  return (((step + salt) % lineCount) + lineCount) % lineCount;
}

/** 83000 ms -> "1:23", 3 661 000 ms -> "1:01:01". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
