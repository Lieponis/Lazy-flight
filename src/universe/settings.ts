// All the tuning numbers of the universe generator live here, in one easy place.
// Change a number, and the whole universe adapts (the same seed will then give a
// different universe, so only change these on purpose).

/**
 * THE world seed: the one shared universe. Everyone plays in this universe and it must not be changed
 * (changing it would give every player a different universe and break all saves).
 * The generator still works for any other seed (tests and developer pages use that); only this one is "the" universe.
 */
export const WORLD_SEED = 12345;

/** Size of one cube of space in light years. The galaxy is an endless grid of these cubes. */
export const SECTOR_SIZE = 10;

/**
 * THE distance limit for jobs, in light years. A job's destination (and every stop of a tour)
 * is never farther than this from the dock that offers the job.
 * Agent 4 will turn this distance into travel time (max trip: 4 hours).
 */
export const MAX_JOB_DISTANCE = 25;

/** How many offers a job board shows. */
export const JOBS_PER_BOARD = 6;

/**
 * How many time slots (1 slot = 1 universe hour) a job board stays the same before it refreshes.
 * Set to 1 if you want a brand new board every hour.
 */
export const JOB_BOARD_REFRESH_SLOTS = 6;

/**
 * Version of the universe rules. It was 1 when every planet had a dock and systems had 1 to 8 planets.
 * Version 2: systems have 1 to 10 planets and only some planets have a dock (1 to 3 per system).
 * Anything that stores progress should store this number, so older progress can be recognised.
 */
export const UNIVERSE_VERSION = 2;

/** Planets per system: 1 to 10. */
export const MIN_PLANETS = 1;
export const MAX_PLANETS = 10;

/**
 * Docks per system: a system with N planets can have at most round(N / DOCK_PLANETS_PER_DOCK) docks,
 * never fewer than 1 and never more than MAX_DOCKS_PER_SYSTEM. The real number is a random whole number
 * from 1 up to that limit (decided once per system by the seed).
 */
export const DOCK_PLANETS_PER_DOCK = 3.3;
export const MAX_DOCKS_PER_SYSTEM = 3;

/** Prices never go below / above these fractions of a good's base price. */
export const MIN_PRICE_MULTIPLIER = 0.4;
export const MAX_PRICE_MULTIPLIER = 2.5;

/** Tours visit this many stops. */
export const TOUR_MIN_STOPS = 2;
export const TOUR_MAX_STOPS = 3;

/**
 * Names that are just words, like "Lazy Harbour" (no code), exist only in a cube of sectors around the origin:
 * sector numbers from -PURE_NAME_REGION to PURE_NAME_REGION - 1 on every axis (19 means about 190 light years each way).
 * About 7 of every 100 systems inside that cube get one. Farther away every system has a name with a code, like "Kopipex 4F-92".
 */
export const PURE_NAME_REGION = 19;

/** Longest names the generator can make (checked by a test). */
export const MAX_SYSTEM_NAME_LENGTH = 42;
export const MAX_PLANET_NAME_LENGTH = 47;
export const MAX_DOCK_FULL_NAME_LENGTH = 75;
