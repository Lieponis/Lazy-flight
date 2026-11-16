import { describe, expect, it } from "vitest";
import {
  CAPTION_MIN,
  NAME_MIN_A,
  NAME_STYLES,
  ROW_HEIGHT,
  fitWrapped,
  isCode,
  layoutInfo,
  monoMeasureAt,
  nameTokens,
  parseNameStyle,
  shortenName,
  shortenPlace,
  shortestName,
  splitCodedName,
  splitCodes,
  splitTwoParts,
  wrapWords,
  type InfoLayout,
  type NameStyle,
} from "../src/render/namefit";
import { nameHtml } from "../src/render/nametext";
import {
  LIMIT_DOCK_FULL,
  LIMIT_PLANET,
  LIMIT_SYSTEM,
  WORST_DOCK_FULL,
  WORST_PLANET,
  WORST_SYSTEM,
  parseNamePreview,
  pickSamples,
} from "../src/render/namesamples";

// The longest names the universe can make (src/universe limits: system 42 letters, planet 47, dock full name 75).
const SYSTEM = "Fizniploo Jambazook Quindlebe 89-3R"; // a long word and a code
const SYSTEM_LONG = WORST_SYSTEM; // 42 letters, the limit
const PLANET_LONG = WORST_PLANET; // 47, the limit
const DOCK_LONG = WORST_DOCK_FULL; // 73 letters, close to the limit of 75
const PURE_PLANET = "Lazy Harbour II";
const LONGEST_CODE = "Kopipex RP5N3-MT662 II";

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

  it("splits a place into two parts", () => {
    expect(splitTwoParts("Lonely Basin Outpost, Kopipex 2N-83 II")).toEqual({ first: "Lonely Basin Outpost", second: "Kopipex 2N-83 II" });
    expect(splitTwoParts("Kopipex 2N-83 II")).toEqual({ first: "Kopipex", second: "2N-83 II" });
    expect(splitTwoParts("Lazy Harbour")).toEqual({ first: "Lazy Harbour", second: "" });
  });

  it("reads the style from the address", () => {
    expect(parseNameStyle("b")).toBe("B");
    expect(parseNameStyle("x")).toBeNull();
    expect(parseNameStyle(null)).toBeNull();
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

function layout(style: NameStyle, name: string, heading = "TO"): InfoLayout {
  return layoutInfo({
    style,
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

const nameRows = (l: InfoLayout): string[] => l.rows.filter((r) => r.tone !== "label" && r.text !== "12:34:56").map((r) => r.text);

describe("the info screen with long names", () => {
  for (const style of NAME_STYLES) {
    it(`style ${style}: every name fits the screen (width and height), and the code is always there`, () => {
      for (const name of NAMES) {
        const l = layout(style, name);
        expect(l.fits).toBe(true);
        expect(l.height).toBeLessThanOrEqual(AREA + 1e-6);
        for (const row of l.rows) expect(monoMeasureAt(row.size)(row.text)).toBeLessThanOrEqual(MAX_W + 1e-6);
        const shown = nameRows(l).join(" ");
        const code = splitCodedName(name)?.code;
        if (code) expect(shown.includes(code)).toBe(true);
        // a planet number stays with the code
        if (/ II$/.test(name) && code) expect(shown.includes(`${code} II`)).toBe(true);
        // the code is never cut across two rows (rows are joined with a space, so a cut code would not be found above)
      }
    });

    it(`style ${style}: a short name looks as before (all text the same size, one line)`, () => {
      const l = layout(style, "Kopi Station");
      expect(l.rows).toHaveLength(5);
      const sizes = new Set(l.rows.map((r) => r.size));
      expect(sizes.size).toBe(1);
      expect([...sizes][0]).toBe(32);
      expect(l.shortened).toBe(false);
    });

    it(`style ${style}: a tour's "FINAL STOP 12/12" caption fits too`, () => {
      const l = layout(style, DOCK_LONG, "FINAL STOP 12/12");
      expect(l.fits).toBe(true);
      expect(l.rows[0]?.text).toBe("FINAL STOP 12/12");
      expect(monoMeasureAt(l.rows[0]!.size)(l.rows[0]!.text)).toBeLessThanOrEqual(MAX_W + 1e-6);
    });
  }

  it("style A: the whole name is shown, the text only gets smaller (never below 8 units)", () => {
    const l = layout("A", "Lonely Basin Outpost, Kopipex 2N-83 II");
    expect(l.shortened).toBe(false);
    expect(nameRows(l).join(" ")).toBe("LONELY BASIN OUTPOST, KOPIPEX 2N-83 II");
    for (const r of l.rows) expect(r.size).toBeGreaterThanOrEqual(NAME_MIN_A * K);
  });

  it("style B: text never gets smaller than 11 units; a very long name is shortened with its code kept", () => {
    const l = layout("B", DOCK_LONG);
    for (const r of l.rows) expect(r.size).toBeGreaterThanOrEqual(CAPTION_MIN * K);
    expect(l.shortened).toBe(true);
    expect(nameRows(l).join(" ").includes("…")).toBe(true);
    const medium = layout("B", "Lonely Basin Outpost, Kopipex 2N-83 II");
    expect(medium.shortened).toBe(false);
  });

  it("style C: the name is above and the place (system and code) below it in cyan", () => {
    const l = layout("C", "Lonely Basin Outpost, Kopipex 2N-83 II");
    const place = l.rows.filter((r) => r.tone === "place").map((r) => r.text);
    const value = nameRows(l).filter((t) => !place.includes(t));
    expect(place.join(" ")).toBe("KOPIPEX 2N-83 II");
    expect(value.join(" ")).toBe("LONELY BASIN OUTPOST");
    const nameAt = l.rows.findIndex((r) => r.tone === "value" && r.text === value[0]);
    const placeAt = l.rows.findIndex((r) => r.tone === "place");
    expect(nameAt).toBeLessThan(placeAt);
  });

  it("style C: a planet name splits into its word and its code", () => {
    const l = layout("C", "Kopipex 2N-83 II");
    expect(l.rows.filter((r) => r.tone === "place").map((r) => r.text)).toEqual(["2N-83 II"]);
  });

  it("a pure name (no code) fits in every style", () => {
    for (const style of NAME_STYLES) {
      const l = layout(style, "Lazy Harbour Tradingpost, Lazy Harbour II");
      expect(l.fits).toBe(true);
    }
  });

  it("a different picture size still fits (a 96 x 112 picture, scale 1)", () => {
    for (const style of NAME_STYLES) {
      const l = layoutInfo({
        style,
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
    }
  });
});

describe("the made-up worst cases and the sample list", () => {
  it("are as long as the universe allows, and no longer", () => {
    expect(WORST_SYSTEM.length).toBe(LIMIT_SYSTEM);
    expect(WORST_PLANET.length).toBe(LIMIT_PLANET);
    expect(WORST_DOCK_FULL.length).toBeLessThanOrEqual(LIMIT_DOCK_FULL);
    expect(WORST_DOCK_FULL.length).toBeGreaterThan(LIMIT_DOCK_FULL - 6);
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
