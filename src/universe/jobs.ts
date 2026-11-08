// LAYER 5: jobs. For one dock and one time slot, make a job board of about 6 offers.
// Uses all earlier layers. Accepting and completing jobs is NOT here (that is Agent 4's work).

import { GOODS, getGood } from "./data/goods";
import type { Dock } from "./dock";
import { getPrice } from "./economy";
import { distance, getSite, listSitesNear } from "./galaxy";
import { getDock, parseDockId } from "./lookup";
import { generateBlurb, generatePassengerGroup } from "./names";
import { rngFor, type Seed } from "./random";
import {
  JOBS_PER_BOARD,
  JOB_BOARD_REFRESH_SLOTS,
  MAX_JOB_DISTANCE,
  TOUR_MAX_STOPS,
  TOUR_MIN_STOPS,
} from "./settings";
import { generateSystem } from "./system";

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
  /** Unique, e.g. "3:-2:5:0/2#4#1". */
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
  position: { x: number; y: number; z: number };
}

/** Every dock within MAX_JOB_DISTANCE of the origin dock's system (except the origin dock itself). */
function findCandidates(seed: Seed, origin: Dock): Candidate[] {
  const originSite = getSite(seed, origin.systemId);
  if (!originSite) return [];
  const result: Candidate[] = [];
  for (const site of listSitesNear(seed, originSite.position, MAX_JOB_DISTANCE)) {
    const system = generateSystem(seed, site);
    for (let i = 0; i < system.planetCount; i++) {
      const dockId = `${system.id}/${i}`;
      if (dockId === origin.id) continue;
      result.push({ dockId, position: site.position });
    }
  }
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
    let previous = originSite.position;
    for (const candidate of order) {
      if (stopDocks.length >= wantedStops) break;
      if (distance(candidate.position, previous) > MAX_JOB_DISTANCE) continue;
      if (stopDocks.some((d) => d.id === candidate.dockId)) continue;
      const dock = getDock(seed, candidate.dockId);
      if (!dock) continue;
      if (kind !== "TRADE" && !dock.hasPassengerTerminal) continue;
      stopDocks.push(dock);
      previous = candidate.position;
      if (kind === "TRADE") break;
    }

    // If a passenger job found too few stops, fall back to a plain trade job to the first candidate.
    if (stopDocks.length < wantedStops && kind !== "TRADE") {
      kind = "TRADE";
      stopDocks.length = 0;
      const first = order[0];
      const dock = first ? getDock(seed, first.dockId) : null;
      if (dock) stopDocks.push(dock);
    }
    const destination = stopDocks[stopDocks.length - 1];
    if (!destination) continue;

    // Distance of the whole trip.
    let totalDistance = 0;
    let from = originSite.position;
    for (const stop of stopDocks) {
      const parsed = parseDockId(stop.id);
      const site = parsed ? getSite(seed, parsed.systemId) : null;
      if (!site) continue;
      totalDistance += distance(from, site.position);
      from = site.position;
    }
    totalDistance = Math.round(totalDistance * 10) / 10;
    const effectiveDistance = Math.max(totalDistance, 1);

    const limitRoll = rng.chance(0.4);
    const baseLimit = rng.int(12, 48);

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
  const dock = getDock(seed, dockId);
  return dock ? generateJobBoard(seed, dock, slot) : null;
}
