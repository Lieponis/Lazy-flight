// WORD LISTS for names. Plain lists of words in quotes, separated by commas.
// You can add, remove or change words freely. Keep the quotes and commas.
// Note: changing a list changes the names of the universe for every seed.
// Keep every list with at least one word.

/** Star systems are built from: START + MIDDLE (optional) + END, e.g. "Zor" + "ba" + "lon" = "Zorbalon". */
export const SYSTEM_STARTS = [
  "Zor", "Bim", "Quo", "Fiz", "Gro", "Pla", "Mox", "Wib", "Tan", "Ko",
  "Snu", "Yar", "Dro", "Lum", "Vee", "Hob", "Nib", "Cra", "Jol", "Pep",
  "Sab", "Tuk", "Orb", "Ful", "Mog", "Zin", "Bra", "Eko", "Dul", "Rux",
];

export const SYSTEM_MIDDLES = [
  "ba", "li", "mo", "ta", "ro", "ni", "fu", "ga", "pi", "do", "ze", "wa",
];

export const SYSTEM_ENDS = [
  "lon", "dar", "mu", "tis", "pex", "nia", "bo", "gus", "rix", "wick",
  "ton", "zel", "thus", "ky", "mar", "dle", "boo", "sia", "ploo", "vik",
];

/** Sometimes added after a system name, e.g. "Zorbalon Prime". */
export const SYSTEM_SUFFIXES = [
  "Prime", "Major", "Minor", "Reach", "Gap", "Drift", "Cluster", "Hollow", "Junction", "Deep",
];

/** Sometimes a planet gets a friendly nickname instead of a number. */
export const PLANET_NICKNAMES = [
  "Big Marge", "Old Reliable", "Sir Roundsworth", "Gloopworth", "Mildred", "Bouncy",
  "The Marble", "Lord Pebble", "Sleepy Susan", "Grumbleton", "Wobbles", "Captain Crater",
  "Little Dave", "Mount Nope", "Cosy Rock", "Bubbles", "Pudding", "Moonface",
  "Nibbles", "Doughnut", "Biscuit", "Professor Dust", "Mr Spinny", "Gentle Giant",
];

/** Docks on a planet's surface: "<WORD> <NOUN> Outpost". */
export const OUTPOST_ADJECTIVES = [
  "Dusty", "Cosy", "Lonely", "Windy", "Sunny", "Muddy", "Cheerful", "Crooked", "Sleepy", "Lucky",
  "Rusty", "Humble", "Breezy", "Rumbly", "Dozy", "Wobbly",
];

export const OUTPOST_NOUNS = [
  "Gulch", "Flats", "Ridge", "Crossing", "Hollow", "Mesa", "Creek", "Corner", "Bluff", "Camp",
  "Junction", "Hill", "Basin", "Meadow", "Cove", "Pass",
];

/** Orbiting docks: "<WORD> <NOUN> Station". */
export const STATION_ADJECTIVES = [
  "Shiny", "Tilted", "Friendly", "Humming", "Spinning", "Snug", "Grand", "Polite", "Starlit", "Bumpy",
  "Cheesy", "Rattling", "Golden", "Fluffy", "Gleaming", "Merry",
];

export const STATION_NOUNS = [
  "Biscuit", "Lantern", "Teapot", "Compass", "Anchor", "Sprocket", "Kettle", "Acorn", "Harbour", "Gizmo",
  "Pudding", "Windmill", "Button", "Marmalade", "Pebble", "Orbit",
];
