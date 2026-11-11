// A "survey" counts what a universe looks like around a point: how many planets and docks systems have,
// how many docks are reachable for jobs, and how full the job boards are.
// It is used by the debug page and by tests. It only READS the universe through its public lookups.

import { distance, type Vec3 } from "./galaxy";
import { generateJobBoard } from "./jobs";
import { getDock, getPlanetsOfSystem, listSystemsNear } from "./lookup";
import { MAX_JOB_DISTANCE } from "./settings";
import type { Seed } from "./random";

export interface SurveyOptions {
  /** Where to look (default: the origin 0,0,0). */
  center?: Vec3;
  /** Systems within this many light years are counted for planets and docks (default 35, the size of the starmap). */
  systemRadius?: number;
  /** Docks within this many light years get a job board and a reachability count (default 15). */
  sampleRadius?: number;
  /** Time slot used for the job boards (default 0). */
  slot?: number;
}

export interface SeedSurvey {
  seed: Seed;
  systems: number;
  /** planetsPerSystem[n] = how many systems have n planets (index 0 is always 0). */
  planetsPerSystem: number[];
  /** docksPerSystem[n] = how many systems have n docks (index 0 means a system with no dock). */
  docksPerSystem: number[];
  docks: number;
  outposts: number;
  stations: number;
  passengerTerminals: number;
  /** Docks that got a job board. */
  boards: number;
  /** For those docks: other docks within MAX_JOB_DISTANCE (sum, so averages can be combined). */
  reachableSum: number;
  reachableMin: number;
  /** Jobs on the boards (sum) and the smallest board. */
  jobsSum: number;
  jobsMin: number;
  /** Boards with fewer than 3 jobs, and boards with none. */
  thinBoards: number;
  emptyBoards: number;
  tourJobs: number;
  /** Boards that contain at least one TOUR job. */
  boardsWithTour: number;
}

export function surveySeed(seed: Seed, options: SurveyOptions = {}): SeedSurvey {
  const center = options.center ?? { x: 0, y: 0, z: 0 };
  const systemRadius = options.systemRadius ?? 35;
  const sampleRadius = options.sampleRadius ?? 15;
  const slot = options.slot ?? 0;

  const result: SeedSurvey = {
    seed,
    systems: 0,
    planetsPerSystem: new Array(11).fill(0),
    docksPerSystem: new Array(11).fill(0),
    docks: 0,
    outposts: 0,
    stations: 0,
    passengerTerminals: 0,
    boards: 0,
    reachableSum: 0,
    reachableMin: Number.POSITIVE_INFINITY,
    jobsSum: 0,
    jobsMin: Number.POSITIVE_INFINITY,
    thinBoards: 0,
    emptyBoards: 0,
    tourJobs: 0,
    boardsWithTour: 0,
  };

  for (const system of listSystemsNear(seed, center, systemRadius)) {
    result.systems++;
    const planets = getPlanetsOfSystem(seed, system.id);
    result.planetsPerSystem[planets.length] = (result.planetsPerSystem[planets.length] ?? 0) + 1;
    let docksHere = 0;
    const inSample = distance(system.position, center) <= sampleRadius;
    for (const planet of planets) {
      const dock = getDock(seed, planet.id);
      if (!dock) continue;
      docksHere++;
      result.docks++;
      if (dock.kind === "OUTPOST") result.outposts++;
      else result.stations++;
      if (dock.hasPassengerTerminal) result.passengerTerminals++;
      if (!inSample) continue;

      let reachable = 0;
      for (const other of listSystemsNear(seed, system.position, MAX_JOB_DISTANCE)) {
        for (const otherPlanet of getPlanetsOfSystem(seed, other.id)) {
          if (otherPlanet.id !== dock.id && getDock(seed, otherPlanet.id)) reachable++;
        }
      }
      const board = generateJobBoard(seed, dock, slot);
      const tours = board.filter((j) => j.kind === "TOUR").length;
      result.boards++;
      result.reachableSum += reachable;
      result.reachableMin = Math.min(result.reachableMin, reachable);
      result.jobsSum += board.length;
      result.jobsMin = Math.min(result.jobsMin, board.length);
      if (board.length < 3) result.thinBoards++;
      if (board.length === 0) result.emptyBoards++;
      result.tourJobs += tours;
      if (tours > 0) result.boardsWithTour++;
    }
    result.docksPerSystem[docksHere] = (result.docksPerSystem[docksHere] ?? 0) + 1;
  }
  return result;
}

export interface SurveySummary {
  seeds: number;
  systems: number;
  planetsPerSystem: number[];
  docksPerSystem: number[];
  docks: number;
  outpostShare: number;
  stationShare: number;
  terminalShare: number;
  boards: number;
  reachableAvg: number;
  reachableMin: number;
  jobsAvg: number;
  jobsMin: number;
  thinBoards: number;
  emptyBoards: number;
  /** Share of all jobs that are tours. */
  tourJobShare: number;
  /** Share of boards that have at least one tour. */
  boardsWithTourShare: number;
}

function ratio(top: number, bottom: number): number {
  return bottom === 0 ? 0 : top / bottom;
}

export function summarizeSurveys(surveys: readonly SeedSurvey[]): SurveySummary {
  const total = {
    systems: 0,
    docks: 0,
    outposts: 0,
    stations: 0,
    terminals: 0,
    boards: 0,
    reachableSum: 0,
    jobsSum: 0,
    thin: 0,
    empty: 0,
    tourJobs: 0,
    boardsWithTour: 0,
  };
  const planetsPerSystem = new Array(11).fill(0);
  const docksPerSystem = new Array(11).fill(0);
  let reachableMin = Number.POSITIVE_INFINITY;
  let jobsMin = Number.POSITIVE_INFINITY;
  for (const s of surveys) {
    total.systems += s.systems;
    total.docks += s.docks;
    total.outposts += s.outposts;
    total.stations += s.stations;
    total.terminals += s.passengerTerminals;
    total.boards += s.boards;
    total.reachableSum += s.reachableSum;
    total.jobsSum += s.jobsSum;
    total.thin += s.thinBoards;
    total.empty += s.emptyBoards;
    total.tourJobs += s.tourJobs;
    total.boardsWithTour += s.boardsWithTour;
    reachableMin = Math.min(reachableMin, s.reachableMin);
    jobsMin = Math.min(jobsMin, s.jobsMin);
    s.planetsPerSystem.forEach((n, i) => (planetsPerSystem[i] += n));
    s.docksPerSystem.forEach((n, i) => (docksPerSystem[i] += n));
  }
  return {
    seeds: surveys.length,
    systems: total.systems,
    planetsPerSystem,
    docksPerSystem,
    docks: total.docks,
    outpostShare: ratio(total.outposts, total.docks),
    stationShare: ratio(total.stations, total.docks),
    terminalShare: ratio(total.terminals, total.docks),
    boards: total.boards,
    reachableAvg: ratio(total.reachableSum, total.boards),
    reachableMin: Number.isFinite(reachableMin) ? reachableMin : 0,
    jobsAvg: ratio(total.jobsSum, total.boards),
    jobsMin: Number.isFinite(jobsMin) ? jobsMin : 0,
    thinBoards: total.thin,
    emptyBoards: total.empty,
    tourJobShare: ratio(total.tourJobs, total.jobsSum),
    boardsWithTourShare: ratio(total.boardsWithTour, total.boards),
  };
}
