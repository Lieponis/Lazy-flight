// Agent 7b: title screen and speaker button (pure parts).
import { describe, expect, it } from "vitest";
import {
  GAME_NAME,
  GLYPHS,
  GLYPH_HEIGHT,
  MIN_LOADING_MS,
  TAGLINE,
  TITLE_PIXEL_BUDGET,
  loadingText,
  lowResSize,
  titleCellSize,
  titleLayout,
  titleLines,
  titleReady,
  wordCells,
  wordWidth,
} from "../src/ui/titlelogic";
import { pickTitlePlanets } from "../src/ui/titlescene";
import { SPEAKER_STYLE, speakerLabel } from "../src/ui/statusstrip";
import { getPlanetsOfSystem, listSystemsNear } from "../src/universe";

describe("title: Andy's words", () => {
  it("name and tagline as chosen", () => {
    expect(GAME_NAME).toBe("LAZY FLIGHT");
    expect(TAGLINE).toBe("SPACE HAULING AT THE SPEED OF NAP");
  });

  it("every letter of the name has a 5x7 pixel shape", () => {
    for (const ch of GAME_NAME) {
      const g = GLYPHS[ch];
      expect(g, ch).toBeDefined();
      expect(g!).toHaveLength(GLYPH_HEIGHT);
      for (const row of g!) expect(row).toMatch(/^[01]+$/);
    }
  });
});

describe("title: pixel letters", () => {
  it("word width counts one gap between letters", () => {
    expect(wordWidth("L")).toBe(5);
    expect(wordWidth("LAZY")).toBe(4 * 5 + 3);
    expect(wordWidth("LAZY FLIGHT")).toBe(10 * 5 + 3 + 9 + 1);
  });

  it("cells stay inside the word", () => {
    const w = wordWidth("FLIGHT");
    const cells = wordCells("FLIGHT");
    expect(cells.length).toBeGreaterThan(30);
    for (const [x, y] of cells) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(GLYPH_HEIGHT);
    }
  });

  it("two lines on an upright phone, one line on a wide screen", () => {
    expect(titleLines(GAME_NAME, true)).toEqual(["LAZY", "FLIGHT"]);
    expect(titleLines(GAME_NAME, false)).toEqual(["LAZY FLIGHT"]);
  });

  it("the name fits the screen in both directions", () => {
    for (const [W, H, portrait] of [[390, 844, true], [844, 390, false], [1280, 720, false], [320, 568, true]] as const) {
      const lines = titleLines(GAME_NAME, portrait);
      const cell = titleCellSize(lines, W, H);
      expect(Math.max(...lines.map(wordWidth)) * cell).toBeLessThanOrEqual(W * 0.85);
      expect(lines.length * 9 * cell).toBeLessThanOrEqual(H * 0.21);
      expect(cell).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("title: picture and layout", () => {
  it("low-res picture uses about the game's pixel count and keeps the shape", () => {
    const s = lowResSize(390, 844);
    expect(s.w * s.h).toBeLessThanOrEqual(TITLE_PIXEL_BUDGET * 1.02);
    expect(s.w / s.h).toBeCloseTo(390 / 844, 1);
    expect(lowResSize(100, 50)).toEqual({ w: 100, h: 50 }); // small screens are never stretched up
  });

  it("station above, planets below, everything on screen", () => {
    for (const aspect of [0.46, 1.78, 2.2]) {
      const l = titleLayout(aspect);
      expect(l.station.y).toBeGreaterThan(0.4);
      expect(l.bigPlanet.y).toBeLessThan(-0.4);
      expect(l.smallPlanet.y).toBeLessThan(-0.4);
      for (const s of [l.station, l.bigPlanet, l.smallPlanet]) {
        expect(Math.abs(s.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.y)).toBeLessThanOrEqual(1);
      }
      expect(l.station.size).toBeGreaterThan(l.smallPlanet.size); // Andy: a big station
    }
  });

  it("picks the planet you are at first, then a different one", () => {
    const system = listSystemsNear(12345, { x: 0, y: 0, z: 0 }, 30).find((s) => getPlanetsOfSystem(12345, s.id).length > 2)!;
    const planets = getPlanetsOfSystem(12345, system.id);
    const [a, b] = pickTitlePlanets(planets, planets[1]!.id)!;
    expect(a.id).toBe(planets[1]!.id);
    expect(b.id).not.toBe(a.id);
    expect(pickTitlePlanets([], "x")).toBeNull();
  });
});

describe("title: loading, then PLAY", () => {
  it("three blinking dots, same width every step", () => {
    expect(loadingText(0)).toBe("LOADING   ");
    expect(loadingText(450)).toBe("LOADING.  ");
    expect(loadingText(1250)).toBe("LOADING...");
    expect(loadingText(1650)).toBe("LOADING   ");
    for (let t = 0; t < 3000; t += 100) expect(loadingText(t)).toHaveLength(10);
  });

  it("PLAY only when the game is drawn and the dots were seen", () => {
    expect(titleReady(5000, false)).toBe(false);
    expect(titleReady(MIN_LOADING_MS - 1, true)).toBe(false);
    expect(titleReady(MIN_LOADING_MS, true)).toBe(true);
  });
});

describe("speaker button", () => {
  it("Andy chose B: picture only", () => {
    expect(SPEAKER_STYLE).toBe("B");
    expect(speakerLabel(false, "B")).toBe("");
    expect(speakerLabel(true, "A")).toBe("SOUND OFF");
    expect(speakerLabel(true, "C")).toBe("MUTED");
  });
});
