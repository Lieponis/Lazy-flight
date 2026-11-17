// LONG, UNIQUE NAMES ON THE 3D SCREENS (stage 3i, pure logic: words and widths only, no drawing, so it can be tested).
// Names are now like "Kopipex 2N-83" (a word and a code), "Kopipex 2N-83 II" (a planet) and "Lonely Basin Outpost, Kopipex 2N-83 II"
// (a dock with its place). The CODE is what makes a name unique, so every helper here keeps the code whole and shortens only the word.
// Limits (src/universe, universe v3): system 29 letters, planet 34, dock full name 62 (the first prototype had 42, 47 and 75).
//
// src/ui/logic.ts has the same rules for the menus (Agent 5, stage N3a). The render layer may not import the ui layer, so the small
// pieces are repeated here (suggestion: move them to a shared file one day).

/** The system code: only these letters and digits, with one hyphen ("2N-83", "RP5N3-MT662"). */
const CODE = "[2-9DHJMNPRTV]+-[2-9DHJMNPRTV]+";
const NAME_WITH_CODE = new RegExp(`^(.*\\S)\\s+(${CODE})((?:\\s+[IVXLCDM]+)?)$`);
const CODE_ONLY = new RegExp(`^${CODE}$`);
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

/** Measures how wide a piece of text is, in whatever unit the caller uses (canvas pixels, letters ...). */
export type Measure = (text: string) => number;
/** Gives the measuring function for text drawn at a given size. */
export type MeasureAt = (size: number) => Measure;

/** The pixel font (VT323) is a monospace font: every letter is exactly this many times the text size wide. */
export const FONT_ADVANCE = 0.4;

/** A measuring function for the pixel font that needs no canvas (also what the tests use). */
export const monoMeasureAt: MeasureAt = (size) => (text) => text.length * size * FONT_ADVANCE;

/** "Kopipex 2N-83 II" -> word "Kopipex", code "2N-83", suffix " II". Names without a code give null. */
export function splitCodedName(name: string): { word: string; code: string; suffix: string } | null {
  const m = NAME_WITH_CODE.exec(name.trim());
  if (!m) return null;
  return { word: m[1]!, code: m[2]!, suffix: m[3] ?? "" };
}

/** True for a system code on its own ("2N-83"). */
export function isCode(text: string): boolean {
  return CODE_ONLY.test(text);
}

/** "Lazy Harbour II" -> base "Lazy Harbour", numeral " II" (planets of pure-name systems). No numeral gives the whole text and "". */
function splitNumeral(name: string): { base: string; numeral: string } {
  const text = name.trim();
  const at = text.lastIndexOf(" ");
  if (at > 0 && NUMERALS.includes(text.slice(at + 1).toUpperCase())) return { base: text.slice(0, at), numeral: text.slice(at) };
  return { base: text, numeral: "" };
}

/**
 * Shortens a name to at most `max` letters when it can. A coded name keeps its code and planet number and shortens only the word
 * ("Fizniploo J… 89-3R II"); a pure name keeps a planet number and is cut at the end ("Lazy Harb… II"). The shortest result is one letter,
 * the "…" and the tail, even when that is longer than `max`.
 */
export function shortenName(name: string, max: number): string {
  const text = name.trim();
  if (text.length <= max) return text;
  const parts = splitCodedName(text);
  const head = parts ? parts.word : splitNumeral(text).base;
  const tail = parts ? ` ${parts.code}${parts.suffix}` : splitNumeral(text).numeral;
  const room = Math.max(1, max - tail.length - 1); // letters of the word to keep, before the "…"
  if (!parts && !tail && max <= 1) return "…";
  return `${head.slice(0, room).trimEnd()}…${tail}`;
}

/** The shortest a name can get with shortenName (its code always stays). */
export function shortestName(name: string): string {
  return shortenName(name, 0);
}

/**
 * Like shortenName, but for a dock with its place ("Lonely Basin Outpost, Kopipex 2N-83 II"): the dock and the place share the room,
 * the place keeps its code. Text without a comma is shortened as a plain name.
 */
