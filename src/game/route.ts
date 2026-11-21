// The hopping flight plan (stage NAV-1). Pure logic: given where you are, where you want to go and how far one FULL tank
// flies, it picks docks to hop through. No graphics, no game state, no randomness: the same question gives the same answer.
//
// How it chooses (greedy with a short look-ahead):
//  1. From the current spot, ask the universe for the nearest docks around a point `range` ly ahead towards the target
//     (and a second point 70% of the way). Keep the docks in OTHER star systems that are within `range` of where you are.
//  2. Take the one that ends up closest to the target, if it is really closer than you are now. Repeat.
//  3. If none is closer (an empty gap or a dead-end pocket): look in 4 more directions (45 degrees to each side, up and
//     down), then a LOOK-AHEAD OF TWO HOPS: for the 6 reachable docks closest to the target, ask what the best next hop
//     from each would be; take the first of those that leads somewhere closer than now. The first hop of such a pair
//     can be a small detour; every other hop gets closer.
//  4. If even that finds nothing, the answer is "stuck", with how close we got and how wide the gap is.
// The last hop lands exactly at the target dock when the target is within one tank.

import { nearestDocks, type NearDock, type Seed, type Vec3 } from "../universe";

export const MAX_PLAN_HOPS = 20;
/**
 * HOTFIX 2026-11-21: a work limit. A plan may ask the universe "which docks are near this point?" at most this many times.
 * A normal plan of 20 hops asks about 40 to 150 times; a plan through empty space could ask far more and freeze a phone. When
 * the limit is reached the plan stops where it got to (the hops so far, "ask again after you arrive"), never an endless search.
 * Counting questions (not milliseconds) keeps the answer the same on every device.
 */
export const MAX_PLAN_QUERIES = 400;
const FORWARD_PROBES = [1, 0.7];
const LOOK_AHEAD_CANDIDATES = 6;
const DOCKS_PER_PROBE = 20;

export interface PlannedHop {
  dockId: string;
  systemId: number;
  position: Vec3;
}

export interface RouteQuestion {
  seed: Seed;
  /** Where the ship is (the position of its star system) and which system that is. */
  from: Vec3;
  fromSystemId: number;
  /** The target: the position of its star system, the system, and the dock to land at. */
  to: Vec3;
  toSystemId: number;
  toDockId: string;
  /** The longest hop (whole light years) one full tank allows. */
  rangeLy: number;
  maxHops?: number;
  /** The work limit (default MAX_PLAN_QUERIES). */
  maxQueries?: number;
}

/** Thrown inside planHops when the work limit is reached; planHops turns it into a shorter answer. */
class PlanBudgetError extends Error {}

/** Counts the universe questions of one plan (one counter per planHops call). */
interface Budget {
  left: number;
}
let budget: Budget = { left: Infinity };

function askDocks(seed: Seed, p: Vec3, count: number): NearDock[] {
  if (--budget.left < 0) throw new PlanBudgetError("flight plan work limit reached");
  return nearestDocks(seed, p, count);
}

