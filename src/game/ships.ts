// Ship definitions. Only the starter ship exists for now.

export interface ShipDef {
  id: string;
  name: string;
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
    cargoCapacity: 30,
    cabinCapacity: 0, // no passengers on this one
    fuelTankSize: 60,
  },
};

export function getShip(id: string): ShipDef {
  const ship = SHIPS[id];
  if (!ship) throw new Error(`Unknown ship: ${id}`);
  return ship;
}
