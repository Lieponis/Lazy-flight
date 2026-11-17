// Stage N3a (Agent 5h): long, unique names fit every one-line spot; cards wrap. Andy chose B: shorten the WORD part,
// always keep the code (the code is what makes a name unique).
import { describe, expect, it } from "vitest";
import { MAX_DOCK_FULL_NAME_LENGTH, MAX_PLANET_NAME_LENGTH, MAX_SYSTEM_NAME_LENGTH } from "../src/universe";
import {
  fitLocation,
  fitPlace,
  locationText,
  nicknameLine,
  planetPanelText,
  shortenName,
  shortestName,
  splitCodedName,
  splitCodes,
} from "../src/ui/logic";

const SYS = "Fizniploo Junction 89-3R"; // the longest system name near home (24)
const FAR = "Wibwadar RP5N3-MT662"; // far away: a longer code
const PLANET = "Fizfuwick Junction TT-PR VIII";
const DOCK = "Rattling Windmill Station";
const PURE = "Polite Porridge";

describe("N3a: splitting a coded name", () => {
  it("system, planet, far system, pure name", () => {
    expect(splitCodedName("Kopipex 2N-83")).toEqual({ word: "Kopipex", code: "2N-83", suffix: "" });
    expect(splitCodedName(PLANET)).toEqual({ word: "Fizfuwick Junction", code: "TT-PR", suffix: " VIII" });
    expect(splitCodedName(FAR)).toEqual({ word: "Wibwadar", code: "RP5N3-MT662", suffix: "" });
    expect(splitCodedName(PURE)).toBeNull();
    expect(splitCodedName("Veeky")).toBeNull();
    expect(splitCodedName("Lazy Harbour II")).toBeNull(); // a pure system's planet: no code
  });
});

describe("N3a: shortening keeps the code", () => {
  it("leaves names that fit alone", () => {
    expect(shortenName("Kopipex 2N-83", 13)).toBe("Kopipex 2N-83");
    expect(shortenName(PURE, 40)).toBe(PURE);
  });

  it("shortens only the word part of a coded name", () => {
    expect(shortenName(SYS, 18)).toBe("Fizniploo J… 89-3R");
    expect(shortenName(SYS, 18).length).toBe(18);
    expect(shortenName(PLANET, 20)).toBe("Fizfuwic… TT-PR VIII");
    expect(shortenName(FAR, 16)).toBe("Wib… RP5N3-MT662");
    for (const max of [4, 8, 12, 20]) expect(shortenName(SYS, max).endsWith(" 89-3R")).toBe(true);
  });

  it("the shortest form is one letter + … + code (even past the limit)", () => {
    expect(shortestName(SYS)).toBe("F… 89-3R");
    expect(shortenName(FAR, 4)).toBe("W… RP5N3-MT662");
  });

  it("names without a code are cut at the end with …", () => {
    expect(shortenName(PURE, 10)).toBe("Polite Po…");
    expect(shortenName(DOCK, 12)).toBe("Rattling Wi…");
    expect(shortenName(PURE, 4)).toBe("Pol…");
    expect(shortenName("Veeky", 1)).toBe("…");
  });

  it("edge lengths: 4 letters and the longest names allowed in universe v3 (62 dock, 34 planet, 29 system)", () => {
    expect(shortenName("Veek", 4)).toBe("Veek");
    expect(MAX_SYSTEM_NAME_LENGTH).toBe(29);
    expect(MAX_PLANET_NAME_LENGTH).toBe(34);
    expect(MAX_DOCK_FULL_NAME_LENGTH).toBe(62);
    // The longest names seen near the start (report-agent-2e section 7).
    const longSystem = "Snugaploo Junction HH8H3-2526"; // 29
    const longPlanet = "Wibfugus Junction 5RJ68-4TV8 VIII"; // 33
    const longDock = "Rattling Biscuit Station, Bimlithus Junction N2M5P-9RJ6 III"; // 59
    expect(longSystem.length).toBe(29);
    expect(shortenName(longSystem, 29)).toBe(longSystem);
    expect(shortenName(longSystem, 20)).toBe("Snugaplo… HH8H3-2526");
    expect(shortenName(longSystem, 20).length).toBe(20);
    expect(shortenName(longPlanet, 24)).toBe("Wibfugu… 5RJ68-4TV8 VIII");
    expect(shortenName(longDock, 62)).toBe(longDock);
    expect(shortenName(longDock, 30)).toContain("N2M5P-9RJ6 III");
    expect(shortenName(longDock, 30).length).toBeLessThanOrEqual(30);
  });
});

