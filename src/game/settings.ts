// ALL THE GAME-RULE NUMBERS LIVE HERE. Change a number, save, and the rules change.
// (Universe numbers, like how far a job can be, are in src/universe/settings.ts.)

/** Credits you start with. */
export const STARTING_CREDITS = 200;

/** Which ship you start with (see ships.ts). */
export const STARTER_SHIP_ID = "cargo-hauler";

// ---------------------------------------------------------------- FUEL

/**
 * Fuel used per light year flown. A 10 ly trip burns 10 x this number.
 * With 2: the longest normal trip (25 ly) burns 50 fuel.
 */
export const FUEL_PER_LY = 2;

/** Even a trip inside the same system burns at least this much fuel. */
export const MIN_FUEL_PER_TRIP = 1;

/** Credits you pay for ONE unit of fuel at any dock (the same everywhere for now). */
export const REFUEL_PRICE_PER_UNIT = 2;

// ---------------------------------------------------------------- TRAVEL TIME

/**
 * Real-world seconds of travel per light year (at normal speed).
 * 480 = 8 minutes per light year, so 25 ly = 3 hours 20 minutes.
 */
export const TRAVEL_SECONDS_PER_LY = 480;

/**
 * Seconds a trip inside the same system takes (so you can see something happen).
 * A trip between systems takes this PLUS the distance time.
 */
export const SAME_SYSTEM_TRIP_SECONDS = 20;

/** HARD RULE: no trip ever takes longer than this (4 hours), however far it is. */
export const MAX_TRIP_SECONDS = 4 * 60 * 60;

// ---------------------------------------------------------------- TESTING AID

/**
 * Add ?speed=60 to the web address and game time runs 60 times faster
 * (one real second counts as one minute). This is the largest speed allowed.
 */
export const MAX_SPEED = 100000;
