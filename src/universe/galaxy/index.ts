// The galaxy: a spiral disc of about 18 billion systems, nothing stored (stage G1 prototype, universe v3 since G3).
// This folder only knows WHERE systems are and which system numbers exist. Names, planets and docks are built on top of it.

export * from "./params";
export { VERTICAL_AREA, spacingAt, thicknessAt, verticalFactor, armFactor, densityAt, densityPolar, discDensityAt, bulgeDensity, bulgeProfile, bulgeDistance, expectedBulgeTotal, lineIntegralDensity, expectedTotal, expectedCountIn } from "./density";
export { bulgeTable, bulgeCellAddress, bulgeCellNumber, findBulgeSystemById } from "./bulge";
export type { BulgeTable, BulgeLevel, BulgeCellAddress } from "./bulge";
export type { Vec3 } from "./density";
export { cellTable, cellAddress, cellNumber, slabIndexAt } from "./cells";
export type { Slab, CellTable } from "./cells";
export { START_POINT, START_ANGLE } from "./start";
export { countInCell, findSystemById, nearestSystems, systemsOfCell, systemsWithin, TooManyCellsError } from "./systems";
export type { GalaxySystem, NearSystem, QueryOptions } from "./systems";
export { decodeSystemNumber, encodeSystemNumber, normalizeSystemNumberCode } from "./code";
export { expDet, lnDet, sincosDet, SC } from "./detmath";
export { seedToInt } from "./hash";
export { galaxyChecksum } from "./fingerprint";
