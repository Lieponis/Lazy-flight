// System codes: a short text that stands for exactly one system, like "4F-92" in "Kopipex 4F-92".
//
// In plain words:
//  - Every system has an address of four whole numbers: sector x, y, z (they can be negative and as big as you like)
//    and a number 0 to 2 inside the sector. This module turns that address into a short code and back again.
//  - It is a one-to-one match ("bijection"): two different systems never get the same code, and every valid code
//    stands for exactly one address. So names that contain the code can never repeat.
//  - Codes use only these 17 symbols: the digits 2-9 and the letters D H J M N P R T V.
//    No 0, 1, O, I, L (they look alike) and no vowels (so a code can never spell a word).
//  - Systems near the home point get short codes (4 symbols), systems far away get longer ones.
//
// How it works (for the curious): the three sector numbers are made non-negative ("zigzag"), their bits are woven
// together ("Morton code") into one big number, multiplied by 3 plus the number inside the sector. That number is
// shuffled with a fixed formula that keeps it in the same length class, written with the 17 symbols, and split by a hyphen.

import { parseSystemId, systemIdOf } from "./galaxy";

const ALPHABET = "23456789DHJMNPRTV";
const BASE = 17n;
/** Codes are never shorter than this (before the hyphen is added). */
const MIN_LENGTH = 4;
/** Fixed shuffle numbers: A is odd and not a multiple of 17, so the shuffle can be undone. */
const SCRAMBLE_A = 7919n;
const SCRAMBLE_C = 3571n;
/** A sector holds at most this many systems (numbers 0 to 2). */
const SYSTEMS_PER_SECTOR = 3n;

function zigzag(n: number): bigint {
  return n >= 0 ? 2n * BigInt(n) : -2n * BigInt(n) - 1n;
}

function unzigzag(z: bigint): number | null {
  const v = z % 2n === 0n ? z / 2n : -(z + 1n) / 2n;
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < -BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(v);
}

function morton3(x: bigint, y: bigint, z: bigint): bigint {
  let result = 0n;
  let shift = 0n;
  while (x > 0n || y > 0n || z > 0n) {
    result |= ((x & 1n) << (3n * shift)) | ((y & 1n) << (3n * shift + 1n)) | ((z & 1n) << (3n * shift + 2n));
    x >>= 1n;
    y >>= 1n;
    z >>= 1n;
    shift++;
  }
  return result;
}

function unMorton3(m: bigint): [bigint, bigint, bigint] {
  let x = 0n;
  let y = 0n;
  let z = 0n;
  let shift = 0n;
  while (m > 0n) {
    x |= (m & 1n) << shift;
    y |= ((m >> 1n) & 1n) << shift;
    z |= ((m >> 2n) & 1n) << shift;
    m >>= 3n;
    shift++;
  }
  return [x, y, z];
}

/** Length classes: codes of length 4 cover 0 up to 17^4, length 5 covers up to 17^5, and so on. */
function classStart(length: number): bigint {
  return length <= MIN_LENGTH ? 0n : BASE ** BigInt(length - 1);
}
function classEnd(length: number): bigint {
  return BASE ** BigInt(length);
}

const inverseCache = new Map<number, bigint>();

function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [a % m, m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % m) + m) % m;
}

function inverseFor(length: number): bigint {
  let inv = inverseCache.get(length);
  if (inv === undefined) {
    inv = modInverse(SCRAMBLE_A, classEnd(length) - classStart(length));
    inverseCache.set(length, inv);
  }
  return inv;
}

function toDigits(n: bigint, length: number): string {
  let text = "";
  let rest = n;
  for (let i = 0; i < length; i++) {
    text = ALPHABET.charAt(Number(rest % BASE)) + text;
    rest /= BASE;
  }
  return text;
}

/** Puts the hyphen in the middle: "4F92" becomes "4F-92". */
function withHyphen(plain: string): string {
  const first = Math.ceil(plain.length / 2);
  return `${plain.slice(0, first)}-${plain.slice(first)}`;
}

/** The code of a system, from its address. Returns null for an address that cannot exist (inner number not 0 to 2). */
export function encodeSystemCode(sx: number, sy: number, sz: number, index: number): string | null {
  if (![sx, sy, sz, index].every(Number.isInteger) || index < 0 || index >= Number(SYSTEMS_PER_SECTOR)) return null;
  const number = morton3(zigzag(sx), zigzag(sy), zigzag(sz)) * SYSTEMS_PER_SECTOR + BigInt(index);
  let length = MIN_LENGTH;
  while (number >= classEnd(length)) length++;
  const start = classStart(length);
  const size = classEnd(length) - start;
  const scrambled = start + ((SCRAMBLE_A * (number - start) + SCRAMBLE_C) % size);
  return withHyphen(toDigits(scrambled, length));
}

/** The code of a system from its id like "3:-2:5:0". Null if the id is not valid. */
export function systemCodeOfId(systemId: string): string | null {
  const known = codeCache.get(systemId);
  if (known !== undefined) return known;
  const parsed = parseSystemId(systemId);
  const code = parsed ? encodeSystemCode(parsed.sx, parsed.sy, parsed.sz, parsed.index) : null;
  if (code !== null) {
    if (codeCache.size > 50000) codeCache.clear();
    codeCache.set(systemId, code); // the same systems are asked for again and again (BigInt maths is slow)
  }
  return code;
}

const codeCache = new Map<string, string>();

/** Cleans what a person typed: capitals, no spaces or hyphens. Null if a symbol is not one of the 17. */
export function normalizeSystemCode(text: string): string | null {
  const plain = text.toUpperCase().replace(/[\s-]/g, "");
  if (plain.length < MIN_LENGTH) return null;
  for (const ch of plain) if (!ALPHABET.includes(ch)) return null;
  return plain;
}

/**
 * Turns a code back into the system id, like "3:-2:5:0". Works for any valid code, with or without hyphen,
 * in capitals or not. Returns null if the text is not a valid code. (It does not check that the system exists.)
 */
export function decodeSystemCode(code: string): string | null {
  const plain = normalizeSystemCode(code);
  if (plain === null) return null;
  const length = plain.length;
  let value = 0n;
  for (const ch of plain) value = value * BASE + BigInt(ALPHABET.indexOf(ch));
  const start = classStart(length);
  if (value < start || value >= classEnd(length)) return null; // a longer code padded with leading zero symbols
  const size = classEnd(length) - start;
  const offset = (((inverseFor(length) * (value - start - SCRAMBLE_C)) % size) + size) % size;
  const number = start + offset;
  const index = Number(number % SYSTEMS_PER_SECTOR);
  const [zx, zy, zz] = unMorton3(number / SYSTEMS_PER_SECTOR);
  const sx = unzigzag(zx);
  const sy = unzigzag(zy);
  const sz = unzigzag(zz);
  if (sx === null || sy === null || sz === null) return null;
  return systemIdOf(sx, sy, sz, index);
}
