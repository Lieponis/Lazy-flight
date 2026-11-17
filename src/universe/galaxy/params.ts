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
