// Funny lines shown after a delivery. Add or edit lines freely.
// {item} = what you hauled, {amount} = how many, {place} = where you arrived.

export const DEBRIEF_LINES: string[] = [
  "The customer at {place} counted the {item} twice, shrugged, and paid you anyway.",
  "{amount} units of {item} delivered. Only a few of them tried to escape.",
  "{place} thanks you for the {item}. Nobody there remembers ordering it.",
  "Smooth trip. The ship only made the scary noise twice.",
  "You handed over the {item}. The dockmaster handed you a coffee. Fair trade.",
  "Delivery complete. The {item} smelled better on the way out than on the way in.",
  "A very small robot signed for the {item} with a very big pen.",
  "At {place} they cheered for the {item}. You are not sure why.",
  "Cargo bay empty, wallet fuller. The ship hums a little tune.",
  "The paperwork for the {item} was longer than the flight itself.",
];

// Lines for passenger jobs. {amount} = how many people, {item} = the group, {place} = where you arrived.
export const PASSENGER_DEBRIEF_LINES: string[] = [
  "The {item} left the ship in a much better mood than they boarded. Nobody mentions the snack incident.",
  "{amount} {item} waved goodbye at {place}. One of them left a very small tip.",
  "The {item} rated the flight five stars. Two of those stars were for the legroom.",
  "At {place} the {item} asked if the ship could also go back. It can. It will cost extra.",
  "All {amount} passengers arrived. Most of the luggage arrived with them.",
  "The {item} sang the whole way. You now know all the words.",
];

// Lines for tours. {stops} = the places you "visited" on the way, {place} = the last stop.
export const TOUR_DEBRIEF_LINES: string[] = [
  "Tour complete! You waved at {stops} on the way to {place}. The guests took 400 photos.",
  "The {item} saw {stops} out of the window and declared the tour a triumph. {place} was the finale.",
  "Everyone clapped at {place}. Along the way: {stops}. The gift shop was imaginary but the souvenirs are real.",
  "Scenic route done: {stops}, then {place}. The {item} want a refund and a second helping.",
  "You flew straight to {place}, but the commentary covered {stops} very convincingly.",
];

// Lines for the free emergency refuel. {amount} = fuel given.
export const EMERGENCY_LINES: string[] = [
  "The dock manager feels sorry for you and tops up {amount} fuel. \"Don't tell anyone,\" she says.",
  "A kind mechanic rolls over a barrel and pours in {amount} fuel. \"On the house,\" he sighs.",
  "The dockmaster squints at your empty tank and gives you {amount} fuel. \"Go earn something,\" he says.",
  "A tiny robot trundles up with {amount} fuel and a look of pity. It beeps softly.",
  "You get {amount} free fuel and a pat on the hull. The dock cat watches, unimpressed.",
];

// Lines for ranking up. {rank} = the new rank name, {kind} = the kind of job (cargo, passengers, tours).
export const RANK_UP_LINES: string[] = [
  "RANK UP! You are now a {rank} in {kind}. Someone printed you a very small certificate.",
  "New rank in {kind}: {rank}. Your mum has been told. She is mildly impressed.",
  "Ding! {rank}. The {kind} guild has given you a hat. It is not a good hat.",
  "You are now a {rank} ({kind}). Nothing changes, except you feel slightly taller.",
];

// Lines for buying an outpost. {name} = the outpost, {price} = what it cost.
export const OUTPOST_LINES: string[] = [
  "You own {name} now. It cost {price} credits and comes with a doormat that says HOME.",
  "{name} is yours for {price} credits. The previous owner left one sock and a lot of dust.",
  "Congratulations, landlord! {name} cost {price} credits. The kettle works. Probably.",
  "Signed, stamped, paid ({price} credits). {name} is your home base.",
];

// Lines for buying a ship upgrade. {ship} = the ship, {upgrade} = the track name, {level} = the new level.
export const UPGRADE_LINES: string[] = [
  "The {ship} now has {upgrade} level {level}. A mechanic polished it and kept the leftover bolts as a souvenir.",
  "{upgrade} level {level} fitted to the {ship}. It purrs. Slightly louder than before, but it purrs.",
  "Done! {upgrade} {level} for the {ship}. The invoice was longer than the manual.",
  "The {ship} proudly wears {upgrade} level {level}. It would like you to notice.",
  "Level {level} {upgrade} installed. The {ship} did a tiny happy wobble on the pad.",
];

// Free travel (no job). Shown after arriving at a dock without a job. {place} = the dock's name.
export const DOCK_VISIT_LINES: string[] = [
  "No cargo, no pay, just vibes. {place} waves politely.",
  "You dropped by {place} for no reason at all. The dockmaster respects that.",
  "{place} was not expecting visitors. A small robot offers you a biscuit anyway.",
  "A leisurely trip to {place}. The ship enjoyed the scenery more than you did.",
  "Docked at {place}. Nobody asked what you are doing here. Best kind of place.",
];

// Free travel to a planet with no dock. {place} = the planet's name.
export const SCENERY_LINES: string[] = [
  "You parked above {place} and looked out of the window for a while. Very relaxing. Nobody here to sell you anything.",
  "{place} is quiet, round and has no dock. You wave at it anyway.",
  "Just you, the stars and {place}. The ship purrs softly.",
  "No dock on {place}, so no coffee. The view makes up for it.",
  "You float near {place}. A faraway moon winks. You wink back.",
];

// What you are told when you try to do dock things while floating in space. {place} = the planet's name.
export const IN_SPACE_LINES: string[] = [
  "There is nobody at {place} to talk to. Fly to a dock first.",
  "{place} has no dock. The planet politely declines your business.",
  "You shout your request at {place}. The silence is very, very large. Fly to a dock first.",
  "No counter, no clerk, no coffee at {place}. A dock would help.",
];

// What you are told when you are already flying and try something that needs you to stay put.
export const FLYING_LINE = "You are flying right now. Wait until you arrive.";
