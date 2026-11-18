// A "survey" counts what a universe looks like around a point: how many planets and docks systems have,
// how far the job destinations are, and how full the job boards are.
// It is used by the debug page and by tests. It only READS the universe through its public lookups.

import { generateJobBoard } from "./jobs";
import { findDockById, getPlanets, nearestDocks, nearestSystems } from "./lookup";
import { JOB_DESTINATION_COUNT } from "./settings";
import type { Seed } from "./random";
import { START_POINT } from "./galaxy";
import type { Vec3 } from "./sites";

export interface SurveyOptions {
  /** Where to look (default: the start point). */
  center?: Vec3;
  /** The nearest this many systems are counted for planets and docks (default 400). */
  systems?: number;
  /** The docks of the nearest this many systems get a job board (default 20). */
  sampleSystems?: number;
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
  /** For those docks: distance (ly) to the nearest and to the farthest possible destination (sums, so averages can be combined). */
  nearestDestinationSum: number;
  farthestDestinationSum: number;
  farthestDestinationMax: number;
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
  const center = options.center ?? START_POINT;
  const systemCount = options.systems ?? 400;
  const sampleSystems = options.sampleSystems ?? 20;
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
    nearestDestinationSum: 0,
    farthestDestinationSum: 0,
    farthestDestinationMax: 0,
    jobsSum: 0,
    jobsMin: Number.POSITIVE_INFINITY,
    thinBoards: 0,
    emptyBoards: 0,
    tourJobs: 0,
    boardsWithTour: 0,
  };

  let rank = 0;
  for (const { system } of nearestSystems(seed, center, systemCount)) {
    const inSample = rank++ < sampleSystems;
    result.systems++;
    const planets = getPlanets(seed, system.id);
    result.planetsPerSystem[planets.length] = (result.planetsPerSystem[planets.length] ?? 0) + 1;
    let docksHere = 0;
    for (const planet of planets) {
      const dock = findDockById(seed, planet.id);
      if (!dock) continue;
      docksHere++;
      result.docks++;
      if (dock.kind === "OUTPOST") result.outposts++;
      else result.stations++;
      if (dock.hasPassengerTerminal) result.passengerTerminals++;
      if (!inSample) continue;

      // The possible destinations: the nearest docks other than this one (the first one found is the dock itself).
      const others = nearestDocks(seed, system.position, JOB_DESTINATION_COUNT + 1).filter((d) => d.dockId !== dock.id);
      const board = generateJobBoard(seed, dock, slot);
      const tours = board.filter((j) => j.kind === "TOUR").length;
      result.boards++;
      result.nearestDestinationSum += others[0]?.distance ?? 0;
      const far = others[Math.min(others.length, JOB_DESTINATION_COUNT) - 1]?.distance ?? 0;
      result.farthestDestinationSum += far;
      result.farthestDestinationMax = Math.max(result.farthestDestinationMax, far);
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
  /** Average distance (ly) to the nearest and to the farthest possible job destination, and the largest "farthest". */
  nearestDestinationAvg: number;
  farthestDestinationAvg: number;
  farthestDestinationMax: number;
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
    nearestSum: 0,
    farthestSum: 0,
    jobsSum: 0,
    thin: 0,
    empty: 0,
    tourJobs: 0,
    boardsWithTour: 0,
  };
  const planetsPerSystem = new Array(11).fill(0);
  const docksPerSystem = new Array(11).fill(0);
  let farthestMax = 0;
  let jobsMin = Number.POSITIVE_INFINITY;
  for (const s of surveys) {
    total.systems += s.systems;
    total.docks += s.docks;
    total.outposts += s.outposts;
    total.stations += s.stations;
    total.terminals += s.passengerTerminals;
    total.boards += s.boards;
    total.nearestSum += s.nearestDestinationSum;
    total.farthestSum += s.farthestDestinationSum;
    total.jobsSum += s.jobsSum;
    total.thin += s.thinBoards;
    total.empty += s.emptyBoards;
    total.tourJobs += s.tourJobs;
    total.boardsWithTour += s.boardsWithTour;
    farthestMax = Math.max(farthestMax, s.farthestDestinationMax);
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
    nearestDestinationAvg: ratio(total.nearestSum, total.boards),
    farthestDestinationAvg: ratio(total.farthestSum, total.boards),
    farthestDestinationMax: farthestMax,
    jobsAvg: ratio(total.jobsSum, total.boards),
    jobsMin: Number.isFinite(jobsMin) ? jobsMin : 0,
    thinBoards: total.thin,
    emptyBoards: total.empty,
    tourJobShare: ratio(total.tourJobs, total.jobsSum),
    boardsWithTourShare: ratio(total.boardsWithTour, total.boards),
  };
}
