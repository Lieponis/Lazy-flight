// Plain functions with no drawing: the words and numbers the menus show, and which buttons show where.
// Kept here so they can be tested without a browser (tests/ui.test.ts).

import {
  RANK_JOBS_NEEDED,
  RANK_KIND_LABELS,
  RANK_NAMES,
  formatDuration,
  isRankKind,
  requiredRankIndex,
  type BlockCode,
  type BoardEntry,
  type ExtraBlockCode,
  type OutpostOffer,
  type OwnedOutpost,
  type RankInfo,
  type RankUp,
  type RefuelResult,
  type ShipCatalogEntry,
  type UpgradeOffer,
} from "../game";
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

const SHORT_REASONS: Record<BlockCode | ExtraBlockCode, string> = {
  "rank-too-low": "Rank too low",
  busy: "Already on a job",
  "wrong-dock": "Not at this dock",
  "no-cabin": "Needs a passenger cabin",
  "cabin-too-small": "Cabin too small",
  "cargo-too-large": "Cargo too large",
  "tank-too-small": "Too far for this tank",
  "not-enough-fuel": "Not enough fuel",
};

/** A short plain reason for a blocked job, e.g. "Needs a passenger cabin". */
export function blockedReason(code: BlockCode | ExtraBlockCode | string): string {
  return SHORT_REASONS[code as BlockCode] ?? "Not available";
}

/** The rank a job needs, as "Need rank: Crate Wrangler", or "" if it needs none. */
export function neededRankText(job: { kind: string; reward: number }): string {
  if (!isRankKind(job.kind)) return "";
  const index = requiredRankIndex(job as Parameters<typeof requiredRankIndex>[0]);
  return `Need rank: ${RANK_NAMES[job.kind][index]}`;
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
  /** "+10%" when the job ends in a system where you own an outpost, otherwise "". */
  outpostBonus: string;
}

export interface PlaceNames {
  dockName: (dockId: string) => string;
  systemNameOfDock: (dockId: string) => string;
}

/**
 * outpostBonusPercent: the outpost pay bonus at the job's destination (0 = none), from game.getPerks(destination).
 * Note: rank-too-low is checked on the plain reward (entry.baseReward), the same as the game does.
 */
