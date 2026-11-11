// The Game object: holds the state and the clock, and is what the panel talks to.
// Rules live in rules.ts; this file only connects them to the universe and the clock.

import { getShip } from "./ships";
import {
  distanceBetweenSystems,
  getDock,
  getDocksOfSystem,
  getJobBoard,
  getPlanet,
  getSystem,
  hashString,
  listSystemsNear,
  type Job,
  type Seed,
} from "../universe";
import { buyShip, shipCatalog, switchShip, type ShipCatalogEntry } from "./fleet";
import { OUTPOST_LINES } from "./debriefs";
import {
  buyOutpost,
  deliveryBonusPercentAt,
  fuelDiscountPercentAt,
  outpostBlock,
  outpostPrice,
  ownsOutpost,
  systemOfDock,
  type DockFacts,
} from "./outposts";
import { discoveryBase, explorerInfo, hasExploredSystem, parsePlanetId, type ExplorerInfo } from "./explore";
import {
  checkFreeTravel,
  emergencyRefuelInSpace,
  isStuckInSpace,
  settleFreeArrival,
  startFreeTravel,
  type FreeArrival,
  type TripFacts,
} from "./freetravel";
import { currentPlaceId, isFlying, notDockedReason } from "./location";
import { rankInfos, type RankInfo } from "./ranks";
import { UPGRADE_LINES } from "./debriefs";
import { buyLivery, currentLivery, liveryCatalog, setLivery, type LiveryRow } from "./liveries";
import { buyUpgrade, shipStats, upgradeOffers, type ShipStats, type UpgradeOffer } from "./upgrades";
import type { GameClock } from "./clock";
import { slotOf } from "./clock";
import { EXPLORER_DISCOVERY_BONUS_PERCENT, OUTPOST_DELIVERY_BONUS_PERCENT, OUTPOST_FUEL_DISCOUNT_PERCENT } from "./settings";
import {
  acceptJob,
  checkJob,
  emergencyRefuel,
  tripFuelCost,
  isStuck,
  refuel,
  settleArrival,
  travelProgress,
  tripSeconds,
  withBonuses,
  withoutDelivered,
  type Arrival,
  type Block,
  type TravelProgress,
} from "./rules";
import { newGameState, normalizeState, type GameState } from "./state";

/** One line of the mission board. */
export interface BoardEntry {
  /** The job. Its `reward` is what you will really be paid (rank and outpost bonuses included). */
  job: Job;
  /** The reward before bonuses. */
  baseReward: number;
  /** Total bonus in percent (rank + outpost); 0 = none. */
  bonusPercent: number;
  fuelNeeded: number;
  tripSeconds: number;
  /** Null = you can take it. Otherwise the plain reason it is blocked. */
  block: Block | null;
}

export type GameListener = () => void;

/** What the shipyard-style screen needs to show an outpost for sale. */
export interface OutpostOffer {
  dockId: string;
  dockName: string;
  systemName: string;
  /** False for stations (not for sale). */
  isOutpost: boolean;
  owned: boolean;
  /** Whole credits, or null for a station. */
  price: number | null;
  canBuy: boolean;
  /** Why it cannot be bought ("" when it can). */
  reason: string;
  /** What owning an outpost gives you in its star system. */
  perks: { fuelDiscountPercent: number; deliveryBonusPercent: number };
}

export interface OwnedOutpost {
  dockId: string;
  dockName: string;
  systemId: string;
  systemName: string;
}

/** What a free trip to a place would cost and give, or the plain reason it cannot be made. */
export type FreeTravelCheck =
  | {
      ok: true;
      targetId: string;
      targetName: string;
      /** True for a dock, false for a planet without a dock. */
      isDock: boolean;
      distanceLy: number;
      fuelNeeded: number;
      /** Fuel left on arrival. */
      fuelLeft: number;
      seconds: number;
      /** What exploring this star system would pay now (0 if you have been there). */
      discoveryCredits: number;
      /** True if you have never been to this star system. */
      newSystem: boolean;
    }
  | { ok: false; reason: string };

export class Game {
  state: GameState;
  /** The last delivery, shown as a funny debrief until the next job is accepted. */
  lastArrival: Arrival | null = null;
  /** The last free trip that ended (a funny line, discovery credits). Cleared when a trip or job starts. */
  lastFreeArrival: FreeArrival | null = null;
  private listeners: GameListener[] = [];

  constructor(
    readonly seed: Seed,
    startDockId: string,
    readonly clock: GameClock,
  ) {
    this.state = newGameState(startDockId);
  }

