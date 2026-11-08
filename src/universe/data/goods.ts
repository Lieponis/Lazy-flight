// THE GOODS of the universe. Each line: id (no spaces, never change it once the universe is in use),
// name (shown to the player), category, and basePrice (credits per unit, before supply and demand).
// You can change names and prices freely. Keep around 16 goods.

export type GoodCategory = "FOOD" | "MATERIALS" | "TECH" | "LUXURY" | "CURIOSITIES";

export interface Good {
  id: string;
  name: string;
  category: GoodCategory;
  basePrice: number;
}

export const GOODS: readonly Good[] = [
  { id: "space_cheese", name: "Space Cheese", category: "FOOD", basePrice: 12 },
  { id: "noodle_nebulas", name: "Noodle Nebulas", category: "FOOD", basePrice: 8 },
  { id: "plasma_tea", name: "Plasma Tea", category: "FOOD", basePrice: 18 },
  { id: "moon_biscuits", name: "Moon Biscuits", category: "FOOD", basePrice: 10 },
  { id: "rubber_asteroids", name: "Rubber Asteroids", category: "MATERIALS", basePrice: 25 },
  { id: "gravity_grease", name: "Gravity Grease", category: "MATERIALS", basePrice: 32 },
  { id: "sparkle_ore", name: "Sparkle Ore", category: "MATERIALS", basePrice: 45 },
  { id: "bendy_steel", name: "Bendy Steel", category: "MATERIALS", basePrice: 38 },
  { id: "cuddly_robots", name: "Cuddly Robots", category: "TECH", basePrice: 90 },
  { id: "pocket_reactors", name: "Pocket Reactors", category: "TECH", basePrice: 140 },
  { id: "beep_boxes", name: "Beep Boxes", category: "TECH", basePrice: 60 },
  { id: "disco_crystals", name: "Disco Crystals", category: "LUXURY", basePrice: 120 },
  { id: "fancy_hats", name: "Fancy Hats", category: "LUXURY", basePrice: 75 },
  { id: "velvet_comets", name: "Velvet Comets", category: "LUXURY", basePrice: 180 },
  { id: "mystery_crates", name: "Mystery Crates", category: "CURIOSITIES", basePrice: 55 },
  { id: "singing_rocks", name: "Singing Rocks", category: "CURIOSITIES", basePrice: 70 },
];

export function getGood(id: string): Good | undefined {
  return GOODS.find((g) => g.id === id);
}
