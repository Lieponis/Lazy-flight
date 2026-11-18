import { describe, expect, it } from "vitest";
import {
  CAPTION_MIN,
  ROW_HEIGHT,
  fitWrapped,
  isCode,
  layoutInfo,
  monoMeasureAt,
  nameTokens,
  shortenName,
  shortenPlace,
  shortestName,
  splitCodedName,
  splitCodes,
  wrapWords,
  type InfoLayout,
} from "../src/render/namefit";
import { nameHtml } from "../src/render/nametext";
import {
  LIMIT_DOCK_FULL,
  LIMIT_PLANET,
  LIMIT_SYSTEM,
  START_DOCK_FULL,
  START_PLANET,
  START_SYSTEM,
  STRESS_DOCK_FULL,
  STRESS_PLANET,
  STRESS_SYSTEM,
  WORST_CODE_PLANET,
  WORST_DOCK,
  WORST_DOCK_FULL,
  WORST_PLANET,
  WORST_SYSTEM,
  parseNamePreview,
  pickSamples,
} from "../src/render/namesamples";
import {
  MAX_DOCK_FULL_NAME_LENGTH,
  MAX_PLANET_NAME_LENGTH,
  MAX_SYSTEM_NAME_LENGTH,
  WORLD_SEED,
  docksOf,
  getPlanets,
  startSystem,
} from "../src/universe";
import { OUTPOST_ADJECTIVES, OUTPOST_NOUNS, STATION_ADJECTIVES, STATION_NOUNS } from "../src/universe/data/words";

// STRESS names: longer than universe v3 allows (42, 47 and 73 letters, the first prototype's limits). They keep the strict tests below
// strict: if the screens fit these, they fit anything the universe makes. The v3 worst cases have their own tests further down.
const SYSTEM = "Fizniploo Jambazook Quindlebe 89-3R"; // a long word and a code
const SYSTEM_LONG = STRESS_SYSTEM; // 42 letters
const PLANET_LONG = STRESS_PLANET; // 47
const DOCK_LONG = STRESS_DOCK_FULL; // 73 letters
const PURE_PLANET = "Lazy Harbour II";
const LONGEST_CODE = "Kopipex RP5N3-MT662 II"; // the longest code of the first prototype (11 characters), kept as a stress case

const NAMES = [
  "Kopi Station",
  "Lonely Basin Outpost",
  "Kopipex 2N-83",
  "Kopipex 2N-83 II",
  PURE_PLANET,
  LONGEST_CODE,
  SYSTEM,
  SYSTEM_LONG,
  PLANET_LONG,
  "Lonely Basin Outpost, Kopipex 2N-83 II",
  DOCK_LONG,
];

describe("name helpers (render side copy of the menu rules)", () => {
  it("splits a name into word, code and planet number", () => {
    expect(splitCodedName("Kopipex 2N-83 II")).toEqual({ word: "Kopipex", code: "2N-83", suffix: " II" });
    expect(splitCodedName("Kopipex 2N-83")).toEqual({ word: "Kopipex", code: "2N-83", suffix: "" });
    expect(splitCodedName("Lazy Harbour")).toBeNull();
    expect(isCode("RP5N3-MT662")).toBe(true);
    expect(isCode("Outpost")).toBe(false);
  });

  it("shortens only the word and keeps the code and the planet number", () => {
    expect(shortenName("Fizniploo Jambazook 89-3R II", 18)).toBe("Fizniplo… 89-3R II");
    expect(shortenName("Kopipex 2N-83", 40)).toBe("Kopipex 2N-83");
    expect(shortestName("Fizniploo Jambazook 89-3R")).toBe("F… 89-3R");
    // a pure name keeps its planet number too
    expect(shortenName("Lazy Harbour II", 11)).toBe("Lazy Ha… II");
    expect(shortestName("Lazy Harbour")).toBe("…");
  });

  it("shortens a dock and its place together, the place keeps its code", () => {
    const text = shortenPlace(DOCK_LONG, 40);
    expect(text.length).toBeLessThanOrEqual(40);
    expect(text.includes("89-3R VIII")).toBe(true);
    expect(text.includes(", ")).toBe(true);
    expect(shortenPlace("Lonely Basin Outpost, Kopipex 2N-83 II", 80)).toBe("Lonely Basin Outpost, Kopipex 2N-83 II");
    expect(shortenPlace("Kopipex 2N-83 II", 10)).toBe("K… 2N-83 II");
  });

  it("finds the codes in a text", () => {
    expect(splitCodes("To: Kopipex 2N-83 II now")).toEqual([
      { text: "To: Kopipex ", code: false },
      { text: "2N-83", code: true },
      { text: " II now", code: false },
    ]);
    expect(splitCodes("no code here")).toEqual([{ text: "no code here", code: false }]);
  });
});

