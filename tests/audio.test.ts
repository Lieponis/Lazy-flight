// Agent 7a: the pure parts of the sound layer (src/audio) and its layer rule.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_SOUNDS,
  CUE_LOOKAHEAD_S,
  DEFAULT_PREFS,
  PREFS_KEY,
  SOUND_LEVELS,
  busGains,
  changeSound,
  flightCues,
  flightMoments,
  funnyLineStarted,
  isSilent,
  loadPrefs,
  moodFor,
  normalizePrefs,
  savePrefs,
  sliderToGain,
  type PhaseLengths,
  type PrefsStorage,
} from "../src/audio";
import { muteButtonText, volumeLabel } from "../src/ui/gamemenu";

class FakeStorage implements PrefsStorage {
  data = new Map<string, string>();
  broken = false;
  getItem(k: string): string | null {
    if (this.broken) throw new Error("blocked");
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.broken) throw new Error("full");
    this.data.set(k, v);
  }
}

describe("layer rule: src/audio stands alone", () => {
  it("imports nothing from render, ui, game, save, universe or Three.js", () => {
    const bad = /from\s+['"](three|(\.\.?\/)+(render|ui|game|save|universe))(\/[^'"]*)?['"]/;
    const offenders = readdirSync("src/audio")
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => bad.test(readFileSync(join("src/audio", f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("render, game, universe and save never import the sound layer", () => {
    const re = /from\s+['"](\.\.?\/)+audio(\/[^'"]*)?['"]/;
    const offenders: string[] = [];
    for (const dir of ["src/render", "src/game", "src/universe", "src/save"]) {
      for (const f of readdirSync(dir)) if (f.endsWith(".ts") && re.test(readFileSync(join(dir, f), "utf8"))) offenders.push(`${dir}/${f}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("sound settings", () => {
  it("defaults: not muted, music quieter than effects", () => {
    expect(DEFAULT_PREFS.muted).toBe(false);
    expect(DEFAULT_PREFS.music).toBeLessThan(DEFAULT_PREFS.effects);
  });

  it("normalizePrefs fills gaps and clamps garbage", () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ muted: true })).toEqual({ ...DEFAULT_PREFS, muted: true });
    expect(normalizePrefs({ music: 7, effects: -2, muted: "yes" })).toEqual({ muted: false, music: 1, effects: 0 });
    expect(normalizePrefs({ music: Number.NaN })).toEqual(DEFAULT_PREFS);
  });

  it("is remembered after a reload, under its own key", () => {
    const st = new FakeStorage();
    expect(loadPrefs(st)).toEqual(DEFAULT_PREFS);
    expect(savePrefs(st, { muted: true, music: 0.2, effects: 0.9 })).toBe(true);
    expect(st.data.has(PREFS_KEY)).toBe(true);
    expect(PREFS_KEY).not.toBe("lazy-freight.save"); // never touches the game save
    expect(loadPrefs(st)).toEqual({ muted: true, music: 0.2, effects: 0.9 });
  });

  it("never throws: broken JSON, blocked or missing storage give defaults", () => {
    const st = new FakeStorage();
    st.data.set(PREFS_KEY, "{oops");
    expect(loadPrefs(st)).toEqual(DEFAULT_PREFS);
    st.broken = true;
    expect(loadPrefs(st)).toEqual(DEFAULT_PREFS);
    expect(savePrefs(st, DEFAULT_PREFS)).toBe(false);
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(savePrefs(null, DEFAULT_PREFS)).toBe(false);
  });
});

describe("volume maths", () => {
  it("slider: 0 is silent, 1 is the maximum, always rising", () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1, 0.9)).toBeCloseTo(0.9);
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const g = sliderToGain(p);
      expect(g).toBeGreaterThanOrEqual(last);
      last = g;
    }
    expect(sliderToGain(5)).toBe(1);
    expect(sliderToGain(-1)).toBe(0);
  });

  it("mute silences both; music and effects are separate", () => {
    expect(busGains({ muted: true, music: 1, effects: 1 })).toEqual({ music: 0, effects: 0 });
    const g = busGains({ muted: false, music: 0, effects: 1 });
    expect(g.music).toBe(0);
    expect(g.effects).toBeGreaterThan(0);
    expect(isSilent({ muted: false, music: 0, effects: 0 })).toBe(true);
    expect(isSilent({ muted: true, music: 1, effects: 1 })).toBe(true);
    expect(isSilent(DEFAULT_PREFS)).toBe(false);
  });

  it("settings labels", () => {
    expect(volumeLabel("MUSIC", 0.5)).toBe("MUSIC 50%");
    expect(volumeLabel("MUSIC", 3)).toBe("MUSIC 100%");
    expect(muteButtonText(true)).toMatch(/OFF/);
    expect(muteButtonText(false)).toMatch(/ON/);
  });
});

describe("event to sound", () => {
  it("every sound has a level between 0 and 1, and there is no squeak (Andy removed it)", () => {
    for (const s of ALL_SOUNDS) {
      expect(SOUND_LEVELS[s]).toBeGreaterThan(0);
      expect(SOUND_LEVELS[s]).toBeLessThanOrEqual(1);
    }
    expect(ALL_SOUNDS).not.toContain("squeak");
    expect(ALL_SOUNDS).toEqual(expect.arrayContaining(["click", "kaching", "rankup", "bonk", "blip", "refuel"]));
  });

  it("the click is quieter than the money sound", () => {
    expect(SOUND_LEVELS.click).toBeLessThan(SOUND_LEVELS.kaching);
  });

  it("mood: docked when not flying, warp only in the warp phase", () => {
    expect(moodFor(false, null)).toBe("docked");
    expect(moodFor(true, "LAUNCH")).toBe("flight");
    expect(moodFor(true, "WARP")).toBe("warp");
    expect(moodFor(true, "APPROACH")).toBe("flight");
    expect(moodFor(true, "DONE")).toBe("docked");
  });

  it("money and fuel changes", () => {
    const same = true;
    expect(changeSound({ before: 500, after: 440 }, { before: 10, after: 40 }, same)).toBe("refuel");
    expect(changeSound({ before: 0, after: 0 }, { before: 0, after: 20 }, same)).toBe("refuel"); // free emergency fuel
    expect(changeSound({ before: 3000, after: 500 }, { before: 40, after: 40 }, same)).toBe("kaching"); // bought something
    expect(changeSound({ before: 3000, after: 500 }, { before: 40, after: 90 }, false)).toBe("kaching"); // bought and switched
    expect(changeSound({ before: 500, after: 500 }, { before: 60, after: 30 }, same)).toBeNull(); // accepted a job
    expect(changeSound({ before: 500, after: 900 }, { before: 30, after: 30 }, same)).toBeNull(); // paid: the card plays it
    expect(changeSound({ before: 500, after: 500 }, { before: 30, after: 80 }, false)).toBeNull(); // only switched ships
  });
});

describe("flight cues", () => {
  const trip: PhaseLengths = { launch: 10, warp: 60, approach: 16 };
  const total = trip.launch + trip.warp + trip.approach;

  /** Runs a whole trip with a 250 ms clock, like the UI does. */
  function run(p: PhaseLengths, step = 0.25, start = 0): { sound: string; at: number }[] {
    const out: { sound: string; at: number }[] = [];
    let before: number | null = null;
    const end = p.launch + p.warp + p.approach;
    for (let now = start; now <= end; now += step) {
      for (const c of flightCues(p, before, now)) out.push({ sound: c.sound, at: now + c.delay });
      before = now;
    }
    return out;
  }

  it("a whole trip plays every flight sound once, in order", () => {
    const heard = run(trip);
    expect(heard.map((h) => h.sound)).toEqual(["takeoff", "whooshOut", "warpIn", "warpOut", "approach", "whooshIn"]);
  });

  it("each sound starts on time (never late), even with a slow clock", () => {
    for (const step of [0.1, 0.25, 0.3]) {
      const heard = run(trip, step);
      const moments = flightMoments(trip);
      expect(heard).toHaveLength(moments.length);
      heard.forEach((h, i) => expect(h.at).toBeCloseTo(moments[i]!.at, 5));
    }
  });

  it("the warp implosion lands on the warp flash (end of launch)", () => {
    const warpIn = flightMoments(trip).find((m) => m.cue.sound === "warpIn")!;
    expect(warpIn.at + 0.72).toBeCloseTo(trip.launch, 5);
  });

  it("opening the page in the middle of a warp plays nothing until the next moment", () => {
    expect(flightCues(trip, null, 30)).toEqual([]);
    const heard = run(trip, 0.25, 30).map((h) => h.sound);
    expect(heard).toEqual(["warpOut", "approach", "whooshIn"]);
  });

  it("a fresh trip still roars on the first check", () => {
    expect(flightCues(trip, null, 0.2).map((c) => c.sound)).toContain("takeoff");
  });

  it("coming back to the tab after a long time does not play old sounds", () => {
    expect(flightCues(trip, 2, 50)).toEqual([]);
  });

  it("a short squeezed trip still plays in order", () => {
    const k = 8 / (10 + 3 + 16);
    const short = { launch: 10 * k, warp: 3 * k, approach: 16 * k };
    const heard = run(short, 0.25).map((h) => h.sound);
    expect(heard[0]).toBe("takeoff");
    expect(heard).toContain("warpIn");
    expect(heard[heard.length - 1]).toBe("whooshIn");
  });

  it("engine sounds stretch to their phase", () => {
    const m = flightMoments(trip);
    expect(m.find((x) => x.cue.sound === "takeoff")!.cue.length).toBeCloseTo(trip.launch - 0.72, 5);
    expect(m.find((x) => x.cue.sound === "approach")!.cue.length).toBeCloseTo(trip.approach * 0.75, 5);
    expect(m.every((x) => x.at >= 0 && x.at <= total)).toBe(true);
    expect(CUE_LOOKAHEAD_S).toBeGreaterThan(0.25); // covers the UI's 250 ms clock
  });

  it("funny-line blip: once per cockpit message, never on joining", () => {
    let blips = 0;
    let before: number | null = null;
    for (let t = 0; t <= 100; t += 0.25) {
      if (funnyLineStarted(before, t, 15, 25)) blips++;
      before = t;
    }
    expect(blips).toBe(4); // at 15, 40, 65, 90
    expect(funnyLineStarted(null, 15.1)).toBe(false);
    expect(funnyLineStarted(10, 40)).toBe(false); // a long gap (tab hidden): no blip
  });
});
