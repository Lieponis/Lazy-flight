// The front door of the universe generator. Other parts of the project import from here only:
//   import { listSystemsNear, getDock, getMarket, getJobBoard } from "../universe";

export * from "./settings";
export { hashString, hashUnit, mulberry32, rngFor, Rng } from "./random";
export type { Seed } from "./random";
export {
  distance,
  distanceBetweenSystems,
  getSite,
  getSitesInSector,
  listSitesNear,
  parseSystemId,
  sectorOf,
  systemIdOf,
} from "./galaxy";
export type { SystemSite, Vec3 } from "./galaxy";
export { generateSystem } from "./system";
export type { Star, StarSystem, StarType } from "./system";
export { generatePlanet, generatePlanets } from "./planet";
export type { Planet, PlanetColors, PlanetType } from "./planet";
export { dockPlanetIndexes, docksOf, generateDock, maxDocksFor } from "./dock";
export type { Dock, DockKind, OutpostPerks } from "./dock";
export { GOODS, getGood } from "./data/goods";
export type { Good, GoodCategory } from "./data/goods";
export { getMarket, getPrice, roleOf } from "./economy";
export type { MarketEntry, MarketRole } from "./economy";
export {
  distanceBetweenDocks,
  getDock,
  getDocksOfSystem,
  getPlanet,
  getPlanetsOfSystem,
  getSystem,
  hasDock,
  listSystemsNear,
  parseDockId,
  startDockOf,
} from "./lookup";
export { boardPeriodOf, generateJobBoard, getJobBoard } from "./jobs";
export type { HoldType, Job, JobKind, LoadType, SpecialJobData } from "./jobs";
export { summarizeSurveys, surveySeed } from "./survey";
export type { SeedSurvey, SurveyOptions, SurveySummary } from "./survey";