export function shortenPlace(full: string, max: number): string {
  const text = full.trim();
  if (text.length <= max) return text;
  const comma = text.indexOf(", ");
  if (comma <= 0) return shortenName(text, max);
  const first = text.slice(0, comma);
  const second = text.slice(comma + 2).trim();
  const sep = ", ";
  const secondMin = shortestName(second).length;
  let secondRoom = Math.max(secondMin, Math.min(second.length, Math.floor((max - sep.length) / 2)));
  let firstRoom = max - sep.length - secondRoom;
  if (first.length < firstRoom) {
    secondRoom += firstRoom - first.length; // the dock name is short: give its spare room to the place
    firstRoom = first.length;
  }
  return `${shortenName(first, Math.max(4, firstRoom))}${sep}${shortenName(second, secondRoom)}`;
}

/** Cuts text into plain parts and code parts ("2N-83"), so codes can be kept whole on one line. */
export function splitCodes(text: string): { text: string; code: boolean }[] {
  const parts: { text: string; code: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(CODE, "g"))) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), code: false });
    parts.push({ text: m[0], code: true });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), code: false });
  return parts;
}

/** Words of `text`, with a code and the planet number after it kept together ("2N-83 II" is one piece, so it never splits). */
export function nameTokens(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const word of words) {
    const last = out[out.length - 1];
    if (last !== undefined && NUMERALS.includes(word.toUpperCase())) out[out.length - 1] = `${last} ${word}`; // a planet number never wraps alone
    else out.push(word);
  }
  return out;
}

/**
 * Breaks `text` into lines no wider than `maxWidth`. Lines break only between words; a code is never cut (it moves to the next line
 * whole). A plain word that is wider than a whole line is cut by letters as a last resort.
 */
export function wrapWords(text: string, measure: Measure, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  const push = (): void => {
    if (line) lines.push(line);
    line = "";
  };
  for (const token of nameTokens(text)) {
    let piece = token;
    if (measure(piece) > maxWidth && !isCode(piece.split(" ")[0] ?? "")) {
      // a very long plain word: cut it by letters
      push();
      while (piece.length > 1 && measure(piece) > maxWidth) {
        let n = piece.length - 1;
        while (n > 1 && measure(piece.slice(0, n)) > maxWidth) n--;
        lines.push(piece.slice(0, n));
        piece = piece.slice(n);
      }
    }
    const test = line ? `${line} ${piece}` : piece;
    if (line && measure(test) > maxWidth) {
      push();
      line = piece;
    } else {
      line = test;
    }
  }
  push();
  return lines;
}

export interface FitOptions {
  /** Width of the text area. */
  maxWidth: number;
  /** Height of the text area (a line is `lineHeight` x the text size tall). */
  maxHeight: number;
  /** Most lines allowed (0 = no limit besides the height). */
  maxLines?: number;
  /** The biggest and the smallest text size to try; the biggest that fits wins. */
  maxSize: number;
  minSize: number;
  /** Line height as a multiple of the text size (the cockpit screens use 0.9). */
  lineHeight?: number;
  /** False = only look for a size where the whole name fits (no shortening): quick. Default true. */
  shorten?: boolean;
}

export interface Fitted {
  lines: string[];
  size: number;
  /** True when the name had to be shortened with "…" (its code is still there). */
  shortened: boolean;
  /** False only when even the shortest form does not fit (it is then cut to the room there is). */
  fits: boolean;
}

function linesFit(lines: string[], size: number, measure: Measure, o: FitOptions): boolean {
  const lh = o.lineHeight ?? 1;
  if (o.maxLines && lines.length > o.maxLines) return false;
  if (lines.length * size * lh > o.maxHeight + 1e-6) return false;
  return lines.every((l) => measure(l) <= o.maxWidth + 1e-6);
}

/**
 * The biggest text size (between minSize and maxSize) at which the whole name wraps into the area. If it does not fit even at
 * the smallest size, the name is shortened (word part first, the code stays) just enough to fit at the smallest size.
 */
export function fitWrapped(text: string, measureAt: MeasureAt, o: FitOptions): Fitted {
  const source = text.trim();
  for (let size = o.maxSize; size >= o.minSize - 1e-9; size -= 1) {
    const lines = wrapWords(source, measureAt(size), o.maxWidth);
    if (linesFit(lines, size, measureAt(size), o)) return { lines, size, shortened: false, fits: true };
  }
  if (o.shorten === false) return { lines: wrapWords(source, measureAt(o.minSize), o.maxWidth).slice(0, 1), size: o.minSize, shortened: false, fits: false };
  const size = o.minSize;
  const measure = measureAt(size);
  for (let n = source.length - 1; n >= 0; n--) {
    const short = shortenPlace(source, n);
    const lines = wrapWords(short, measure, o.maxWidth);
    if (linesFit(lines, size, measure, o)) return { lines, size, shortened: true, fits: true };
    if (n === 0) break;
  }
  const lines = wrapWords(shortenPlace(source, 0), measure, o.maxWidth);
  const limit = Math.max(1, Math.min(o.maxLines || Infinity, Math.floor(o.maxHeight / (size * (o.lineHeight ?? 1)))));
  return { lines: lines.slice(0, limit), size, shortened: true, fits: false };
}