describe("N3a: one-line place labels", () => {
  it("fits when there is room", () => {
    expect(fitPlace("Lonely Basin Outpost", "Kopipex 2N-83", 60)).toBe("Lonely Basin Outpost · Kopipex 2N-83");
  });

  it("shares the room and keeps the code", () => {
    const t = fitPlace(DOCK, SYS, 40);
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t).toContain("89-3R");
    expect(t).toBe("Rattling Windmill… · Fizniploo J… 89-3R");
  });

  it("a short dock name gives its spare room to the system", () => {
    expect(fitPlace("Hub", SYS, 22)).toBe("Hub · Fizniploo… 89-3R");
  });

  it("very tight: still the code", () => {
    const t = fitPlace(DOCK, FAR, 20);
    expect(t).toContain("RP5N3-MT662");
  });

  it("a planet without a dock: only its own name (it already holds the system)", () => {
    expect(locationText({ flying: false, floating: true, dockName: "Kopipex 2N-83 II", systemName: "" })).toBe("IN SPACE AT Kopipex 2N-83 II");
    expect(fitPlace(PLANET, "", 20)).toBe("Fizfuwic… TT-PR VIII");
    expect(fitLocation({ flying: true, dockName: PLANET, systemName: "" }, 24)).toBe("EN ROUTE TO F… TT-PR VIII");
  });

  it("the prefix stays", () => {
    const t = fitLocation({ flying: true, dockName: DOCK, systemName: SYS }, 36);
    expect(t.startsWith("EN ROUTE TO ")).toBe(true);
    expect(t).toContain("89-3R");
  });
});

describe("N3a: nickname line, scenery planets only (Andy)", () => {
  const base = { planetId: "a/1", planetName: "Wibwadar RP5N3-MT662 IV", typeLabel: "Gas giant", radius: 8.3, here: false, owned: false };
  it("scenery with a nickname", () => {
    expect(planetPanelText({ ...base, dock: null, nickname: "Sleepy Susan" }).nickname).toBe('Locals call it "Sleepy Susan".');
    expect(planetPanelText({ ...base, dock: null }).nickname).toBe("");
  });
  it("docks never show it", () => {
    expect(planetPanelText({ ...base, dock: { name: "Dozy Hollow Outpost", kind: "OUTPOST" }, nickname: "Sleepy Susan" }).nickname).toBeUndefined();
    expect(nicknameLine("  ")).toBe("");
  });
});

describe("N3a: codes stay whole when names wrap", () => {
  it("finds every code in a text", () => {
    expect(splitCodes("→ Golden Lantern Station · Sabnia RP5N3-MVRJR")).toEqual([
      { text: "→ Golden Lantern Station · Sabnia ", code: false },
      { text: "RP5N3-MVRJR", code: true },
    ]);
    expect(splitCodes("Polite Porridge")).toEqual([{ text: "Polite Porridge", code: false }]);
    expect(splitCodes("2N-83 to TT-PR").map((p) => p.code)).toEqual([true, false, true]);
    expect(splitCodes("")).toEqual([]);
    expect(splitCodes("A pen-pal tour").every((p) => !p.code)).toBe(true); // ordinary hyphenated words are not codes
  });
});
