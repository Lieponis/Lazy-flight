// Plain functions with no drawing: the words and numbers the menus show, and which buttons show where.
// Kept here so they can be tested without a browser (tests/ui.test.ts).

import { formatDuration, type BlockCode, type BoardEntry, type RefuelResult } from "../game";
import type { JobKind } from "../universe";

// ------------------------------------------------------------ numbers

/** 1250 -> "1,250 CR". Negative and odd numbers are handled. */
export function formatCredits(credits: number): string {
  const n = Number.isFinite(credits) ? Math.round(credits) : 0;
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${digits} CR`;
}

/** Fuel as "42/60". */
export function formatFuel(fuel: number, tank: number): string {
  return `${Math.max(0, Math.round(fuel))}/${Math.max(0, Math.round(tank))}`;
}

/** How full the tank is, 0 to 1 (for the little bar). */
export function fuelFraction(fuel: number, tank: number): number {
  if (!(tank > 0)) return 0;
  return Math.min(1, Math.max(0, fuel / tank));
}

/** True when the tank is low enough to colour the bar as a warning (a quarter or less). */
export function fuelIsLow(fuel: number, tank: number): boolean {
  return fuelFraction(fuel, tank) <= 0.25;
}

/** 4.234 -> "4.2 LY". Trips inside one system show "IN SYSTEM". */
export function formatDistance(ly: number): string {
  if (!(ly > 0.05)) return "IN SYSTEM";
  return `${ly.toFixed(1)} LY`;
}

/**
 * The trip time the player will actually wait, using the game's own formatting.
 * gameSeconds is the game's trip time; with ?speed=60 the real wait is 60 times shorter.
 */
export function formatTripTime(gameSeconds: number, speed: number): string {
  const s = speed > 0 ? speed : 1;
  return formatDuration(gameSeconds / s);
}

// ------------------------------------------------------------ places

/** "Dock name · System name". */
export function placeLabel(dockName: string, systemName: string): string {
  return `${dockName} · ${systemName}`;
}

/** The location part of the status strip. While flying it shows where you are going. */
export function locationText(info: { flying: boolean; dockName: string; systemName: string }): string {
  return info.flying ? `EN ROUTE TO ${placeLabel(info.dockName, info.systemName)}` : placeLabel(info.dockName, info.systemName);
}

// ------------------------------------------------------------ job cards

const KIND_LABELS: Record<JobKind, string> = {
  TRADE: "CARGO",
  PASSENGER: "PASSENGERS",
  TOUR: "TOUR",
  SCAN: "SCAN",
  RESCUE: "RESCUE",
};

export function kindLabel(kind: JobKind): string {
  return KIND_LABELS[kind] ?? kind;
}

const SHORT_REASONS: Record<BlockCode, string> = {
  busy: "Already on a job",
  "wrong-dock": "Not at this dock",
  "no-cabin": "Needs a passenger cabin",
  "cabin-too-small": "Cabin too small",
  "cargo-too-large": "Cargo too large",
  "tank-too-small": "Fuel tank too small",
  "not-enough-fuel": "Not enough fuel",
};

/** A short plain reason for a blocked job, e.g. "Needs a passenger cabin". */
export function blockedReason(code: BlockCode | string): string {
  return SHORT_REASONS[code as BlockCode] ?? "Not available";
}

/** Everything one job card shows, as ready-made text. */
export interface JobCardText {
  id: string;
  kind: string;
  /** "30 × Frozen Tofu" */
  title: string;
  /** "Dock · System", plus the number of stops for tours. */
  destination: string;
  distance: string;
  reward: string;
  time: string;
  fuel: string;
  blurb: string;
  takeable: boolean;
  /** Short reason ("Not enough fuel") or "" when takeable. */
  reason: string;
  /** The game's full sentence with numbers, or "" when takeable. */
  reasonDetail: string;
}

export interface PlaceNames {
  dockName: (dockId: string) => string;
  systemNameOfDock: (dockId: string) => string;
}

export function jobCardText(entry: BoardEntry, names: PlaceNames, speed: number): JobCardText {
  const { job, block } = entry;
  const dest = placeLabel(names.dockName(job.destinationDockId), names.systemNameOfDock(job.destinationDockId));
  const stops = job.stops.length;
  return {
    id: job.id,
    kind: kindLabel(job.kind),
    title: `${job.amount} × ${job.itemName}`,
    destination: stops > 1 ? `${dest} (${stops} stops)` : dest,
    distance: formatDistance(job.totalDistance),
    reward: `+${formatCredits(job.reward)}`,
    time: formatTripTime(entry.tripSeconds, speed),
    fuel: `${entry.fuelNeeded} FUEL`,
    blurb: job.blurb,
    takeable: block === null,
    reason: block ? blockedReason(block.code) : "",
    reasonDetail: block ? block.text : "",
  };
}

/** Takeable jobs first, keeping the board's own order inside each group. */
export function sortForDisplay<T extends { takeable: boolean }>(cards: readonly T[]): T[] {
  return [...cards.filter((c) => c.takeable), ...cards.filter((c) => !c.takeable)];
}

// ------------------------------------------------------------ refuel button

export interface RefuelButton {
  text: string;
  disabled: boolean;
  /** Why it is disabled, or "" */
  hint: string;
}

/** What the Refuel button says, from a preview of the game's refuel rule. */
export function refuelButton(preview: RefuelResult): RefuelButton {
  if (preview.ok) return { text: `REFUEL +${preview.units} · ${formatCredits(preview.cost)}`, disabled: false, hint: "" };
  const full = /full/i.test(preview.reason);
  return { text: full ? "TANK FULL" : "REFUEL", disabled: true, hint: preview.reason };
}

// ------------------------------------------------------------ which controls show where

export type ScreenName = "docked" | "starmap" | "system" | "flight";
export type Overlay = "none" | "jobs" | "arrival";

export interface Controls {
  statusStrip: boolean;
  /** JOBS and MAP */
  dockButtons: boolean;
  /** System | Galaxy switch and CLOSE */
  mapBar: boolean;
  /** Which map tab is lit, or null. */
  mapTab: "system" | "galaxy" | null;
}

export function visibleControls(screen: ScreenName, overlay: Overlay, flying: boolean): Controls {
  const inFlight = flying || screen === "flight";
  const isMap = !inFlight && (screen === "system" || screen === "starmap");
  return {
    statusStrip: true,
    dockButtons: !inFlight && screen === "docked" && overlay === "none",
    mapBar: isMap,
    mapTab: !isMap ? null : screen === "system" ? "system" : "galaxy",
  };
}

/** Which overlay may stay open on this screen (menus belong to the docked view only). */
export function overlayAllowed(screen: ScreenName, overlay: Overlay, flying: boolean): Overlay {
  if (flying || screen !== "docked") return "none";
  return overlay;
}
