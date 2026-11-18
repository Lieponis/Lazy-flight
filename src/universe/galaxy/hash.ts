// Fast repeatable "random" numbers from whole numbers (no text, no allocation). Same inputs, same output, everywhere.

import { hashString, type Seed } from "../random";

/** The seed as one 32-bit number. */
export function seedToInt(seed: Seed): number {
  return hashString(`galaxy2|${String(seed)}`);
}

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** One hash for a whole number up to 2^53 (a system number). Use `part` to get more numbers from the same one. */
export function hashNumber(seed32: number, value: number): number {
  const hi = Math.floor(value / 4294967296);
  const lo = value - hi * 4294967296;
  const a = fmix((seed32 ^ Math.imul(lo | 0, 0x9e3779b1)) >>> 0);
  return fmix((a ^ Math.imul((hi + 0x7f4a7c15) | 0, 0x85ebca6b)) >>> 0);
}

/** The part-th random number from 0 (included) to 1 (excluded) belonging to a hash from hashNumber. */
export function partOf(hash: number, part: number): number {
  return fmix((hash + Math.imul(part + 1, 0x9e3779b9)) >>> 0) / 4294967296;
}