export function jobCardText(entry: BoardEntry, names: PlaceNames, speed: number, outpostBonusPercent = 0): JobCardText {
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
    reason: !block ? "" : block.code === "rank-too-low" ? neededRankText({ kind: job.kind, reward: entry.baseReward }) : blockedReason(block.code),
    reasonDetail: block ? block.text : "",
    outpostBonus: outpostBonusPercent > 0 ? `+${outpostBonusPercent}%` : "",
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
export function refuelButton(preview: RefuelResult, discountPercent = 0): RefuelButton {
  const off = discountPercent > 0 ? ` (-${discountPercent}%)` : "";
  if (preview.ok) return { text: `REFUEL +${preview.units} · ${formatCredits(preview.cost)}${off}`, disabled: false, hint: "" };
  const full = /full/i.test(preview.reason);
  return { text: full ? "TANK FULL" : "REFUEL", disabled: true, hint: preview.reason };
}

// ------------------------------------------------------------ which controls show where

export type ScreenName = "docked" | "starmap" | "system" | "flight";
export type Overlay = "none" | "jobs" | "shipyard" | "menu" | "ranks" | "arrival";

export interface Controls {
  statusStrip: boolean;
  /** JOBS, SHIPYARD and MAP */
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

// ------------------------------------------------------------ shipyard

/** What the button area of a ship card shows. */
export type ShipAction = "active" | "switch" | "buy" | "blocked";

export interface ShipCardText {
  id: string;
  name: string;
  description: string;
  /** "CARGO 30 · CABIN 0 · TANK 60" */
  stats: { cargo: string; cabin: string; tank: string };
  /** "1,500 CR", or "OWNED" when you have it. */
  price: string;
  /** "FUEL 40/60" for ships you own, otherwise "". */
  fuel: string;
  action: ShipAction;
  /** Short plain reason when it cannot be bought or switched to, otherwise "". */
  reason: string;
  /** True for ships you own: they get an UPGRADES button (5d). */
  upgradable: boolean;
  /** "3/20" upgrade levels bought on this ship, or "" if you do not own it. */
  upgradeLevels: string;
}

/** Turns the game's shipyard reason into short plain words. */
export function shortShipReason(reason: string, price: number, credits: number): string {
  if (!reason) return "";
  if (/^Costs \d+ credits/.test(reason)) return `Need ${formatCredits(Math.max(0, price - credits))} more`;
  if (/during a flight/i.test(reason)) return "Not during a flight";
  if (/already own/i.test(reason)) return "Owned";
  return reason;
}

export function shipCardText(entry: ShipCatalogEntry, credits: number): ShipCardText {
  const { ship } = entry;
  let action: ShipAction = "blocked";
  if (entry.active) action = "active";
  else if (entry.canSwitch) action = "switch";
  else if (entry.canBuy) action = "buy";
  let reason = "";
  if (action === "blocked") reason = entry.owned ? "Not during a flight" : shortShipReason(entry.reason, ship.price, credits);
  return {
    id: ship.id,
    name: ship.name,
    description: ship.description,
    // The REAL numbers of this ship with its upgrades (5d), not the shipyard's base numbers.
    stats: {
      cargo: String(entry.stats.cargoCapacity),
      cabin: entry.stats.cabinCapacity > 0 ? String(entry.stats.cabinCapacity) : "NONE",
      tank: String(entry.stats.fuelTankSize),
    },
    price: entry.owned ? "OWNED" : formatCredits(ship.price),
    fuel: entry.owned && entry.fuel !== null ? `FUEL ${formatFuel(entry.fuel, entry.stats.fuelTankSize)}` : "",
    action,
    reason,
    upgradable: entry.owned,
    upgradeLevels: entry.owned ? upgradeSummary(entry.upgrades, 5, entry.stats.cabinCapacity) : "",
  };
}

/** The emergency button shows only when the game says you are stuck, and never during a flight. */
export function emergencyVisible(stuck: boolean, onJob: boolean): boolean {
  return stuck && !onJob;
}

// ------------------------------------------------------------ ranks (5c)

export interface RankRowText {
  /** "CARGO" */
  label: string;
  /** "Crate Wrangler" */
  rankName: string;
  /** "RANK 2/3" */
  rankNumber: string;
  /** 0 to 1: how far to the next rank (1 at the top). */
  progress: number;
  /** "3 more jobs to Freight Baron", or "TOP RANK". */
  next: string;
  /** "+5% PAY", or "NO BONUS YET". */
  bonus: string;
  /** "JOBS UP TO 1,500 CR", or "ANY JOB". */
  limit: string;
  /** "7 delivered" */
  done: string;
}

export function rankRowText(r: RankInfo): RankRowText {
  const [second, third] = RANK_JOBS_NEEDED[r.kind];
  const from = r.rankIndex === 0 ? 0 : r.rankIndex === 1 ? second : third;
  const to = r.rankIndex === 0 ? second : r.rankIndex === 1 ? third : third;
  const progress = r.jobsToNext === null || to <= from ? 1 : Math.min(1, Math.max(0, (r.jobsDone - from) / (to - from)));
  const n = r.jobsToNext ?? 0;
  return {
    label: r.label.toUpperCase(),
    rankName: r.rankName,
    rankNumber: `RANK ${r.rankNumber}/3`,
    progress,
    next: r.nextRankName === null ? "TOP RANK" : `${n} more ${n === 1 ? "job" : "jobs"} to ${r.nextRankName}`,
    bonus: r.rewardBonusPercent > 0 ? `+${r.rewardBonusPercent}% PAY` : "NO BONUS YET",
    limit: r.maxReward === null ? "ANY JOB" : `JOBS UP TO ${formatCredits(r.maxReward)}`,
    done: `${r.jobsDone} delivered`,
  };
}

/** The extra line on the Delivered card after a rank-up: "RANK UP: Crate Wrangler (cargo)". */
export function rankUpLine(rankUp: RankUp | null): string {
  if (!rankUp) return "";
  return `RANK UP: ${rankUp.rankName} (${RANK_KIND_LABELS[rankUp.kind]})`;
}

// ------------------------------------------------------------ outposts (5c)

/** "FUEL -20% · PAY +10% for jobs ending in Kopipex" */
export function perksText(perks: { fuelDiscountPercent: number; deliveryBonusPercent: number }, systemName: string): string {
  return `FUEL -${perks.fuelDiscountPercent}% · PAY +${perks.deliveryBonusPercent}% on jobs ending in ${systemName}`;
}

export interface OutpostPanelText {
  /** False at stations (nothing to sell): the panel is hidden. */
  show: boolean;
  owned: boolean;
  /** "OUTPOST FOR SALE" or "YOUR OUTPOST" */
  title: string;
  /** "12,400 CR" or "" when owned. */
  price: string;
  perks: string;
  canBuy: boolean;
  /** Short reason when it cannot be bought, otherwise "". */
  reason: string;
}

/** Turns the game's outpost reason into short plain words. */
export function shortOutpostReason(reason: string, price: number | null, credits: number): string {
  if (!reason) return "";
  if (/^Costs \d+ credits/.test(reason)) return `Need ${formatCredits(Math.max(0, (price ?? 0) - credits))} more`;
  if (/during a flight/i.test(reason)) return "Not during a flight";
  if (/already own/i.test(reason)) return "You own it";
  if (/where you are docked/i.test(reason)) return "Dock here to buy it";
  if (/not for sale/i.test(reason)) return "Stations are not for sale";
  return reason;
}

export function outpostPanelText(offer: OutpostOffer, credits: number): OutpostPanelText {
  const perks = perksText(offer.perks, offer.systemName);
  if (!offer.isOutpost) return { show: false, owned: false, title: "", price: "", perks, canBuy: false, reason: "" };
  if (offer.owned) return { show: true, owned: true, title: "YOUR OUTPOST", price: "", perks, canBuy: false, reason: "" };
  return {
    show: true,
    owned: false,
    title: "OUTPOST FOR SALE",
    price: offer.price === null ? "" : formatCredits(offer.price),
    perks,
    canBuy: offer.canBuy,
    reason: offer.canBuy ? "" : shortOutpostReason(offer.reason, offer.price, credits),
  };
}

/** "Rusty Pad · Kopipex" for the list of owned outposts. */
export function ownedOutpostLine(o: OwnedOutpost): string {
  return placeLabel(o.dockName, o.systemName);
}

// ------------------------------------------------------------ ship upgrades (5d)

/**
 * Which upgrade tracks make sense for a ship. Passenger Comfort only helps a ship with a cabin
 * (Andy, 5d: the Cargo Hauler has no seats, so it does not get the comfort upgrade).
 */
export function upgradeTracksFor(cabinCapacity: number): ("tank" | "hold" | "engines" | "comfort")[] {
  return cabinCapacity > 0 ? ["tank", "hold", "engines", "comfort"] : ["tank", "hold", "engines"];
}

/** "3/15" or "3/20": levels bought out of the tracks this ship can use. */
export function upgradeSummary(levels: { tank: number; hold: number; engines: number; comfort: number }, maxLevel = 5, cabinCapacity = 1): string {
  const tracks = upgradeTracksFor(cabinCapacity);
  const done = tracks.reduce((sum, t) => sum + levels[t], 0);
  return `${done}/${maxLevel * tracks.length}`;
}

/** Turns the game's upgrade reason into short plain words. */
export function shortUpgradeReason(reason: string, price: number | null, credits: number): string {
  if (!reason) return "";
  if (/^Costs \d+ credits/.test(reason)) return `Need ${formatCredits(Math.max(0, (price ?? 0) - credits))} more`;
  if (/during a flight/i.test(reason)) return "Not during a flight";
  if (/highest level/i.test(reason)) return "Max level";
  if (/do not own/i.test(reason)) return "Buy the ship first";
  return reason;
}

export interface UpgradeRowText {
  track: string;
  /** "FUEL TANK" */
  name: string;
  /** "LEVEL 1/5" */
  level: string;
  /** 0 to 1 for the little bar. */
  progress: number;
  /** "Next: Tank 66 -> 72 fuel", or what it gives now at the top. */
  effect: string;
  /** "BUY LEVEL 2 · 4,000 CR", or "MAX". */
  button: string;
  canBuy: boolean;
  maxed: boolean;
  /** Short reason when it cannot be bought (not shown for MAX), otherwise "". */
  reason: string;
}

export function upgradeRowText(o: UpgradeOffer, credits: number): UpgradeRowText {
  const maxed = o.nextPrice === null || o.level >= o.maxLevel;
  const reason = maxed || o.canBuy ? "" : shortUpgradeReason(o.reason, o.nextPrice, credits);
  return {
    track: o.track,
    name: o.name.toUpperCase(),
    level: `LEVEL ${o.level}/${o.maxLevel}`,
    progress: o.maxLevel > 0 ? Math.min(1, Math.max(0, o.level / o.maxLevel)) : 0,
    effect: maxed ? o.effect : `Next: ${o.effect}`,
    button: maxed ? "MAX" : `BUY LEVEL ${o.level + 1} · ${formatCredits(o.nextPrice ?? 0)}`,
    canBuy: !maxed && o.canBuy,
    maxed,
    reason,
  };
}
