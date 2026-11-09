// Ship definitions. The ids match the 3D models of Agent 8: do not rename them.
// All numbers are first guesses; Agent 6 balances them later.

export interface ShipDef {
  id: string;
  name: string;
  /** One line shown in the shipyard. */
  description: string;
  /** Credits to buy it. 0 = the starter ship (you already own it). */
  price: number;
  /** How many units of goods the cargo bay holds. */
  cargoCapacity: number;
  /** How many passengers the cabin holds (0 = no cabin). */
  cabinCapacity: number;
  /** How much fuel the tank holds. */
  fuelTankSize: number;
}

export const SHIPS: Record<string, ShipDef> = {
  "cargo-hauler": {
    id: "cargo-hauler",
    name: "Cargo Hauler",
    description: "A big, boxy freight hauler. Lots of cargo, no seats.",
    price: 0,
    cargoCapacity: 30,
    cabinCapacity: 0, // no passengers on this one
    fuelTankSize: 60,
  },
  "passenger-liner": {
    id: "passenger-liner",
    name: "Passenger Liner",
    description: "Comfy cabin for 12 passengers, with a tiny cargo closet.",
    price: 1500,
    cargoCapacity: 6,
    cabinCapacity: 12,
    fuelTankSize: 100, // was 70; raised by Andy's decision (5b) so more tours fit
  },
  scout: {
    id: "scout",
    name: "Scout",
    description: "Small and thirsty for distance: a huge tank, two seats, a little cargo.",
    price: 1200,
    cargoCapacity: 10,
    cabinCapacity: 2,
    fuelTankSize: 110,
  },
};

/** The order ships are listed in (the shipyard shows them like this). */
export const SHIP_ORDER: string[] = ["cargo-hauler", "passenger-liner", "scout"];

export function getShip(id: string): ShipDef {
  const ship = SHIPS[id];
  if (!ship) throw new Error(`Unknown ship: ${id}`);
  return ship;
}

export function isShipId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(SHIPS, id);
}
