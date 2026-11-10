// WHEN to play WHICH sound. Pure logic: no Web Audio, no browser, no clock. Tested in tests/audio.test.ts.
// The audio layer imports nothing from render, ui, game, save or universe: the glue (src/ui/sound.ts) hands it plain numbers.

/** Every sound the game can ask for. Andy chose (2026-11-11): effects style B "soft and smooth", no squeak. */
export type SoundEvent =
  | "click" // every button: a soft keyboard key
  | "kaching" // paid on delivery, or bought a ship / outpost / upgrade
  | "rankup" // a short happy jingle
  | "bonk" // something is blocked ("not enough credits")
  | "blip" // a funny ship-computer line appears
  | "refuel" // glug-glug
  | "takeoff" // engines roar
  | "whooshOut" // leaving the dock
  | "warpIn" // the warp flash: a vacuum implosion
  | "warpOut" // whoosh out of warp
  | "approach" // engines wind down
  | "whooshIn"; // whoosh into the station / onto the pad

/** How loud each sound is, before the player's effects volume (0 to 1). The quiet ones are the frequent ones. */
export const SOUND_LEVELS: Readonly<Record<SoundEvent, number>> = {
  click: 0.45,
  kaching: 0.7,
  rankup: 0.6,
  bonk: 0.55,
  blip: 0.35,
  refuel: 0.6,
  takeoff: 0.75,
  whooshOut: 0.7,
  warpIn: 0.85,
  warpOut: 0.7,
  approach: 0.7,
  whooshIn: 0.7,
};

export const ALL_SOUNDS = Object.keys(SOUND_LEVELS) as SoundEvent[];

// ------------------------------------------------------------------ mood (music + engine bed)

/** docked: music quiet + calm idle engine hum. flight: music quiet, no bed (launch / approach have their own sounds). warp: music deeper + warp hum. */
export type Mood = "docked" | "flight" | "warp";

export type Phase = "LAUNCH" | "WARP" | "APPROACH" | "DONE";

export function moodFor(flying: boolean, phase: Phase | null): Mood {
  if (!flying || phase === null || phase === "DONE") return "docked";
  return phase === "WARP" ? "warp" : "flight";
}

// ------------------------------------------------------------------ flight cues

/** The three phase lengths of one trip, in real seconds (the same split the flight screen uses). */
export interface PhaseLengths {
  launch: number;
  warp: number;
  approach: number;
}

export interface Cue {
  sound: SoundEvent;
  /** Real seconds from now until the sound should START (0 or more). */
  delay: number;
  /** For sounds that last as long as a phase (take-off roar, wind-down): how long, in seconds. */
  length?: number;
}

/** How early cues are looked for, so a 250 ms clock tick never makes a sound late. */
export const CUE_LOOKAHEAD_S = 0.35;
/** A cue whose moment passed longer ago than this is skipped (tab came back, page opened mid-flight). */
export const CUE_STALE_S = 0.6;
/** The warp flash's inhale lasts this long before the implosion, which must land on the flash. */
export const WARP_INHALE_S = 0.72;

/** The moments (seconds since take-off) of every flight sound for one trip. */
export function flightMoments(p: PhaseLengths): { at: number; cue: Omit<Cue, "delay"> }[] {
  const L = Math.max(0, p.launch);
  const W = Math.max(0, p.warp);
  const A = Math.max(0, p.approach);
  const list: { at: number; cue: Omit<Cue, "delay"> }[] = [];
  if (L > 0) {
    list.push({ at: 0, cue: { sound: "takeoff", length: Math.max(1, L - WARP_INHALE_S) } });
    list.push({ at: L * 0.45, cue: { sound: "whooshOut" } });
  }
  list.push({ at: Math.max(0, L - WARP_INHALE_S), cue: { sound: "warpIn" } });
  if (W > 1.2) list.push({ at: L + W - 0.7, cue: { sound: "warpOut" } });
  if (A > 0) {
    list.push({ at: L + W, cue: { sound: "approach", length: Math.max(1, A * 0.75) } });
    list.push({ at: L + W + A * 0.72, cue: { sound: "whooshIn" } });
  }
  return list.sort((a, b) => a.at - b.at);
}

/**
 * The cues to start now. `before` = seconds since take-off at the previous check (null = we just joined this flight:
 * the page opened or the trip just started), `now` = seconds since take-off now.
 * A cue fires once: when its moment enters the window (before + lookahead, now + lookahead].
 * Just joined: only cues whose moment is between now - CUE_STALE_S and now + lookahead (so a fresh take-off still roars,
 * but opening the page in the middle of a warp plays nothing).
 */
export function flightCues(p: PhaseLengths, before: number | null, now: number): Cue[] {
  const hi = now + CUE_LOOKAHEAD_S;
  let lo: number;
  if (before === null || before > now) lo = now - CUE_STALE_S;
  else lo = Math.max(before + CUE_LOOKAHEAD_S, now - CUE_STALE_S);
  const out: Cue[] = [];
  for (const m of flightMoments(p)) {
    const inWindow = before === null || before > now ? m.at >= lo && m.at <= hi : m.at > lo && m.at <= hi;
    if (inWindow) out.push({ ...m.cue, delay: Math.max(0, m.at - now) });
  }
  return out;
}

/** The cockpit shows a new funny line every `cycle` seconds, starting `offset` seconds into each cycle (15 s status + 10 s message). */
export function funnyLineStarted(before: number | null, now: number, offset = 15, cycle = 25): boolean {
  if (before === null || before >= now || now - before > 2) return false;
  const k = (t: number): number => Math.floor((t - offset) / cycle);
  return now >= offset && k(now) > k(before);
}

// ------------------------------------------------------------------ money and fuel changes

/** What a change in credits and fuel (while docked, no new delivery) sounds like. */
export function changeSound(credits: { before: number; after: number }, fuel: { before: number; after: number }, sameShip: boolean): SoundEvent | null {
  const fuelUp = sameShip && fuel.after > fuel.before + 1e-9;
  if (fuelUp) return "refuel"; // paid refuel or free emergency fuel
  if (credits.after < credits.before - 1e-9 && (!sameShip || fuel.after >= fuel.before - 1e-9)) return "kaching"; // bought something
  return null; // accepting a job burns fuel and costs nothing: no money sound
}
