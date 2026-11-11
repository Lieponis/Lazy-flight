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
  type ExplorerInfo,
  type FreeArrival,
  type FreeTravelCheck,
  type LiveryRow,
  EXPLORER_DISCOVERIES_NEEDED,
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
export function locationText(info: { flying: boolean; dockName: string; systemName: string; floating?: boolean }): string {
  if (info.flying) return `EN ROUTE TO ${placeLabel(info.dockName, info.systemName)}`;
  if (info.floating) return `IN SPACE AT ${placeLabel(info.dockName, info.systemName)}`; // 5f: at a planet without a dock
  return placeLabel(info.dockName, info.systemName);
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
export type Overlay = "none" | "jobs" | "shipyard" | "menu" | "ranks" | "arrival" | "whatnow";

export interface Controls {
  statusStrip: boolean;
  /** JOBS, SHIPYARD and MAP */
  dockButtons: boolean;
  /** System | Galaxy switch and CLOSE */
  mapBar: boolean;
  /** Which map tab is lit, or null. */
  mapTab: "system" | "galaxy" | null;
  /** The WHAT NOW? button while floating at a planet without a dock (5f, Andy chose C). */
  whatNow: boolean;
}

/**
 * floating: the ship is in space at a planet without a dock (the render layer shows it on the "flight" screen,
 * with no trip running). flying: a job or a free trip is under way.
 */
export function visibleControls(screen: ScreenName, overlay: Overlay, flying: boolean, floating = false): Controls {
  const inFlight = flying || screen === "flight";
  const isMap = !flying && (screen === "system" || screen === "starmap");
  return {
    statusStrip: true,
    dockButtons: !inFlight && screen === "docked" && overlay === "none",
    mapBar: isMap,
    mapTab: !isMap ? null : screen === "system" ? "system" : "galaxy",
    whatNow: floating && !flying && screen === "flight" && overlay === "none",
  };
}

/** Which overlay may stay open on this screen (menus belong to the docked view, and some to floating in space). */
export function overlayAllowed(screen: ScreenName, overlay: Overlay, flying: boolean, floating = false): Overlay {
  if (flying) return "none";
  if (floating && screen === "flight") return overlay === "jobs" || overlay === "arrival" ? "none" : overlay; // no dock: no Jobs board
  if (screen !== "docked") return "none";
  return overlay === "whatnow" ? "none" : overlay;
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

// ------------------------------------------------------------ planet panel and wording for fewer docks (5e)

/** What the planet panel on the system map shows (Andy chose layout A: a card with a DOCK or SCENERY tag). */
export interface PlanetPanelText {
  /** "DOCK · OUTPOST", "DOCK · STATION" or "SCENERY" */
  tag: string;
  isDock: boolean;
  /** Big line: the dock's name, or the planet's name for scenery. */
  title: string;
  /** "Zorpex II · Rocky world · 1.2x Earth" */
  details: string;
  /** One relaxed line: what you can do there, or a joke for scenery. */
  line: string;
  /** "YOU ARE HERE" when you are docked there, otherwise "". */
  here: string;
}

export interface PlanetPanelInput {
  planetId: string;
  planetName: string;
  /** Already in words, e.g. "Rocky world". */
  typeLabel: string;
  radius: number;
  /** null for a planet without a dock. */
  dock: { name: string; kind: string } | null;
  /** You are docked here. */
  here: boolean;
  /** For outposts: you own it. */
  owned: boolean;
}

const SCENERY_LINES = [
  "No dock. Great view, terrible parking.",
  "Just scenery. Nobody here to sell tofu to.",
  "No dock here. Wave as you fly past.",
  "Nothing to visit. The locals are mostly rocks.",
  "No dock. Even the postcards are blank.",
  "Scenery only. Lovely to look at, nowhere to land.",
] as const;

/** A funny line for a planet without a dock. Always the same line for the same planet. */
export function sceneryLine(planetId: string): string {
  let h = 0;
  for (let i = 0; i < planetId.length; i++) h = (h * 31 + planetId.charCodeAt(i)) >>> 0;
  return SCENERY_LINES[h % SCENERY_LINES.length]!;
}

export function planetPanelText(p: PlanetPanelInput): PlanetPanelText {
  const details = `${p.planetName} · ${p.typeLabel} · ${p.radius.toFixed(1)}x Earth`;
  if (!p.dock) {
    return { tag: "SCENERY", isDock: false, title: p.planetName, details: `${p.typeLabel} · ${p.radius.toFixed(1)}x Earth`, line: sceneryLine(p.planetId), here: "" };
  }
  const outpost = p.dock.kind === "OUTPOST";
  let line = "Jobs and fuel here.";
  if (outpost && p.owned) line = "Your outpost: cheaper fuel, better pay.";
  else if (outpost) line = "Jobs and fuel here. This outpost is for sale.";
  return {
    tag: outpost ? "DOCK · OUTPOST" : "DOCK · STATION",
    isDock: true,
    title: p.dock.name,
    details,
    line,
    here: p.here ? "YOU ARE HERE" : "",
  };
}

/** The hint on the system map before a planet is tapped. */
export const PLANET_PANEL_HINT = "Tap a planet to see it. Drag to turn, pinch to zoom.";

/**
 * The start-up note. The "universe was rebuilt" message from src/save becomes friendlier and stays longer
 * (Andy chose the fading note, tap to close). Other notes stay as they are.
 */
export function startNotice(notice: string, rebuiltMessage: string): { text: string; ms: number } {
  if (!notice.startsWith(rebuiltMessage)) return { text: notice, ms: 7000 };
  const sold = /sold back for (\d+) credits/.exec(notice);
  const refund = sold ? ` Your outposts were sold back for ${formatCredits(Number(sold[1]))}.` : "";
  return { text: `Universe rebuilt! Your credits and ships came along.${refund}`, ms: 12000 };
}

/** The empty Jobs board: calm, and true in a system with one dock too. */
export const EMPTY_BOARD_TEXT = "No jobs on the board right now. New ones arrive soon - have a coffee.";

// ------------------------------------------------------------ free travel, floating, Explorer, paint jobs (5f)

/** The Fly-here part of the planet card (Andy chose B: the facts on the card, one tap flies). */
export interface FlyHereText {
  canFly: boolean;
  /** "FLY HERE" */
  button: string;
  /** "Fuel 12 · left 38/60 · 4m 00s" */
  facts: string;
  /** "NEW SYSTEM: +75 CR" or "" */
  discovery: string;
  /** The game's own refusal text when you cannot fly ("" when you can). */
  reason: string;
}

export function flyHereText(check: FreeTravelCheck, tank: number, speed: number): FlyHereText {
  if (!check.ok) return { canFly: false, button: "FLY HERE", facts: "", discovery: "", reason: check.reason };
  return {
    canFly: true,
    button: "FLY HERE",
    facts: `Fuel ${check.fuelNeeded} · left ${formatFuel(check.fuelLeft, tank)} · ${formatTripTime(check.seconds, speed)}`,
    discovery: check.newSystem && check.discoveryCredits > 0 ? `NEW SYSTEM: +${formatCredits(check.discoveryCredits)}` : "",
    reason: "",
  };
}

/** The note after a free trip: the game's funny line, discovery pay, and an Explorer rank-up. */
export function freeArrivalNote(a: FreeArrival): string {
  const parts = [a.line];
  if (a.discovery > 0) parts.push(`New system! +${formatCredits(a.discovery)} for discovering it.`);
  else if (a.newPlanet) parts.push("A new planet for your logbook.");
  if (a.explorerRankUp) parts.push(`EXPLORER RANK UP: ${a.explorerRankUp.rankName}!`);
  return parts.join(" ");
}

/** "EXPLORER RANK UP: Cartographer" for the Delivered card (jobs explore too), or "". */
export function explorerRankUpLine(rankUp: { rankName: string } | null): string {
  return rankUp ? `EXPLORER RANK UP: ${rankUp.rankName}` : "";
}

/** The Explorer row on the Ranks screen, in the same shape as the job ranks. */
export function explorerRowText(e: ExplorerInfo): RankRowText {
  const [second, third] = EXPLORER_DISCOVERIES_NEEDED;
  const from = e.rankIndex === 0 ? 0 : e.rankIndex === 1 ? second : third;
  const to = e.rankIndex === 0 ? second : third;
  const progress = e.discoveriesToNext === null || to <= from ? 1 : Math.min(1, Math.max(0, (e.discoveries - from) / (to - from)));
  const n = e.discoveriesToNext ?? 0;
  return {
    label: "EXPLORER",
    rankName: e.rankName,
    rankNumber: `RANK ${e.rankNumber}/3`,
    progress,
    next: e.nextRankName === null ? "TOP RANK" : `${n} more ${n === 1 ? "discovery" : "discoveries"} to ${e.nextRankName}`,
    bonus: e.discoveryBonusPercent > 0 ? `+${e.discoveryBonusPercent}% DISCOVERY PAY` : "NO BONUS YET",
    limit: `${e.systems} ${e.systems === 1 ? "SYSTEM" : "SYSTEMS"} · ${e.planets} ${e.planets === 1 ? "PLANET" : "PLANETS"}`,
    done: `${e.discoveries} discovered`,
  };
}

/** The choices behind WHAT NOW? while floating (Andy chose C). Emergency fuel only when the game says you are stuck. */
export function whatNowChoices(stuck: boolean): { id: "fly" | "shipyard" | "jobs" | "emergency" | "menu" | "stay"; text: string }[] {
  const list: { id: "fly" | "shipyard" | "jobs" | "emergency" | "menu" | "stay"; text: string }[] = [
    { id: "fly", text: "FLY SOMEWHERE" },
    { id: "shipyard", text: "SHIPYARD" },
    { id: "jobs", text: "JOBS & FUEL" },
  ];
  if (stuck) list.push({ id: "emergency", text: "EMERGENCY FUEL" });
  list.push({ id: "menu", text: "MENU & RANKS" }, { id: "stay", text: "STAY & ENJOY" });
  return list;
}

/** A hint on the Jobs menu when nothing on the board can be taken (5f tutorial hint). */
export function noJobsHint(cards: readonly { takeable: boolean }[]): string {
  return cards.some((c) => c.takeable) ? "" : "No jobs for you? Fly somewhere new: MAP, tap a planet, FLY HERE. New star systems pay discovery credits.";
}

/** One paint job row in the Shipyard (Andy chose A: a list inside the ship card). */
export interface PaintRowText {
  id: string;
  name: string;
  description: string;
  /** "worn" (label), "wear" (button), "buy" (button), "blocked" (grey button + reason) */
  action: "worn" | "wear" | "buy" | "blocked";
  /** "BUY · 500 CR", "WEAR", "WORN" */
  button: string;
  /** The game's refusal text when blocked, otherwise "". */
  reason: string;
}

export function paintRowText(row: LiveryRow, names: { name: string; description: string } | undefined): PaintRowText {
  const name = names?.name ?? row.id;
  const description = names?.description ?? "";
  if (row.worn) return { id: row.id, name, description, action: "worn", button: "WORN", reason: "" };
  if (row.owned) {
    return row.canWear
      ? { id: row.id, name, description, action: "wear", button: "WEAR", reason: "" }
      : { id: row.id, name, description, action: "blocked", button: "WEAR", reason: row.reason };
  }
  const button = row.price > 0 ? `BUY · ${formatCredits(row.price)}` : "FREE";
  if (row.canBuy) return { id: row.id, name, description, action: "buy", button, reason: "" };
  return { id: row.id, name, description, action: "blocked", button, reason: row.reason };
}

/** "1/4" paint jobs owned on the PAINT button. */
export function paintSummary(rows: readonly LiveryRow[]): string {
  return `${rows.filter((r) => r.owned).length}/${rows.length}`;
}