// ------------------------------------------------------------------------------------------------ the cockpit info screen
// Andy chose this look (stage 3i, option B): the text stays readable, and a name that is too long for the screen is shortened with "..."
// while its code stays whole. (Options A, smaller and smaller text, and C, name and place on two lines, were tried and dropped.)

/** One line of the info screen. `label` = cyan caption, `value` = light text. */
export interface InfoRow {
  text: string;
  size: number;
  tone: "label" | "value";
}

export interface InfoLayout {
  rows: InfoRow[];
  /** Total height of the rows (line height 0.9 x size). */
  height: number;
  /** The name was shortened (its code is still there). */
  shortened: boolean;
  fits: boolean;
}

export const ROW_HEIGHT = 0.9;

/** Smallest text size on the info screen, in design units (the screen is laid out on a 96-wide grid): 11, never smaller. */
export const CAPTION_MIN = 11;

export interface InfoLayoutInput {
  /** The caption above the name ("TO", "NEXT STOP 2/3"). */
  heading: string;
  /** The destination's name as shown (capital letters). */
  name: string;
  /** Captions and the time below the name. */
  arrivesLabel: string;
  countdown: string;
  phase: string;
  measureAt: MeasureAt;
  /** Picture width and height, and its scale (picture width / 96). */
  width: number;
  height: number;
  scale: number;
  /** Biggest text size, normally 19 x scale. */
  bodySize: number;
  /** The top and bottom of the used area, as fractions of the height (0.04 and 0.96). */
  top?: number;
  bottom?: number;
}

/**
 * Chooses the lines of the info screen's status page. All the text is one size, the biggest that fits (short names look as they always did).
 * A longer name takes more lines, so the text gets smaller down to 11 design units; below that the name is shortened ("LONELY BA... 2N-83 II")
 * and its code always stays whole.
 */
export function layoutInfo(i: InfoLayoutInput): InfoLayout {
  const maxW = i.width - 8 * i.scale;
  const area = i.height * ((i.bottom ?? 0.96) - (i.top ?? 0.04));
  const captionMin = CAPTION_MIN * i.scale;
  const name = i.name.trim();

  const fixedFit = (size: number): boolean => [i.heading, i.arrivesLabel, i.countdown, i.phase].every((t) => i.measureAt(size)(t) <= maxW);
  const build = (size: number, name: Fitted): InfoLayout => {
    const rows: InfoRow[] = [
      { text: i.heading, size, tone: "label" },
      ...name.lines.map((text) => ({ text, size, tone: "value" as const })),
      { text: i.arrivesLabel, size, tone: "label" },
      { text: i.countdown, size, tone: "value" },
      { text: i.phase, size, tone: "label" },
    ];
    const height = rows.reduce((sum, r) => sum + r.size * ROW_HEIGHT, 0);
    return { rows, height, shortened: name.shortened, fits: name.fits && height <= area + 1e-6 };
  };
  const fitAt = (size: number, room: number, shorten: boolean): Fitted =>
    fitWrapped(name, i.measureAt, { maxWidth: maxW, maxHeight: Math.max(0, room), maxSize: size, minSize: size, lineHeight: ROW_HEIGHT, shorten });

  // Text size from big to small. Above the smallest size the name may not be shortened; at the smallest size it may.
  let last: InfoLayout | null = null;
  for (let size = Math.floor(i.bodySize); size >= captionMin - 1e-9; size--) {
    if (!fixedFit(size)) continue;
    const lastTry = size - 1 < captionMin - 1e-9;
    const fitted = fitAt(size, area - 4 * size * ROW_HEIGHT, lastTry); // only the smallest size may shorten the name
    const layout = build(size, fitted);
    if (fitted.fits && (!fitted.shortened || lastTry)) return layout;
    if (lastTry) last = layout;
  }
  if (last) return last;
  // The captions alone are too wide for the screen: draw at the smallest size anyway.
  return { ...build(captionMin, fitAt(captionMin, area - 4 * captionMin * ROW_HEIGHT, true)), fits: false };
}
