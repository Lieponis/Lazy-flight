// All the numbers that shape the galaxy prototype, in one place. Light years (ly) everywhere.
// The disc lies in the x-z plane (y is up). The centre of the galaxy is (0, 0, 0).

/** Radius of the disc: 50,000 ly, so 100,000 ly across. */
export const DISC_RADIUS = 50000;

/** Average spacing between neighbouring systems in the middle of the disc plane, at the centre and at the rim. */
export const CENTRE_SPACING = 1.8;
export const RIM_SPACING = 160;

/** Full thickness of the disc (where systems exist) at the centre and at the rim. */
export const THICKNESS_CENTRE = 2000;
export const THICKNESS_RIM = 500;

/** Spiral arms: number of arms, how much denser an arm is (0.75 = 1.75 times the average, 0.25 times between arms). */
export const ARM_COUNT = 4;
export const ARM_STRENGTH = 0.75;
/** tan(pitch angle) of the log spiral: 0.27 is about 15 degrees. */
export const ARM_PITCH_TAN = 0.27;
/** Arms fade in between these distances from the centre (the middle is a round bulge). */
export const ARM_FADE_FROM = 1500;
export const ARM_FADE_TO = 5000;
/** The arm spiral is measured from this radius. */
export const ARM_R0 = 1500;

/** The player starts one third of the way from the centre to the rim, on an arm. */
export const START_RADIUS = DISC_RADIUS / 3;

/** A cell is about this many times the local spacing on each side (so about 4 systems per cell). */
export const CELL_SCALE = 1.6;

/** Share of systems that are "odd": placed very close to a neighbour (twin) or anywhere in their cell (wanderer). */
export const ODD_TWIN = 0.015;
export const ODD_WANDER = 0.015;

/** Pure names (no code) are owned by systems in a box this many ly around the start. */
export const PURE_REGION = 150;

/**
 * THE CENTRAL BULGE (stage G7). A thick, roundish ball of extra systems around the centre of the galaxy. It is a second,
 * separate set of systems ("bulge systems") with their own cells and their own system numbers (numbered after every
 * disc number), so no disc system anywhere is changed. It fades to exactly nothing at `radius`.
 *   radius   : the bulge ends here (ly). Must stay well below 8,000 ly (the start region is 16,500 ly out).
 *   flatten  : height of the bulge divided by its width (1 = a perfect ball, 0.8 = a little flattened).
 *   scale    : the core radius (ly): density is about half of the peak at about this distance.
 *   peak     : bulge density at the very centre, in systems per cubic ly (added to the disc density there).
 */
export interface BulgeShape {
  radius: number;
  flatten: number;
  scale: number;
  peak: number;
}

/** Disc density at the very centre (systems per cubic ly), the yardstick for the bulge peak. */
const CENTRE_DENSITY = 1 / (CENTRE_SPACING * CENTRE_SPACING * CENTRE_SPACING);

/** The three sizes shown to Andy (picture options A, B, C). */
export const BULGE_OPTIONS: Record<"A" | "B" | "C", BulgeShape> = {
  A: { radius: 2000, flatten: 0.9, scale: 500, peak: 0.8 * CENTRE_DENSITY },
  B: { radius: 3500, flatten: 0.9, scale: 875, peak: 0.8 * CENTRE_DENSITY },
  C: { radius: 5500, flatten: 0.9, scale: 1375, peak: 0.8 * CENTRE_DENSITY },
};

/** The bulge that is built into the galaxy. */
export const BULGE: BulgeShape = BULGE_OPTIONS.B;

/** Bulge cells: a cell is at most this many systems on average (at the inner edge of its zone). */
export const BULGE_WANTED = 4;
/** Bulge cell edges are picked from this list (ly), so they never depend on a cube root. */
export const BULGE_EDGES = [1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];
/** The bulge is cut into zones (3D shells) at these fractions of its radius; each zone has its own cell size. */
export const BULGE_ZONES = [0, 0.1, 0.2, 0.4, 0.7, 1];
