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
 * 60 = 1 minute per light year, so 25 ly = about 25 minutes (a 3-stop tour of up to 75 ly about 75 minutes).
 * Was 480 (8 minutes per ly); changed 2026-11-09 by Andy's decision after the Agent 6b balance pass.
 */
export const TRAVEL_SECONDS_PER_LY = 60;

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

// ---------------------------------------------------------------- SAFETY NET

/**
 * Fuel the dock gives you for free when you are STUCK (cannot take any job that fits your ship
 * because of fuel, even if you spent all your credits on fuel). Never fills past the tank.
 */
export const EMERGENCY_REFUEL_AMOUNT = 20;

// ---------------------------------------------------------------- RANKS (one set of ranks per job kind)

/**
 * How many jobs of a kind you must have DELIVERED to reach rank 2 and rank 3 in that kind.
 * { TRADE: [4, 12] } = rank 2 after 4 cargo jobs, rank 3 after 12.
 */
export const RANK_JOBS_NEEDED: Record<"TRADE" | "PASSENGER" | "TOUR", [number, number]> = {
  TRADE: [4, 12],
  PASSENGER: [3, 8],
  TOUR: [2, 6],
};

/**
 * The biggest reward (credits) of a job you may take at rank 1 and at rank 2. Rank 3 takes any job.
 * Better-paying jobs need a higher rank. (The reward counted here is the plain one, before bonuses.)
 */
export const RANK_MAX_REWARD: Record<"TRADE" | "PASSENGER" | "TOUR", [number, number]> = {
  TRADE: [800, 1500],
  PASSENGER: [900, 1400],
  TOUR: [2000, 4000],
};

/** Extra pay (percent of the reward) at rank 1, 2 and 3 of that job kind. */
export const RANK_REWARD_BONUS_PERCENT: [number, number, number] = [0, 5, 10];

// ---------------------------------------------------------------- OUTPOSTS (a home base you can buy)

/**
 * Outpost prices come from the universe (every surface outpost has one). This multiplies them:
 * 1 = as generated, 0.5 = half price, 2 = double. Stations are never for sale.
 */
export const OUTPOST_PRICE_FACTOR = 1;

/**
 * PERK 1, cheaper fuel: if you own an outpost in a star system, refuelling at EVERY dock of that system
 * costs this many percent less.
 */
export const OUTPOST_FUEL_DISCOUNT_PERCENT = 20;

/**
 * PERK 2, bonus pay: jobs that END at any dock of a system where you own an outpost pay this many
 * percent extra.
 */
export const OUTPOST_DELIVERY_BONUS_PERCENT = 10;

// ---------------------------------------------------------------- SHIP UPGRADES (4 tracks, 5 levels, per ship)

/** Highest level of every upgrade track (level 0 = the ship as it comes from the shipyard). */
export const UPGRADE_MAX_LEVEL = 5;

/** Credits for level 1, 2, 3, 4 and 5 of a track (the same for every track and every ship). */
export const UPGRADE_PRICES: [number, number, number, number, number] = [1500, 4000, 9000, 18000, 35000];

/** FUEL TANK track: every level makes the tank this many percent bigger (of the ship's base tank). */
export const UPGRADE_TANK_PERCENT_PER_LEVEL = 10;

/** HOLD / CABIN track: every level makes the cargo bay AND the cabin this many percent bigger. A ship with no cabin stays without one. */
export const UPGRADE_HOLD_PERCENT_PER_LEVEL = 10;

/** EFFICIENT ENGINES track: every level burns this many percent less fuel per light year. */
export const UPGRADE_ENGINE_PERCENT_PER_LEVEL = 6;

/** PASSENGER COMFORT track: every level adds this many percent pay on passenger and tour jobs (added to the rank and outpost bonuses). */
export const UPGRADE_COMFORT_PERCENT_PER_LEVEL = 6;

/**
 * When an old save (universe version 1) is moved to a rebuilt universe, each outpost it owned is refunded:
 * the price paid if the save stored it, otherwise this flat amount (old prices ran from about 5,000 to 40,000).
 */
export const OUTPOST_REFUND_ESTIMATE = 20000;

// ---------------------------------------------------------------- FREE TRAVEL AND EXPLORING (stage F1)

/**
 * Discovery credits: the FIRST time you arrive in a star system (by free travel or by a job) you are paid a
 * number from MIN to MAX credits (the same number every time for the same system and seed). Once per system, ever.
 */
export const DISCOVERY_MIN_CREDITS = 50;
export const DISCOVERY_MAX_CREDITS = 100;

/**
 * Explorer rank. "Discoveries" = star systems explored + planets (docks and scenery planets) arrived at.
 * { [50, 200] } = rank 2 (Cartographer) at 50 discoveries, rank 3 (Mr Galaxy-wide) at 200. Andy chose these (option B).
 */
export const EXPLORER_DISCOVERIES_NEEDED: [number, number] = [50, 200];

/** Extra percent on discovery credits at Explorer rank 1, 2 and 3. It never changes job pay. */
export const EXPLORER_DISCOVERY_BONUS_PERCENT: [number, number, number] = [0, 10, 20];

/**
 * Safety limit for the explored list in the save: at most this many star systems are remembered
 * (about 20 bytes each, so well under 1 MB). Reaching it takes over 1,000 hours of play; after it, new systems
 * simply are not recorded.
 */
export const MAX_EXPLORED_SYSTEMS = 20000;

// ---------------------------------------------------------------- PAINT JOBS (liveries, stage 4g)

/** Price of every extra paint job, in credits (Andy chose 500, 2026-11-11). The "standard" paint is always free. */
export const LIVERY_PRICE = 500;
