// LAYER 5: jobs. For one dock and one time slot, make a job board of about 6 offers.
// Uses all earlier layers. Accepting and completing jobs is NOT here (that is Agent 4's work).

import { GOODS, getGood } from "./data/goods";
import { type Dock } from "./dock";
import { getPrice } from "./economy";
import { findDockById, nearestDocks } from "./lookup";
import { generateBlurb, generatePassengerGroup } from "./names";
import { rngFor, type Seed } from "./random";
import {
  JOBS_PER_BOARD,
  JOB_BOARD_REFRESH_SLOTS,
  JOB_DESTINATION_COUNT,
  JOB_LIMIT_HOURS_PER_10_LY,
  TOUR_MAX_STOPS,
  TOUR_MIN_STOPS,
} from "./settings";
import { distance, getSite, type Vec3 } from "./sites";

export type LoadType = "GOODS" | "PASSENGERS";
export type HoldType = "CARGO_BAY" | "PASSENGER_CABIN";

/**
 * TRADE, PASSENGER and TOUR are built now.
 * SCAN and RESCUE are reserved for the later phase: they are never generated yet.
 */
export type JobKind = "TRADE" | "PASSENGER" | "TOUR" | "SCAN" | "RESCUE";

/** Reserved place for the later scanning and rescue jobs. Always null for now. */
export interface SpecialJobData {
  phase: 3;
  kind: "SCAN" | "RESCUE";
  [extra: string]: unknown;
}

export interface Job {
  /** Unique, e.g. "28113904412/2#4#1" (origin dock id, board period, offer number). */
  id: string;
  kind: JobKind;
  loadType: LoadType;
  /** Good id for GOODS jobs, passenger group text for PASSENGERS jobs. */
  item: string;
  /** Nice name to show: the good's name or the passenger group text. */
  itemName: string;
  /** Units of goods, or number of passengers. */
  amount: number;
  requiredHold: HoldType;
  originDockId: string;
  /** Where the job ends (the last stop). */
  destinationDockId: string;
  /** Every stop in order. One entry for normal jobs, 2 to 3 for a TOUR. The last one is the destination. */
  stops: string[];
  /** Light years flown in total: origin to first stop, then stop to stop. */
  totalDistance: number;
  /** Hours (time slots) allowed after accepting, or null for no limit. */
  timeLimitSlots: number | null;
  /** Credits paid on completion. */
  reward: number;
  blurb: string;
  /** GOODS jobs only: price per unit at the destination in this time slot (used for the reward). */
  unitPriceAtDestination: number | null;
  /** Reserved for scanning and rescue jobs (later phase). */
  special: SpecialJobData | null;
}

interface Candidate {
  dockId: string;
  position: Vec3;
  /** Light years from the origin dock's system (0 = same system). */
  distance: number;
}

const candidateCache = new Map<string, Candidate[]>();

/**
 * The possible destinations of a dock: its JOB_DESTINATION_COUNT nearest OTHER docks (by count, not by a distance
 * limit), nearest first. Docks in the same system come first (distance 0). Near the rim these can be far away;
 * the list is never empty because the galaxy always has more docks than that.
 */
function findCandidates(seed: Seed, origin: Dock): Candidate[] {
  const key = `${seed}|${origin.id}`;
  const known = candidateCache.get(key);
  if (known) return known;
  const originSite = getSite(seed, origin.systemId);
  if (!originSite) return [];
  // The origin dock itself is always among the nearest (distance 0), so ask for one more and leave it out.
  const near = nearestDocks(seed, originSite.position, JOB_DESTINATION_COUNT + 1);
  const result: Candidate[] = [];
  for (const d of near) {
    if (d.dockId === origin.id) continue;
    if (result.length >= JOB_DESTINATION_COUNT) break;
    result.push({ dockId: d.dockId, position: d.position, distance: d.distance });
  }
  if (candidateCache.size > 500) candidateCache.clear();
  candidateCache.set(key, result);
  return result;
}

function fill(n: number): number {
  return Math.max(0, Math.round(n));
}

/** Time slot -> which board period it belongs to. */
export function boardPeriodOf(slot: number): number {
  return Math.floor(Math.floor(slot) / JOB_BOARD_REFRESH_SLOTS);
}

/**
 * The job board of a dock in a time slot. Same seed + dock + slot = same board, always.
 * The board stays the same for JOB_BOARD_REFRESH_SLOTS slots (see settings.ts).
 */
