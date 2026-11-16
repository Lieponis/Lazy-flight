// The galaxy prototype (stage G1): a spiral disc of about 18 billion systems, nothing stored.
// This folder does not touch the existing universe; it only reuses its random numbers and word lists.

export * from "./params";
export { VERTICAL_AREA, spacingAt, thicknessAt, verticalFactor, armFactor, densityAt, densityPolar, lineIntegralDensity, expectedTotal, expectedCountIn } from "./density";
export type { Vec3 } from "./density";
export { cellTable, cellAddress, cellNumber, slabIndexAt } from "./cells";
export type { Slab, CellTable } from "./cells";
export { START_POINT, START_ANGLE } from "./start";
export { countInCell, findSystemById, nearestSystems, systemsOfCell, systemsWithin, TooManyCellsError } from "./systems";
export type { GalaxySystem, NearSystem, QueryOptions } from "./systems";
export { decodeSystemNumber, encodeSystemNumber, normalizeSystemNumberCode } from "./code";
export { pureNameCount, systemName, systemNumberOfPureName } from "./names";
export type { SystemName } from "./names";
export { expDet, lnDet, sincosDet, SC } from "./detmath";
export { seedToInt } from "./hash";
export { galaxyChecksum } from "./fingerprint";
