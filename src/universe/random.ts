// Random numbers that are not really random: the same input always gives the same output.
//
// How it works in plain words:
//  - hashString turns any text (like "12345|system|3:4:5:0") into one big whole number.
//    Same text in, same number out. Different text gives a very different number.
//  - mulberry32 is a tiny, well known "random number machine". You start it with one number
//    and it hands out a repeatable stream of numbers between 0 and 1.
//  - rngFor(seed, ...parts) combines the two: it builds a fresh machine from the seed plus a
//    description of WHAT you are generating (layer name + coordinates). Because every thing
//    gets its own fresh machine, generating system B never changes system A.

export type Seed = number | string;

/** Final "scramble" step so similar texts give very different numbers. */
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Turns text into a whole number between 0 and 4294967295 (FNV-1a hash plus a scramble). */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return mix(h);
}

/** Mulberry32: gives a function that returns a repeatable number from 0 (included) to 1 (excluded). */
export function mulberry32(start: number): () => number {
  let a = start >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Handy wrapper with the helpers we need (pick from a list, roll a chance, ...). */
export class Rng {
  private readonly nextRaw: () => number;

  constructor(start: number) {
    this.nextRaw = mulberry32(start);
  }

  /** A number from 0 (included) to 1 (excluded). */
  next(): number {
    return this.nextRaw();
  }

  /** A decimal number between min and max. */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** A whole number between min and max, both included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with the given probability (0.25 = one time in four). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** One random item from a list (the list must not be empty). */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: the list is empty");
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** One item from a list where each item has a weight (bigger weight = more likely). */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    if (items.length === 0) throw new Error("Rng.weighted: the list is empty");
    let total = 0;
    for (const item of items) total += weightOf(item);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weightOf(item);
      if (roll < 0) return item;
    }
    return items[items.length - 1] as T;
  }

  /** A new list with the same items in a random order (the original is not changed). */
  shuffled<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const a = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = a;
    }
    return copy;
  }
}

/** Builds the text that identifies "this seed, this layer, these coordinates". */
function keyOf(seed: Seed, parts: readonly (string | number)[]): string {
  return `${String(seed)}|${parts.join("|")}`;
}

/**
 * A fresh random machine for one specific thing.
 * Example: rngFor(12345, "system", "3:4:5:0") always starts in the same state.
 */
export function rngFor(seed: Seed, ...parts: (string | number)[]): Rng {
  return new Rng(hashString(keyOf(seed, parts)));
}

/** One repeatable number from 0 to 1 for a specific thing (no machine needed). */
export function hashUnit(seed: Seed, ...parts: (string | number)[]): number {
  return hashString(keyOf(seed, parts)) / 4294967296;
}