export function generateJobBoard(seed: Seed, origin: Dock, slot: number): Job[] {
  const period = boardPeriodOf(slot);
  const priceSlot = period * JOB_BOARD_REFRESH_SLOTS; // prices used for rewards stay fixed while the board stays fixed
  const candidates = findCandidates(seed, origin);
  const originSite = getSite(seed, origin.systemId);
  if (candidates.length === 0 || !originSite) return [];

  const jobs: Job[] = [];
  for (let i = 0; i < JOBS_PER_BOARD; i++) {
    const rng = rngFor(seed, "jobs", origin.id, period, i);
    const id = `${origin.id}#${period}#${i}`;
    const order = rng.shuffled(candidates);

    // Decide what kind of job to try. Passenger jobs need a terminal at the origin.
    let kind: "TRADE" | "PASSENGER" | "TOUR" = "TRADE";
    if (origin.hasPassengerTerminal) {
      const roll = rng.next();
      kind = roll < 0.5 ? "TRADE" : roll < 0.8 ? "PASSENGER" : "TOUR";
    }

    // Find stops (docks). Passenger stops must have a passenger terminal.
    const wantedStops = kind === "TOUR" ? rng.int(TOUR_MIN_STOPS, TOUR_MAX_STOPS) : 1;
    const stopDocks: Dock[] = [];
    const stopPositions: Vec3[] = [];
    for (const candidate of order) {
      if (stopDocks.length >= wantedStops) break;
      if (stopDocks.some((d) => d.id === candidate.dockId)) continue;
      const dock = findDockById(seed, candidate.dockId);
      if (!dock) continue;
      if (kind !== "TRADE" && !dock.hasPassengerTerminal) continue;
      stopDocks.push(dock);
      stopPositions.push(candidate.position);
      if (kind === "TRADE") break;
    }

    // If a passenger job found too few stops, fall back to a plain trade job to the first candidate.
    if (stopDocks.length < wantedStops && kind !== "TRADE") {
      kind = "TRADE";
      stopDocks.length = 0;
      stopPositions.length = 0;
      const first = order[0];
      const dock = first ? findDockById(seed, first.dockId) : null;
      if (dock && first) {
        stopDocks.push(dock);
        stopPositions.push(first.position);
      }
    }
    const destination = stopDocks[stopDocks.length - 1];
    if (!destination) continue;

    // Distance of the whole trip: origin to the first stop, then stop to stop.
    let totalDistance = 0;
    let from = originSite.position;
    for (const position of stopPositions) {
      totalDistance += distance(from, position);
      from = position;
    }
    totalDistance = Math.round(totalDistance * 10) / 10;
    const effectiveDistance = Math.max(totalDistance, 1);

    const limitRoll = rng.chance(0.4);
    // The time limit (hours) is a random 12 to 48 plus a little more for long trips.
    const baseLimit = rng.int(12, 48) + Math.ceil((totalDistance / 10) * JOB_LIMIT_HOURS_PER_10_LY);

    if (kind === "TRADE") {
      // Goods: usually something this dock makes cheaply, sometimes anything.
      const goodId = rng.chance(0.6) ? rng.pick(origin.produces) : rng.pick(GOODS).id;
      const good = getGood(goodId);
      if (!good) continue;
      const amount = rng.int(5, 40);
      const unitPrice = getPrice(seed, destination, goodId, priceSlot);
      const reward = fill(amount * unitPrice * 0.25 + effectiveDistance * amount * 0.6 + 30);
      jobs.push({
        id,
        kind: "TRADE",
        loadType: "GOODS",
        item: goodId,
        itemName: good.name,
        amount,
        requiredHold: "CARGO_BAY",
        originDockId: origin.id,
        destinationDockId: destination.id,
        stops: [destination.id],
        totalDistance,
        timeLimitSlots: limitRoll ? baseLimit : null,
        reward,
        blurb: generateBlurb(rng, "TRADE", {
          amount,
          item: good.name,
          from: origin.name,
          to: destination.name,
          stops: destination.name,
        }),
        unitPriceAtDestination: unitPrice,
        special: null,
      });
    } else {
      const group = generatePassengerGroup(rng);
      const amount = rng.int(2, 12);
      const stopNames = stopDocks.map((d) => d.name).join(", then ");
      const tourBonus = kind === "TOUR" ? 1 + 0.3 * (stopDocks.length - 1) : 1;
      const reward = fill((amount * (15 + effectiveDistance * 6) + 20) * tourBonus);
      jobs.push({
        id,
        kind,
        loadType: "PASSENGERS",
        item: group,
        itemName: group,
        amount,
        requiredHold: "PASSENGER_CABIN",
        originDockId: origin.id,
        destinationDockId: destination.id,
        stops: stopDocks.map((d) => d.id),
        totalDistance,
        timeLimitSlots: limitRoll ? (kind === "TOUR" ? baseLimit + 24 : baseLimit) : null,
        reward,
        blurb: generateBlurb(rng, kind, {
          amount,
          item: group,
          from: origin.name,
          to: destination.name,
          stops: stopNames,
        }),
        unitPriceAtDestination: null,
        special: null,
      });
    }
  }
  return jobs;
}

/** Same as generateJobBoard but finds the dock from its id. Null if the dock does not exist. */
export function getJobBoard(seed: Seed, dockId: string, slot: number): Job[] | null {
  const dock = findDockById(seed, dockId);
  return dock ? generateJobBoard(seed, dock, slot) : null;
}