describe("wrapping never cuts a code", () => {
  const measure = monoMeasureAt(10); // 4 per letter

  it("keeps the planet number with its code", () => {
    expect(nameTokens("Kopipex 2N-83 II")).toEqual(["Kopipex", "2N-83 II"]);
    expect(nameTokens("Lazy Harbour II")).toEqual(["Lazy", "Harbour II"]);
  });

  it("breaks between words only", () => {
    const lines = wrapWords("LONELY BASIN OUTPOST, KOPIPEX 2N-83 II", measure, 4 * 14);
    expect(lines).toEqual(["LONELY BASIN", "OUTPOST,", "KOPIPEX", "2N-83 II"]);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(4 * 14);
  });

  it("moves a code to the next line whole instead of cutting it", () => {
    const lines = wrapWords("ABCDEFGH 2N-83", measure, 4 * 10);
    expect(lines).toEqual(["ABCDEFGH", "2N-83"]);
  });

  it("cuts a plain word that is wider than the whole line, as a last resort", () => {
    const lines = wrapWords("ABCDEFGHIJKLMNOP", measure, 4 * 6);
    expect(lines.join("")).toBe("ABCDEFGHIJKLMNOP");
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(4 * 6);
  });
});

describe("fitting a name into a box", () => {
  const base = { maxWidth: 176, maxHeight: 60, maxSize: 38, minSize: 16, lineHeight: ROW_HEIGHT };

  it("uses the biggest size that fits, without shortening", () => {
    const f = fitWrapped("KOPI STATION", monoMeasureAt, base);
    expect(f.shortened).toBe(false);
    expect(f.fits).toBe(true);
    expect(f.lines).toEqual(["KOPI STATION"]);
    expect(f.size).toBeGreaterThan(25);
  });

  it("makes the text smaller before it shortens anything", () => {
    const f = fitWrapped("LONELY BASIN OUTPOST, KOPIPEX 2N-83 II", monoMeasureAt, base);
    expect(f.shortened).toBe(false);
    expect(f.fits).toBe(true);
    expect(f.lines.join(" ")).toBe("LONELY BASIN OUTPOST, KOPIPEX 2N-83 II");
  });

  it("shortens the word part when even the smallest size is not enough, and the code stays", () => {
    const f = fitWrapped(DOCK_LONG.toUpperCase() + " AND MORE WORDS THAT DO NOT FIT AT ALL, ANYWHERE", monoMeasureAt, { ...base, maxHeight: 30 });
    expect(f.fits).toBe(true);
    expect(f.shortened).toBe(true);
    expect(f.lines.join(" ").includes("…")).toBe(true);
  });

  it("with shortening switched off it only looks for a size where the whole name fits", () => {
    const f = fitWrapped(PLANET_LONG.toUpperCase(), monoMeasureAt, { ...base, minSize: 38, maxHeight: 70, shorten: false });
    expect(f.fits).toBe(false);
    expect(f.shortened).toBe(false);
  });

  it("keeps the code of a long name when it shortens", () => {
    const f = fitWrapped(PLANET_LONG.toUpperCase(), monoMeasureAt, { ...base, minSize: 38, maxHeight: 70 });
    expect(f.shortened).toBe(true);
    expect(f.lines.join(" ").endsWith("89-3R VIII")).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------ the cockpit info screen
const W = 192;
const H = 160;
const K = 2; // the picture is laid out on a 96-wide grid
const BODY = 19 * K;
const AREA = H * 0.92;
const MAX_W = W - 8 * K;

function layout(name: string, heading = "TO"): InfoLayout {
  return layoutInfo({
    heading,
    name: name.toUpperCase(),
    arrivesLabel: "ARRIVES IN",
    countdown: "12:34:56",
    phase: "APPROACH",
    measureAt: monoMeasureAt,
    width: W,
    height: H,
    scale: K,
    bodySize: BODY,
  });
}

const nameRows = (l: InfoLayout): string[] => l.rows.filter((r) => r.tone === "value" && r.text !== "12:34:56").map((r) => r.text);

describe("the info screen with long names", () => {
  it("every name fits the screen (width and height), and its code is always there whole", () => {
    for (const name of NAMES) {
      const l = layout(name);
      expect(l.fits).toBe(true);
      expect(l.height).toBeLessThanOrEqual(AREA + 1e-6);
      for (const row of l.rows) expect(monoMeasureAt(row.size)(row.text)).toBeLessThanOrEqual(MAX_W + 1e-6);
      const shown = nameRows(l).join(" ");
      const code = splitCodedName(name)?.code;
      if (code) expect(shown.includes(code)).toBe(true); // rows are joined with a space, so a code cut across two rows would not be found
      if (/ II$/.test(name) && code) expect(shown.includes(`${code} II`)).toBe(true); // a planet number stays with the code
    }
  });

  it("text never gets smaller than 11 units", () => {
    for (const name of NAMES) for (const r of layout(name).rows) expect(r.size).toBeGreaterThanOrEqual(CAPTION_MIN * K);
  });

  it("a short name looks as before (all text the same size, one line)", () => {
    const l = layout("Kopi Station");
    expect(l.rows).toHaveLength(5);
    const sizes = new Set(l.rows.map((r) => r.size));
    expect(sizes.size).toBe(1);
    expect([...sizes][0]).toBe(32);
    expect(l.shortened).toBe(false);
  });

  it("a name that fits on a few lines is shown whole, only the text gets smaller", () => {
    const l = layout("Lonely Basin Outpost, Kopipex 2N-83 II");
    expect(l.shortened).toBe(false);
    expect(nameRows(l).join(" ")).toBe("LONELY BASIN OUTPOST, KOPIPEX 2N-83 II");
    const real = layout("Rattling Windmill Station, Fizniploo Junction 89-3R I");
    expect(real.shortened).toBe(false);
  });

  it("a very long name is shortened with dots and keeps its code and planet number", () => {
    const l = layout(DOCK_LONG);
    expect(l.shortened).toBe(true);
    const shown = nameRows(l).join(" ");
    expect(shown.includes("…")).toBe(true);
    expect(shown.endsWith("89-3R VIII")).toBe(true);
  });

  it("a tour's caption fits too", () => {
    for (const heading of ["NEXT STOP 12/12", "FINAL STOP 12/12"]) {
      const l = layout(DOCK_LONG, heading);
      expect(l.fits).toBe(true);
      expect(l.rows[0]?.text).toBe(heading);
      expect(monoMeasureAt(l.rows[0]!.size)(l.rows[0]!.text)).toBeLessThanOrEqual(MAX_W + 1e-6);
    }
  });

  it("a pure name (no code) fits", () => {
    expect(layout("Lazy Harbour Tradingpost, Lazy Harbour II").fits).toBe(true);
  });

  it("a different picture size still fits (a 96 x 112 picture, scale 1)", () => {
    const l = layoutInfo({
      heading: "NEXT STOP 2/3",
      name: DOCK_LONG.toUpperCase(),
      arrivesLabel: "TOUR ENDS IN",
      countdown: "12:34:56",
      phase: "WARP",
      measureAt: monoMeasureAt,
      width: 96,
      height: 112,
      scale: 1,
      bodySize: 19,
    });
    expect(l.height).toBeLessThanOrEqual(112 * 0.92 + 1e-6);
    for (const row of l.rows) expect(monoMeasureAt(row.size)(row.text)).toBeLessThanOrEqual(96 - 8 + 1e-6);
  });
});

describe("the worst cases and the sample list (universe v3)", () => {
  it("are as long as the universe allows, and no longer (limits 29, 34 and 62)", () => {
    expect(LIMIT_SYSTEM).toBe(MAX_SYSTEM_NAME_LENGTH);
    expect(LIMIT_PLANET).toBe(MAX_PLANET_NAME_LENGTH);
    expect(LIMIT_DOCK_FULL).toBe(MAX_DOCK_FULL_NAME_LENGTH);
    expect(WORST_SYSTEM.length).toBe(LIMIT_SYSTEM);
    expect(WORST_PLANET.length).toBe(LIMIT_PLANET);
    expect(WORST_DOCK_FULL.length).toBe(LIMIT_DOCK_FULL);
  });

  it("are made of what the generator can make: a coded system name, 'VIII' on it, and the longest dock name in the word lists", () => {
    expect(splitCodedName(WORST_SYSTEM)?.code).toBe("HH8H3-2526");
    expect(splitCodedName(WORST_PLANET)).toEqual({ word: "Snugaploo Junction", code: "HH8H3-2526", suffix: " VIII" });
    const own: string[] = [];
    for (const a of STATION_ADJECTIVES) for (const n of STATION_NOUNS) own.push(`${a} ${n} Station`);
    for (const a of OUTPOST_ADJECTIVES) for (const n of OUTPOST_NOUNS) own.push(`${a} ${n} Outpost`);
    expect(Math.max(...own.map((n) => n.length))).toBe(WORST_DOCK.length);
    expect(own.includes(WORST_DOCK)).toBe(true);
    expect(WORST_DOCK_FULL).toBe(`${WORST_DOCK}, ${WORST_PLANET}`);
  });

  it("the stress names are longer than the universe allows", () => {
    expect(STRESS_SYSTEM.length).toBeGreaterThan(LIMIT_SYSTEM);
    expect(STRESS_PLANET.length).toBeGreaterThan(LIMIT_PLANET);
    expect(STRESS_DOCK_FULL.length).toBeGreaterThan(LIMIT_DOCK_FULL);
  });

  it("the real start names are the ones in the sample list (seed 12345, as the game starts)", () => {
    const system = startSystem(WORLD_SEED);
    expect(system.name).toBe(START_SYSTEM);
    expect(getPlanets(WORLD_SEED, system.id).some((p) => p.name === START_PLANET)).toBe(true);
    expect(docksOf(WORLD_SEED, system).some((d) => d.fullName === START_DOCK_FULL)).toBe(true);
  });

  it("picks real names first, leaves out kinds that are missing, and never repeats a name", () => {
    const list = pickSamples([
      { system: "Kopipex 2N-83", planets: ["Kopipex 2N-83 I", "Kopipex 2N-83 II"], docks: [{ name: "Kopi Hub", fullName: "Kopi Hub, Kopipex 2N-83 I" }] },
      { system: "Lazy Harbour", planets: ["Lazy Harbour I"], docks: [{ name: "Slow Pier", fullName: "Slow Pier, Lazy Harbour I" }] },
    ]);
    const texts = list.map((s) => s.text);
    expect(texts.includes("Kopi Hub")).toBe(true);
    expect(texts.includes("Lazy Harbour I")).toBe(true); // a pure-name planet
    expect(texts.includes("Slow Pier, Lazy Harbour I")).toBe(true); // a pure-name dock with its place
    expect(texts.includes(WORST_DOCK_FULL)).toBe(true);
    for (const t of [START_SYSTEM, START_PLANET, START_DOCK_FULL, WORST_SYSTEM, WORST_PLANET, WORST_CODE_PLANET, STRESS_DOCK_FULL]) expect(texts.includes(t)).toBe(true);
    expect(list.some((s) => s.heading === "NEXT STOP 2/3")).toBe(true);
    expect(list.some((s) => s.heading === "FINAL STOP 3/3")).toBe(true);
    const keys = list.map((s) => `${s.heading}|${s.text}`);
    expect(new Set(keys).size).toBe(keys.length);
    // with no real data there are still the worst cases
    expect(pickSamples([]).length).toBeGreaterThan(3);
  });

  it("reads ?namepreview=1", () => {
    expect(parseNamePreview("?namepreview=1")).toBe(true);
    expect(parseNamePreview("?x=1&namepreview=true")).toBe(true);
    expect(parseNamePreview("?namepreview=0")).toBe(false);
    expect(parseNamePreview("")).toBe(false);
  });
});

describe("names in plain HTML text", () => {
  it("puts each code in its own never-breaking span and escapes the rest", () => {
    expect(nameHtml("Kopipex 2N-83 II")).toBe('Kopipex <span class="nm-code">2N-83</span> II');
    expect(nameHtml("A&B <x> 2N-83")).toBe('A&amp;B &lt;x&gt; <span class="nm-code">2N-83</span>');
    expect(nameHtml("Lazy Harbour")).toBe("Lazy Harbour");
  });
});

describe("universe v3 names on the cockpit screen and in the text helpers", () => {
  const V3 = [START_SYSTEM, START_PLANET, START_DOCK_FULL, WORST_SYSTEM, WORST_PLANET, WORST_DOCK_FULL, WORST_CODE_PLANET];

  it("every v3 name fits the big cockpit layout (width and height), with its code whole", () => {
    for (const name of V3) {
      const l = layout(name);
      expect(l.fits).toBe(true);
      expect(l.height).toBeLessThanOrEqual(AREA + 1e-6);
      for (const row of l.rows) expect(monoMeasureAt(row.size)(row.text)).toBeLessThanOrEqual(MAX_W + 1e-6);
      const code = splitCodedName(name)?.code as string;
      expect(nameRows(l).join(" ").includes(code)).toBe(true);
    }
  });

  it("every v3 name fits the small picture (96 x 112, scale 1) too, with its code whole, in every tour caption", () => {
    for (const name of V3) {
      for (const heading of ["TO", "NEXT STOP 2/3", "FINAL STOP 3/3"]) {
        const l = layoutInfo({
          heading,
          name: name.toUpperCase(),
          arrivesLabel: "TOUR ENDS IN",
          countdown: "12:34:56",
          phase: "WARP",
          measureAt: monoMeasureAt,
          width: 96,
          height: 112,
          scale: 1,
          bodySize: 19,
        });
        expect(l.fits).toBe(true);
        expect(l.height).toBeLessThanOrEqual(112 * 0.92 + 1e-6);
        for (const row of l.rows) expect(monoMeasureAt(row.size)(row.text)).toBeLessThanOrEqual(96 - 8 + 1e-6);
        const code = splitCodedName(name)?.code as string;
        expect(l.rows.filter((r) => r.tone === "value").map((r) => r.text).join(" ").includes(code)).toBe(true);
      }
    }
  });

  it("the real start names are shown whole in the big layout (nothing cut), and the worst dock is shortened only if it must", () => {
    for (const name of [START_SYSTEM, START_PLANET, START_DOCK_FULL]) expect(layout(name).shortened).toBe(false);
    // The worst dock may be shortened, but then its place keeps the code and the planet number.
    const worst = layout(WORST_DOCK_FULL);
    if (worst.shortened) expect(nameRows(worst).join(" ").endsWith("HH8H3-2526 VIII")).toBe(true);
  });

  it("the text helpers keep the v3 codes whole when they shorten (the code letters of universe v3 are recognised)", () => {
    for (const name of [START_PLANET, WORST_PLANET, WORST_CODE_PLANET]) {
      const parts = splitCodedName(name);
      expect(parts === null).toBe(false);
      expect(shortenName(name, 14).includes(`${parts?.code} ${parts?.suffix.trim()}`)).toBe(true);
    }
    for (const full of [START_DOCK_FULL, WORST_DOCK_FULL]) {
      const short = shortenPlace(full, 44);
      expect(short.length).toBeLessThanOrEqual(44);
      expect(/ [2-9DHJMNPRTV]+-[2-9DHJMNPRTV]+ [IVX]+$/.test(short)).toBe(true);
    }
    expect(nameHtml(START_PLANET)).toBe('Bimvik Deep <span class="nm-code">JR62R-MT37</span> III');
    expect(nameTokens(WORST_PLANET).slice(-1)).toEqual(["HH8H3-2526 VIII"]);
  });
});
