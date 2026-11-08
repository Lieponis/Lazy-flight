// JOB BLURBS: the funny one-liners on the job board.
// You can use these placeholders; they are swapped for real values:
//   {amount}  number of units or passengers
//   {item}    the goods or passenger group
//   {from}    name of the dock offering the job
//   {to}      name of the destination dock
//   {stops}   the list of stops of a tour, e.g. "Cosy Hill Outpost, then Shiny Teapot Station"
// Keep every list with at least one line.

export const TRADE_BLURBS: readonly string[] = [
  "{amount} {item} needed at {to}. Please do not sample the cargo.",
  "{to} is out of {item}. Their breakfast depends on you.",
  "Rush delivery: {amount} {item} for {to}. No rush, really. Okay, a little rush.",
  "A customer at {to} says they have been waiting for {item} since last Tuesday.",
  "Take {amount} {item} to {to}. The crates only rattle a bit.",
  "{to} promised a tiny parade if you deliver the {item}. Tiny.",
  "Haul {item} to {to}. Fragile, fluffy and slightly warm.",
  "Somebody at {to} ordered {amount} {item} and forgot why. Deliver anyway.",
];

export const PASSENGER_BLURBS: readonly string[] = [
  "{amount} {item} need a lift to {to}. They have brought snacks.",
  "Give {amount} {item} a smooth ride to {to}. Please do not mention the bumpy bit.",
  "{amount} {item} are heading to {to} and have asked for a window seat.",
  "A friendly group of {item} ({amount} of them) would love to visit {to}.",
  "{amount} {item} to {to}. They promise to sing only a little.",
  "Passengers: {amount} {item}. Destination: {to}. Mood: delightful.",
];

export const TOUR_BLURBS: readonly string[] = [
  "Grand tour for {amount} {item}: {stops}. Souvenirs are not included.",
  "{amount} {item} want to see the sights: {stops}. Bring a very good attitude.",
  "A scenic trip for {amount} {item}. Stops: {stops}. Photos at every one.",
  "{amount} {item} booked the deluxe tour: {stops}. Snack breaks are expected.",
];