export interface RouteAnswer {
  status: "ok" | "here" | "no-docks-in-reach" | "stuck";
  hops: PlannedHop[];
  /** True when the plan stops after maxHops although the target is not reached yet. */
  truncated: boolean;
  /** Light years from the end of the plan to the target. */
  remainingLy: number;
  /** For stuck and no-docks-in-reach: the closest point reached, and the empty gap to cross (ly beyond one tank). */
  closestLy: number | null;
  gapLy: number | null;
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function unit(a: Vec3, b: Vec3): Vec3 {
  const d = dist(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d };
}

function along(p: Vec3, dir: Vec3, ly: number): Vec3 {
  return { x: p.x + dir.x * ly, y: p.y + dir.y * ly, z: p.z + dir.z * ly };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalise(a: Vec3): Vec3 {
  const d = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / d, y: a.y / d, z: a.z / d };
}

/** Two directions at right angles to `dir`. */
function perpendiculars(dir: Vec3): [Vec3, Vec3] {
  const helper = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = normalise(cross(dir, helper));
  const v = normalise(cross(dir, u));
  return [u, v];
}

/** One dock per star system (the lowest planet number), nearest to `p` first. */
function dockSites(seed: Seed, p: Vec3): NearDock[] {
  const seen = new Set<number>();
  const out: NearDock[] = [];
  for (const d of askDocks(seed, p, DOCKS_PER_PROBE)) {
    if (seen.has(d.systemId)) continue;
    seen.add(d.systemId);
    out.push(d);
  }
  return out;
}

/** All docks (one per system, not the system you are in, not visited) within `range` of `pos`, from probes ahead. */
function reachable(q: RouteQuestion, pos: Vec3, systemId: number, visited: ReadonlySet<number>, sideways: boolean): NearDock[] {
  const range = q.rangeLy;
  const toTarget = dist(pos, q.to);
  const dir = unit(pos, q.to);
  const probes: Vec3[] = FORWARD_PROBES.map((f) => along(pos, dir, Math.min(range * f, toTarget)));
  if (sideways) {
    const [u, v] = perpendiculars(dir);
    const c = Math.SQRT1_2;
    for (const side of [u, v, { x: -u.x, y: -u.y, z: -u.z }, { x: -v.x, y: -v.y, z: -v.z }]) {
      probes.push(along(pos, normalise({ x: dir.x * c + side.x * c, y: dir.y * c + side.y * c, z: dir.z * c + side.z * c }), range * 0.8));
    }
  }
  const found = new Map<number, NearDock>();
  for (const p of probes) {
    for (const d of dockSites(q.seed, p)) {
      if (d.systemId === systemId || visited.has(d.systemId) || found.has(d.systemId)) continue;
      if (dist(pos, d.position) <= range) found.set(d.systemId, d);
    }
  }
  return [...found.values()];
}

function closest(list: NearDock[], to: Vec3): NearDock | null {
  let best: NearDock | null = null;
  let bestD = Infinity;
  for (const d of list) {
    const dd = dist(d.position, to);
    if (dd < bestD - 1e-9 || (Math.abs(dd - bestD) <= 1e-9 && best !== null && d.systemId < best.systemId)) {
      best = d;
      bestD = dd;
    }
  }
  return best;
}

/** The best next hop from here that gets closer than `here` to the target, or null. */
function greedyStep(q: RouteQuestion, pos: Vec3, systemId: number, visited: ReadonlySet<number>, sideways: boolean): NearDock | null {
  const here = dist(pos, q.to);
  const best = closest(reachable(q, pos, systemId, visited, sideways), q.to);
  return best && dist(best.position, q.to) < here - 1e-6 ? best : null;
}

export function planHops(q: RouteQuestion): RouteAnswer {
  const outer = budget;
  budget = { left: q.maxQueries ?? MAX_PLAN_QUERIES };
  const hops: PlannedHop[] = [];
  const state = { pos: q.from };
  try {
    return planHopsInner(q, hops, state);
  } catch (error) {
    if (!(error instanceof PlanBudgetError)) throw error;
    // Work limit reached: the hops found so far are a fair start (each one is real and closer); ask again after arriving.
    const remainingLy = dist(state.pos, q.to);
    if (hops.length > 0) return { status: "ok", hops, truncated: true, remainingLy, closestLy: null, gapLy: null };
    return { status: "stuck", hops, truncated: false, remainingLy, closestLy: remainingLy, gapLy: null };
  } finally {
    budget = outer;
  }
}

function planHopsInner(q: RouteQuestion, hops: PlannedHop[], state: { pos: Vec3 }): RouteAnswer {
  const maxHops = q.maxHops ?? MAX_PLAN_HOPS;
  const answer = (status: RouteAnswer["status"], hops: PlannedHop[], truncated: boolean, pos: Vec3, extra: Partial<RouteAnswer> = {}): RouteAnswer => ({
    status,
    hops,
    truncated,
    remainingLy: dist(pos, q.to),
    closestLy: null,
    gapLy: null,
    ...extra,
  });
  if (q.fromSystemId === q.toSystemId) return answer("here", [], false, q.from);
  const visited = new Set<number>([q.fromSystemId]);
  let pos = q.from;
  let systemId = q.fromSystemId;
  const toPlanned = (d: NearDock): PlannedHop => ({ dockId: d.dockId, systemId: d.systemId, position: d.position });
  while (hops.length < maxHops) {
    // The target is within one tank: land at the target dock.
    if (dist(pos, q.to) <= q.rangeLy) {
      hops.push({ dockId: q.toDockId, systemId: q.toSystemId, position: q.to });
      return answer("ok", hops, false, q.to);
    }
    let next = greedyStep(q, pos, systemId, visited, false) ?? greedyStep(q, pos, systemId, visited, true);
    let detour: NearDock | null = null;
    if (!next) {
      // Look-ahead: a hop that is not closer, followed by one that is.
      const options = reachable(q, pos, systemId, visited, true)
        .sort((a, b) => dist(a.position, q.to) - dist(b.position, q.to) || a.systemId - b.systemId)
        .slice(0, LOOK_AHEAD_CANDIDATES);
      if (options.length === 0) {
        return answer(hops.length === 0 ? "no-docks-in-reach" : "stuck", hops, false, pos, { closestLy: dist(pos, q.to), gapLy: gapBeyondReach(q, pos, systemId) });
      }
      const here = dist(pos, q.to);
      for (const cand of options) {
        const after = new Set(visited).add(cand.systemId);
        const second = greedyStep(q, cand.position, cand.systemId, after, true);
        if (second && dist(second.position, q.to) < here - 1e-6) {
          detour = cand;
          break;
        }
      }
      if (!detour) {
        return answer("stuck", hops, false, pos, { closestLy: here, gapLy: gapBeyondReach(q, pos, systemId) });
      }
      next = detour;
    }
    hops.push(toPlanned(next));
    visited.add(next.systemId);
    pos = next.position;
    state.pos = pos;
    systemId = next.systemId;
  }
  return answer("ok", hops, dist(pos, q.to) > 0, pos);
}

/** How many light years beyond one tank the next dock that is closer to the target lies (the gap to cross). */
function gapBeyondReach(q: RouteQuestion, pos: Vec3, systemId: number): number | null {
  const here = dist(pos, q.to);
  const dir = unit(pos, q.to);
  const probe = along(pos, dir, Math.min(here, q.rangeLy + 1));
  let best: number | null = null;
  for (const d of askDocks(q.seed, probe, 12)) {
    if (d.systemId === systemId) continue;
    if (dist(d.position, q.to) >= here) continue;
    const reach = dist(pos, d.position);
    if (best === null || reach < best) best = reach;
  }
  return best === null ? null : Math.max(0, Math.round((best - q.rangeLy) * 10) / 10);
}
