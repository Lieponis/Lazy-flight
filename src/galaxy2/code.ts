// The short code of a system, like "N2R4-5HJ7". It is a one-to-one (reversible) scrambling of the system number into
// letters and digits that cannot be mixed up (17 symbols: 2-9 and D H J M N P R T V; no vowels, no 0/O/1/I/L/X).
// Short numbers (the centre) get short codes: 4 symbols for the first 83,521 numbers, then one more symbol each time
// the numbers grow 17 times. The scrambling only mixes numbers that have the same code length, so lengths never change.

const ALPHABET = "23456789DHJMNPRTV";
const MIN_LENGTH = 4;
const SCRAMBLE_A = 2654435761n;
const SCRAMBLE_C = 3571n;

const POWERS: bigint[] = [1n];
for (let i = 1; i <= 16; i++) POWERS.push((POWERS[i - 1] as bigint) * 17n);

function lengthOf(n: bigint): number {
  let length = MIN_LENGTH;
  while (n >= (POWERS[length] as bigint)) length++;
  return length;
}

function startOf(length: number): bigint {
  return length <= MIN_LENGTH ? 0n : (POWERS[length - 1] as bigint);
}

function withHyphen(symbols: string): string {
  const cut = Math.ceil(symbols.length / 2);
  return `${symbols.slice(0, cut)}-${symbols.slice(cut)}`;
}

function toSymbols(n: bigint, length: number): string {
  let out = "";
  let rest = n;
  for (let i = 0; i < length; i++) {
    out = ALPHABET[Number(rest % 17n)] + out;
    rest /= 17n;
  }
  return out;
}

/** The code of a system number (a whole number from 0 up to 17^16). */
export function encodeSystemNumber(id: number): string {
  if (!Number.isSafeInteger(id) || id < 0) throw new Error(`bad system number ${id}`);
  const n = BigInt(id);
  const length = lengthOf(n);
  const start = startOf(length);
  const size = (POWERS[length] as bigint) - start;
  const scrambled = start + ((SCRAMBLE_A * (n - start) + SCRAMBLE_C) % size);
  return withHyphen(toSymbols(scrambled, length));
}

/** Cleans what a person typed: capitals, no spaces or hyphens. Null if a symbol is not one of the 17. */
export function normalizeSystemNumberCode(text: string): string | null {
  const plain = text.toUpperCase().replace(/[\s-]/g, "");
  if (plain.length < MIN_LENGTH || plain.length > 16) return null;
  for (const ch of plain) if (!ALPHABET.includes(ch)) return null;
  return plain;
}

function modInverse(a: bigint, m: bigint): bigint {
  let [r0, r1] = [m, a % m];
  let [t0, t1] = [0n, 1n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  return ((t0 % m) + m) % m;
}

/** The system number of a code, or null if the text is not a code. (Does not check the system exists.) */
export function decodeSystemNumber(code: string): number | null {
  const plain = normalizeSystemNumberCode(code);
  if (plain === null) return null;
  let value = 0n;
  for (const ch of plain) value = value * 17n + BigInt(ALPHABET.indexOf(ch));
  const length = plain.length;
  const start = startOf(length);
  if (value < start) return null;
  const size = (POWERS[length] as bigint) - start;
  const n = start + ((modInverse(SCRAMBLE_A, size) * (((value - start - SCRAMBLE_C) % size) + size)) % size);
  return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null;
}
