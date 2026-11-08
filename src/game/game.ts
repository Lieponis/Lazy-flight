// The Game object: holds the state and the clock, and is what the panel talks to.
// Rules live in rules.ts; this file only connects them to the universe and the clock.

import { getDock, getJobBoard, getSystem, type Job, type Seed } from "../universe";
import type { GameClock } from "./clock";
import { slotOf } from "./clock";
import {
  acceptJob,
  checkJob,
  fuelCost,
  refuel,
  settleArrival,
  travelProgress,
  tripSeconds,
  type Arrival,
  type Block,
  type TravelProgress,
} from "./rules";
import { newGameState, type GameState } from "./state";

/** One line of the mission board. */
export interface BoardEntry {
  job: Job;
  fuelNeeded: number;
  tripSeconds: number;
  /** Null = you can take it. Otherwise the plain reason it is blocked. */
  block: Block | null;
}

export type GameListener = () => void;

export class Game {
  state: GameState;
  /** The last delivery, shown as a funny debrief until the next job is accepted. */
  lastArrival: Arrival | null = null;
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

  /** The mission board of the dock you are at. Empty while you are flying. */
  getBoard(): BoardEntry[] {
    if (this.state.currentJob) return [];
    const jobs = getJobBoard(this.seed, this.state.currentDockId, this.currentSlot()) ?? [];
    return jobs.map((job) => ({
      job,
      fuelNeeded: fuelCost(job.totalDistance),
      tripSeconds: tripSeconds(job.totalDistance),
      block: checkJob(this.state, job),
    }));
  }

  /** Accept a job from the current board by its id. */
  accept(jobId: string): { ok: true } | { ok: false; block: Block } {
    if (this.state.currentJob) {
      return { ok: false, block: { code: "busy", text: "You already have a job. Finish it first." } };
    }
    const job = this.getBoard().find((e) => e.job.id === jobId)?.job;
    if (!job) return { ok: false, block: { code: "wrong-dock", text: "That job is no longer on the board." } };
    const result = acceptJob(this.state, job, this.clock.now());
    if (!result.ok) return result;
    this.state = result.state;
    this.lastArrival = null;
    this.changed();
    return { ok: true };
  }

  /** Buy fuel. Returns the reason text if nothing was bought. */
  refuel(): { ok: true } | { ok: false; reason: string } {
    const result = refuel(this.state);
    if (!result.ok) return result;
    this.state = result.state;
    this.changed();
    return { ok: true };
  }

  /** Checks the clock. If the trip is over: pays, moves, clears the job. Returns the arrival (or null). */
  update(): Arrival | null {
    const { state, arrival } = settleArrival(this.state, this.clock.now(), (id) => getDock(this.seed, id)?.name ?? "the dock");
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

  /** The system id of the dock you are at. */
  currentSystemId(): string {
    return getDock(this.seed, this.state.currentDockId)?.systemId ?? this.state.currentDockId.split("/")[0] ?? "";
  }

  currentSystemName(): string {
    return getSystem(this.seed, this.currentSystemId())?.name ?? "?";
  }
}