  subscribe(fn: GameListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private changed(): void {
    for (const fn of this.listeners.slice()) fn();
  }

  /** The time slot (whole game hour) right now. */
  currentSlot(): number {
    return slotOf(this.clock.now());
  }

  /** The plain jobs on this dock's board right now, without jobs you already delivered this board period. */
  private boardJobs(): Job[] {
    return withoutDelivered(this.state, getJobBoard(this.seed, this.state.currentDockId, this.currentSlot()) ?? []);
  }

  /** The mission board of the dock you are at. Empty while you are flying. */
  getBoard(): BoardEntry[] {
    if (isFlying(this.state) || this.state.spacePlanetId !== null) return [];
    const jobs = this.boardJobs();
    return jobs.map((plain) => {
      // Bonuses are added here, so the card shows exactly what the arrival will pay.
      const { job, baseReward, bonusPercent } = withBonuses(this.state, plain);
      return {
        job,
        baseReward,
        bonusPercent,
        fuelNeeded: tripFuelCost(this.state, job.totalDistance),
        tripSeconds: tripSeconds(job.totalDistance),
        block: checkJob(this.state, plain),
      };
    });
  }

  /** Accept a job from the current board by its id. */
  accept(jobId: string): { ok: true } | { ok: false; block: Block } {
    if (this.state.currentJob) {
      return { ok: false, block: { code: "busy", text: "You already have a job. Finish it first." } };
    }
    const away = this.whyNotDocked();
    if (away !== null) return { ok: false, block: { code: this.state.freeTrip ? "busy" : "wrong-dock", text: away } };
    const plain = this.boardJobs().find((j) => j.id === jobId);
    if (!plain) return { ok: false, block: { code: "wrong-dock", text: "That job is no longer on the board." } };
    // Check the job WITHOUT bonuses (the same check the board shows), so your own rank or outpost bonus can never
    // push a job over a rank limit (bug 6b-1). The job you carry keeps the bonus pay, which is paid on arrival.
    const result = acceptJob(this.state, plain, this.clock.now());
    if (!result.ok) return result;
    this.state = { ...result.state, currentJob: withBonuses(this.state, plain).job };
    this.lastArrival = null;
    this.lastFreeArrival = null;
    this.changed();
    return { ok: true };
  }

  /** Buy fuel. Returns the reason text if nothing was bought. */
  refuel(): { ok: true } | { ok: false; reason: string } {
    const away = this.whyNotDocked();
    if (away !== null) return { ok: false, reason: away };
    const result = refuel(this.state);
    if (!result.ok) return result;
    this.state = result.state;
    this.changed();
    return { ok: true };
  }

  /** Is the player stuck (no job takeable even after spending all credits on fuel, because of fuel)? */
  isStuck(): boolean {
    if (isFlying(this.state)) return false;
    if (this.state.spacePlanetId !== null) return isStuckInSpace(this.state, this.nearestDockLy(this.currentSystemId()));
    return isStuck(this.state, this.boardJobs());
  }

  /** Free fuel. Works only when stuck. Returns the funny line, or the reason it did not work. */
  emergencyRefuel(): { ok: true; units: number; line: string } | { ok: false; reason: string } {
    if (isFlying(this.state)) return { ok: false, reason: "You can only do this while docked or floating at a planet." };
    const result =
      this.state.spacePlanetId !== null
        ? emergencyRefuelInSpace(this.state, this.nearestDockLy(this.currentSystemId()))
        : emergencyRefuel(this.state, this.boardJobs());
    if (!result.ok) return result;
    this.state = result.state;
    this.changed();
    return { ok: true, units: result.units, line: result.line };
  }

  /** The shipyard list: each ship with owned, active, canBuy and the reason it cannot be bought. */
  getShipCatalog(): ShipCatalogEntry[] {
    return shipCatalog(this.state);
  }

  /** Buy a ship (any dock, not in flight). Does not switch to it. */
  buyShip(id: string): { ok: true } | { ok: false; reason: string } {
    const away = this.whyNotDocked();
    if (away !== null) return { ok: false, reason: away };
    const result = buyShip(this.state, id);
    if (!result.ok) return result;
    this.state = result.state;
    this.changed();
    return { ok: true };
  }

  /** Switch the active ship (free, docked only). */
  switchShip(id: string): { ok: true } | { ok: false; reason: string } {
    const result = switchShip(this.state, id);
    if (!result.ok) return result;
    this.state = result.state;
    this.changed();
    return { ok: true };
  }

  // ------------------------------------------------------------ ship upgrades (4d)

  /** The real numbers of a ship you own (default: the active ship): cargo, cabin, tank, fuel burn, comfort bonus. */
  getShipStats(shipId?: string): ShipStats {
    return shipStats(this.state, shipId ?? this.state.shipId);
  }

  /** The four upgrade rows (level, price of the next level, what it does, can you buy it, why not) for a ship (default: active). */
  getUpgradeOffers(shipId?: string): UpgradeOffer[] {
    return upgradeOffers(this.state, shipId ?? this.state.shipId);
  }

  /** Buy the next level of one track ("tank", "hold", "engines" or "comfort") of a ship you own. Any dock, not in flight. */
  // ------------------------------------------------------------ paint jobs (4g)

  /** The paint jobs of a ship (ids, owned, worn, price, can buy, why not). Names and pictures come from the render list. */
  getLiveryCatalog(shipId: string): LiveryRow[] {
    return liveryCatalog(this.state, shipId).map((row) => ({ ...row, reason: this.namedSpaceReason(row.reason) }));
  }

  /** The plain "no dock here" text names "this planet"; swap in the real planet's name (the same funny line). */
  private namedSpaceReason(reason: string): string {
    const generic = notDockedReason(this.state);
    return generic !== null && reason === generic ? (this.whyNotDocked() ?? reason) : reason;
  }

  /** The paint job a ship wears ("standard" by default). */
  currentLivery(shipId: string): string {
    return currentLivery(this.state, shipId);
  }

  /** Buy a paint job for any ship you own. Docked only; it does not put it on (call setLivery). */
  buyLivery(shipId: string, liveryId: string): { ok: true; price: number } | { ok: false; reason: string } {
    const result = buyLivery(this.state, shipId, liveryId);
    if (!result.ok) return { ok: false, reason: this.namedSpaceReason(result.reason) };
    this.state = result.state;
    this.changed();
    return { ok: true, price: result.price };
  }

  /** Put on a paint job you own (free). Not during a flight. */
  setLivery(shipId: string, liveryId: string): { ok: true } | { ok: false; reason: string } {
    const result = setLivery(this.state, shipId, liveryId);
    if (!result.ok) return result;
    this.state = result.state;
    this.changed();
    return { ok: true };
  }

  buyUpgrade(shipId: string, track: string): { ok: true; price: number; level: number; line: string } | { ok: false; reason: string } {
    const away = this.whyNotDocked();
    if (away !== null) return { ok: false, reason: away };
    const result = buyUpgrade(this.state, shipId, track);
    if (!result.ok) return result;
    this.state = result.state;
    const offerName = upgradeOffers(this.state, shipId).find((o) => o.track === track)?.name ?? "Upgrade";
    const line = (UPGRADE_LINES[hashString(`${shipId}|${track}|${result.level}`) % UPGRADE_LINES.length] ?? "Upgrade fitted.")
      .split("{ship}").join(getShip(shipId).name)
      .split("{upgrade}").join(offerName)
      .split("{level}").join(String(result.level));
    this.changed();
    return { ok: true, price: result.price, level: result.level, line };
  }

  // ------------------------------------------------------------ ranks and outposts (4c)

  /** The three ranks (cargo, passengers, tours): rank, name, progress to the next, bonus, biggest job allowed. */
  getRanks(): RankInfo[] {
    return rankInfos(this.state.completedJobs);
  }

  private dockFacts(dockId: string): DockFacts | null {
    const dock = getDock(this.seed, dockId);
    return dock ? { id: dock.id, kind: dock.kind, outpostPrice: dock.outpostPrice } : null;
  }

  /** The perks that count at a dock: cheaper fuel there, and bonus pay for jobs that end there. */
  getPerks(dockId: string = this.state.currentDockId): { fuelDiscountPercent: number; deliveryBonusPercent: number } {
    return {
      fuelDiscountPercent: fuelDiscountPercentAt(this.state, dockId),
      deliveryBonusPercent: deliveryBonusPercentAt(this.state, dockId),
    };
  }

  /** What buying this dock's outpost looks like: price, whether you can, and why not. */
  getOutpostOffer(dockId: string): OutpostOffer {
    const dock = getDock(this.seed, dockId);
    const facts = this.dockFacts(dockId);
    if (!dock || !facts) {
      return { dockId, dockName: "Unknown dock", systemName: "?", isOutpost: false, owned: false, price: null, canBuy: false, reason: "There is no such dock.", perks: { fuelDiscountPercent: 0, deliveryBonusPercent: 0 } };
    }
    const price = outpostPrice(facts);
    const reason = outpostBlock(this.state, facts);
    return {
      dockId,
      dockName: dock.name,
      systemName: getSystem(this.seed, dock.systemId)?.name ?? "?",
      isOutpost: dock.kind === "OUTPOST",
      owned: ownsOutpost(this.state, dockId),
      price,
      canBuy: reason === "",
      reason,
      // What you would get from owning an outpost in this system (the same for every outpost).
      perks: { fuelDiscountPercent: OUTPOST_FUEL_DISCOUNT_PERCENT, deliveryBonusPercent: OUTPOST_DELIVERY_BONUS_PERCENT },
    };
  }

  /** Buy the outpost at a dock (you must be docked there). Returns the funny line, or the reason it failed. */
  buyOutpost(dockId: string): { ok: true; price: number; line: string } | { ok: false; reason: string } {
    const facts = this.dockFacts(dockId);
    if (!facts) return { ok: false, reason: "There is no such dock." };
    const away = this.whyNotDocked();
    if (away !== null) return { ok: false, reason: away };
    const result = buyOutpost(this.state, facts);
    if (!result.ok) return result;
    this.state = result.state;
    const name = getDock(this.seed, dockId)?.name ?? "The outpost";
    const line = (OUTPOST_LINES[hashString(dockId) % OUTPOST_LINES.length] ?? "It is yours.")
      .split("{name}").join(name)
      .split("{price}").join(String(result.price));
    this.changed();
    return { ok: true, price: result.price, line };
  }

  /** The outposts you own, in the order you bought them. */
  getOwnedOutposts(): OwnedOutpost[] {
    return this.state.ownedOutposts.map((dockId) => {
      const dock = getDock(this.seed, dockId);
      const systemId = dock?.systemId ?? systemOfDock(dockId);
      return { dockId, dockName: dock?.name ?? "Unknown dock", systemId, systemName: getSystem(this.seed, systemId)?.name ?? "?" };
    });
  }

  // ------------------------------------------------------------ free travel and exploring (4f)

  /** The name of a dock or planet ("the place" if it does not exist). */
  placeName(id: string): string {
    return getDock(this.seed, id)?.name ?? getPlanet(this.seed, id)?.name ?? "the place";
  }

  /** The funny reason you cannot do dock things (jobs, buying, refuelling) right now, or null when you are docked. */
  whyNotDocked(): string | null {
    if (isFlying(this.state)) return null; // the flight messages come from the rules themselves
    const id = this.state.spacePlanetId;
    return notDockedReason(this.state, id === null ? "this planet" : this.placeName(id));
  }

  /** Light years from a star system to the nearest dock (0: every star system has at least one dock). */
  private nearestDockLy(systemId: string): number {
    if (getDocksOfSystem(this.seed, systemId).length > 0) return 0;
    const here = getSystem(this.seed, systemId);
    if (!here) return 0;
    for (const near of listSystemsNear(this.seed, here.position, 60)) {
      if (near.id !== systemId && getDocksOfSystem(this.seed, near.id).length > 0) return distanceBetweenSystems(this.seed, systemId, near.id) ?? 60;
    }
    return 60;
  }

  /** Everything the trip needs (where from and to, how far, how far to the nearest dock), or the reason it cannot be made. */
  private tripFactsTo(targetId: string): { ok: true; trip: TripFacts; targetName: string; isDock: boolean; targetSystemId: string } | { ok: false; reason: string } {
    const planet = getPlanet(this.seed, targetId);
    if (!planet) return { ok: false, reason: "There is no such place." };
    const fromId = currentPlaceId(this.state);
    const distanceLy = distanceBetweenSystems(this.seed, this.currentSystemId(), planet.systemId);
    if (distanceLy === null) return { ok: false, reason: "There is no such place." };
    return {
      ok: true,
      trip: { fromId, toId: targetId, distanceLy, nearestDockLy: this.nearestDockLy(planet.systemId) },
      targetName: this.placeName(targetId),
      isDock: getDock(this.seed, targetId) !== null,
      targetSystemId: planet.systemId,
    };
  }

  /** Could you fly to this dock or planet now (no job)? Gives the fuel numbers and what exploring would pay, or the reason not. */
  canFreeTravel(targetId: string): FreeTravelCheck {
    const facts = this.tripFactsTo(targetId);
    if (!facts.ok) return facts;
    const block = checkFreeTravel(this.state, facts.trip);
    if (block) return { ok: false, reason: block.text };
    const fuelNeeded = tripFuelCost(this.state, facts.trip.distanceLy);
    const newSystem = !hasExploredSystem(this.state.explored, facts.targetSystemId);
    const rankBonus = EXPLORER_DISCOVERY_BONUS_PERCENT[explorerInfo(this.state.explored).rankIndex];
    return {
      ok: true,
      targetId,
      targetName: facts.targetName,
      isDock: facts.isDock,
      distanceLy: facts.trip.distanceLy,
      fuelNeeded,
      fuelLeft: this.state.fuel - fuelNeeded,
      seconds: tripSeconds(facts.trip.distanceLy),
      discoveryCredits: newSystem ? Math.round(discoveryBase(this.seed, facts.targetSystemId) * (1 + rankBonus / 100)) : 0,
      newSystem,
    };
  }

  /** Fly to a dock or a planet without a dock, with no job. Costs fuel only. */
  freeTravel(targetId: string): { ok: true; fuelUsed: number; seconds: number } | { ok: false; reason: string } {
    const facts = this.tripFactsTo(targetId);
    if (!facts.ok) return facts;
    const result = startFreeTravel(this.state, facts.trip, this.clock.now());
    if (!result.ok) return result;
    this.state = result.state;
    this.lastArrival = null;
    this.lastFreeArrival = null;
    this.changed();
    return { ok: true, fuelUsed: result.fuelUsed, seconds: result.seconds };
  }

  /** The Explorer rank: star systems explored, planets arrived at, discoveries, rank, progress, discovery bonus. */
  getExplorer(): ExplorerInfo {
    return explorerInfo(this.state.explored);
  }

  /** Replace the state with saved data (old saves without ownedShips get sensible defaults). */
  loadState(raw: Partial<GameState> & { currentDockId: string }): void {
    const state = normalizeState(raw);
    // Keep only outposts that really exist in this universe (a save for another seed must not bring fake ones).
    const real = state.ownedOutposts.filter((id) => getDock(this.seed, id)?.kind === "OUTPOST");
    const prices: Record<string, number> = {};
    for (const id of real) {
      const paid = state.outpostPrices[id];
      if (paid !== undefined) prices[id] = paid;
    }
    let loaded: GameState = { ...state, ownedOutposts: real, outpostPrices: prices, outpostCount: real.length };
    // A place that does not exist in this universe cannot be where you float or fly to: you stay docked at the last dock.
    if (typeof loaded.spacePlanetId === "string" && (getPlanet(this.seed, loaded.spacePlanetId) === null || getDock(this.seed, loaded.spacePlanetId) !== null)) {
      loaded = { ...loaded, spacePlanetId: null };
    }
    if (loaded.freeTrip && getPlanet(this.seed, loaded.freeTrip.toId) === null) {
      loaded = { ...loaded, freeTrip: null, travelStartMs: null, travelEndMs: null };
    }
    this.state = loaded;
    this.lastArrival = null;
    this.lastFreeArrival = null;
    this.changed();
  }

  /** Checks the clock. If the trip is over: pays, moves, clears the job. Returns the arrival (or null). */
  update(): Arrival | null {
    if (this.state.freeTrip) {
      const free = settleFreeArrival(
        this.state,
        this.clock.now(),
        (id) => getDock(this.seed, id) !== null,
        (id) => this.placeName(id),
        (systemId) => discoveryBase(this.seed, systemId),
      );
      if (free.arrival) {
        this.state = free.state;
        this.lastFreeArrival = free.arrival;
        this.changed();
      }
      return null;
    }
    const { state, arrival } = settleArrival(
      this.state,
      this.clock.now(),
      (id) => getDock(this.seed, id)?.name ?? "the dock",
      (systemId) => discoveryBase(this.seed, systemId),
    );
    if (!arrival) return null;
    this.state = state;
    this.lastArrival = arrival;
    this.changed();
    return arrival;
  }

  /** How far the current trip is (for "arrives in..." and for a progress bar). Null if not flying. */
  progress(): TravelProgress | null {
    return travelProgress(this.state, this.clock.now());
  }

  /** The system id of the place you are at: your dock, or the planet you float at. */
  currentSystemId(): string {
    const placeId = currentPlaceId(this.state);
    return getDock(this.seed, placeId)?.systemId ?? parsePlanetId(placeId)?.systemId ?? placeId.split("/")[0] ?? "";
  }

  currentSystemName(): string {
    return getSystem(this.seed, this.currentSystemId())?.name ?? "?";
  }
}
