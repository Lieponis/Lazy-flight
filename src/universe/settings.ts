// All the tuning numbers of the universe generator live here, in one easy place.
// Change a number, and the whole universe adapts (the same seed will then give a
// different universe, so only change these on purpose).

/**
 * THE world seed: the one shared universe. Everyone plays in this universe and it must not be changed
 * (changing it would give every player a different universe and break all saves).
 * The generator still works for any other seed (tests and developer pages use that); only this one is "the" universe.
 */
export const WORLD_SEED = 12345;

/**
 * Job destinations are picked BY COUNT: a dock's job board picks its destinations from the JOB_DESTINATION_COUNT nearest
 * OTHER docks (docks in the same system count too). There is no distance limit any more: in the crowded middle of the
 * galaxy the 12 nearest docks are a few light years away, near the rim they can be 100 to 250 light years away.
 * The universe only provides the docks and their distances; the game (Agent 4) decides about reach, fuel and travel time.
 */
export const JOB_DESTINATION_COUNT = 12;

/** A job's time limit grows with the distance: this many extra hours per 10 light years of the whole trip (rounded up). */
export const JOB_LIMIT_HOURS_PER_10_LY = 1;

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
 * Version 3: the spiral galaxy (about 18 billion systems). System ids are plain numbers, planet and dock ids are
 * "<system number>/<planet number>", names carry a 9-symbol code, jobs pick the nearest docks by count.
 * Anything that stores progress should store this number, so older progress can be recognised.
 */
export const UNIVERSE_VERSION = 3;

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

/** Longest names the generator can make (checked by a test). */
export const MAX_SYSTEM_NAME_LENGTH = 29;
export const MAX_PLANET_NAME_LENGTH = 34;
export const MAX_DOCK_FULL_NAME_LENGTH = 62;
