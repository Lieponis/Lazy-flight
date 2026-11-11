// EXPLORER SIMULATOR (test-only). A player who never takes a job: flies to the nearest star system it has not explored,
// buys fuel at docks, and either visits only docks or every planet of each system. Plays with the REAL rules
// (Game.freeTravel, strand protection, discovery credits) on a fake clock at speed 1.
// Used to choose and check the Explorer rank thresholds. Report: npm run balance.

import { Game, createClock, discoveriesOf, EXPLORER_DISCOVERIES_NEEDED } from "../../src/game";
import { docksOf, getPlanetsOfSystem, getSystem, listSystemsNear, startDockOf, type StarSystem } from "../../src/universe";

const HOUR = 3_600_000;

export type ExplorerStyle = "docks" | "all";

export interface ExplorerResult {
  seed: number;
  style: ExplorerStyle;
  hours: number;
  systems: number;
  planets: number;
  discoveries: number;
  /** Hours until 25 / 50 / 100 / 200 discoveries (null = not reached). */
  hoursTo: Record<number, number | null>;
  /** Hours until Explorer rank 2 and rank 3. */
  rankHours: [number | null, number | null];
  creditsEnd: number;
  /** Credits earned from discovery in total. */
  discoveryEarned: number;
  fuelBought: number;
  /** Trips the strand rule refused (the player then refuelled or picked another place). */
  strandRefusals: number;
  emergencyRefuels: number;
  /** Times the explorer could go nowhere at all (should be 0). */
  gaveUp: number;
}

const MARKS = [25, 50, 100, 200];

export function simulateExplorer(seed: number, style: ExplorerStyle, hours: number): ExplorerResult {
  let t = 1_000 * HOUR;
  const t0 = t;
  const end = t0 + hours * HOUR;
  const game = new Game(seed, startDockOf(seed).id, createClock(1, () => t));
  const hoursNow = (): number => (t - t0) / HOUR;
  const r: ExplorerResult = {
    seed,
    style,
    hours,
    systems: 0,
    planets: 0,
    discoveries: 0,
    hoursTo: { 25: null, 50: null, 100: null, 200: null },
    rankHours: [null, null],
    creditsEnd: 0,
    discoveryEarned: 0,
    fuelBought: 0,
    strandRefusals: 0,
    emergencyRefuels: 0,
    gaveUp: 0,
  };
  const note = (): void => {
    const d = discoveriesOf(game.state.explored);
    for (const m of MARKS) if (d >= m && r.hoursTo[m] === null) r.hoursTo[m] = hoursNow();
    const [second, third] = EXPLORER_DISCOVERIES_NEEDED;
    if (d >= second && r.rankHours[0] === null) r.rankHours[0] = hoursNow();
    if (d >= third && r.rankHours[1] === null) r.rankHours[1] = hoursNow();
  };
  const refuelNow = (): void => {
    const before = game.state.fuel;
    if (game.refuel().ok) r.fuelBought += game.state.fuel - before;
  };
  const planetsToVisit = (system: StarSystem): string[] => {
    const docks = new Set(docksOf(seed, system).map((d) => d.id));
    return getPlanetsOfSystem(seed, system.id)
      .filter((p) => style === "all" || docks.has(p.id))
      .map((p) => p.id);
  };
  const visited = (planetId: string): boolean => {
    const [sys, idx] = [planetId.slice(0, planetId.lastIndexOf("/")), Number(planetId.slice(planetId.lastIndexOf("/") + 1))];
    return ((game.state.explored[sys] ?? 0) & (1 << idx)) !== 0;
  };
  const fly = (targetId: string): boolean => {
    const c = game.canFreeTravel(targetId);
    if (!c.ok) {
      r.strandRefusals++;
      return false;
    }
    const result = game.freeTravel(targetId);
    if (!result.ok) return false;
    t = game.state.travelEndMs as number;
    game.update();
    r.discoveryEarned += game.lastFreeArrival?.discovery ?? 0;
    note();
    return true;
  };

  // Nothing is explored at the start: the start system counts when the explorer arrives in it.
  for (let guard = 0; guard < 100000 && t < end; guard++) {
    const here = getSystem(seed, game.currentSystemId()) as StarSystem;
    const docked = game.state.spacePlanetId === null;
    if (docked) refuelNow();
    // 1. planets of this system not visited yet
    const todo = planetsToVisit(here).filter((id) => !visited(id) && id !== (docked ? game.state.currentDockId : game.state.spacePlanetId));
    const next = todo[0];
    if (next && fly(next)) continue;
    // 2. nearest star system not explored, one we can reach
    let went = false;
    for (const system of listSystemsNear(seed, here.position, 40)) {
      if (system.id === here.id || (game.state.explored[system.id] ?? 0) !== 0) continue;
      const dock = docksOf(seed, system)[0];
      if (!dock) continue;
      const c = game.canFreeTravel(dock.id);
      if (!c.ok) continue;
      if (fly(dock.id)) {
        went = true;
        break;
      }
    }
    if (went) continue;
    // 3. cannot reach anything: refuel (docked) or go to a dock first (floating), or emergency fuel
    if (!docked) {
      if (fly(game.state.currentDockId)) continue;
    } else if (game.state.fuel < game.getShipStats().fuelTankSize && game.state.credits > 0) {
      continue;
    }
    if (game.isStuck() && game.emergencyRefuel().ok) {
      r.emergencyRefuels++;
      continue;
    }
    r.gaveUp++;
    t += 60_000; // wait a minute and try again
    game.update();
  }
  const counts = game.getExplorer();
  r.systems = counts.systems;
  r.planets = counts.planets;
  r.discoveries = counts.discoveries;
  r.creditsEnd = game.state.credits;
  return r;
}
