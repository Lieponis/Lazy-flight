// The front door of the universe generator. Other parts of the project import from here only:
//   import { nearestSystems, nearestDocks, findDockById, getMarket, getJobBoard, startDockOf } from "../universe";

export * from "./settings";
export { hashString, hashUnit, mulberry32, rngFor, Rng } from "./random";
export type { Seed } from "./random";
export {
  distance,
  distanceBetweenSystems,
  getSite,
  isLegacyId,
  nearestSites,
  parseSystemId,
  sitesWithin,
} from "./sites";
export type { NearSite, SystemSite, Vec3 } from "./sites";
// The galaxy itself (shape, density, cells, codes). The other layers mostly need only the numbers below.
export {
  ARM_COUNT,
  DISC_RADIUS,
  START_ANGLE,
  START_POINT,
  armFactor,
  decodeSystemNumber,
  densityAt,
  encodeSystemNumber,
  expectedTotal,
  galaxyChecksum,
  lineIntegralDensity,
  normalizeSystemNumberCode,
  spacingAt,
  thicknessAt,
  TooManyCellsError,
} from "./galaxy";
export { PURE_NAMES, pureNameCount, pureNameOf, systemIdOfPureName } from "./purenames";
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
  findDockById,
  findPlanetById,
  findSystemById,
  findSystemByName,
  getDock,
  getDocks,
  getDocksOfSystem,
  getPlanet,
  getPlanets,
  getPlanetsOfSystem,
  getSystem,
  hasDock,
  nearestDocks,
  nearestSystems,
  parseDockId,
  parsePlanetId,
  planetIdOf,
  startDockOf,
  startSystem,
  systemsWithin,
} from "./lookup";
export type { NearDock, NearSystem } from "./lookup";
export { NearCache } from "./near";
export { boardPeriodOf, generateJobBoard, getJobBoard } from "./jobs";
export type { HoldType, Job, JobKind, LoadType, SpecialJobData } from "./jobs";
export { summarizeSurveys, surveySeed } from "./survey";
export type { SeedSurvey, SurveyOptions, SurveySummary } from "./survey";
export { nameStats } from "./namestats";
export type { NameStats } from "./namestats";
