import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { PREVIEW_PREFIX, installPreviewStorage, makePrefixedStorage, type BackingStorage } from "../src/previewstorage";

// Stage G5a: the branch preview shares the live game's browser storage (same site), so the preview build (VITE_PREVIEW=1) wraps
// localStorage and puts "preview-v3:" in front of every key. These checks prove the wrapper only ever touches its own keys, that
// nothing changes without the flag, and that every page entry installs the wrapper before any other code runs.

/** A stand-in for the browser's storage: keys keep the order they were first written. */
function fakeStorage(start: Record<string, string> = {}): BackingStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(start));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

describe("the preview's prefixed storage", () => {
  it("uses the prefix 'preview-v3:'", () => {
    expect(PREVIEW_PREFIX).toBe("preview-v3:");
  });

  it("writes every key with the prefix and reads it back without it", () => {
    const real = fakeStorage();
    const s = makePrefixedStorage(real);
    s.setItem("lazy-freight.save", "{}");
    s.setItem("lazy-freight.sound", "1");
    expect(real.dump()).toEqual({ "preview-v3:lazy-freight.save": "{}", "preview-v3:lazy-freight.sound": "1" });
    expect(s.getItem("lazy-freight.save")).toBe("{}");
    expect(s.getItem("nothing")).toBe(null);
  });

  it("never sees the live game's keys, even with the very same name", () => {
    const real = fakeStorage({ "lazy-freight.save": "LIVE SAVE", "lazy-freight.sound": "LIVE SOUND", other: "x" });
    const s = makePrefixedStorage(real);
    expect(s.getItem("lazy-freight.save")).toBe(null); // the preview starts with no save, not the live one
    expect(s.length).toBe(0);
    expect(s.key(0)).toBe(null);
  });

  it("leaves the live game's keys untouched when it writes, removes and clears", () => {
    const live = { "lazy-freight.save": "LIVE SAVE", "lazy-freight.sound": "LIVE SOUND", other: "x" };
    const real = fakeStorage(live);
    const s = makePrefixedStorage(real);
    s.setItem("lazy-freight.save", "PREVIEW SAVE");
    s.setItem("extra", "1");
    expect(real.getItem("lazy-freight.save")).toBe("LIVE SAVE");
    s.removeItem("lazy-freight.save"); // removes the preview's own copy only
    expect(real.getItem("lazy-freight.save")).toBe("LIVE SAVE");
    expect(s.getItem("lazy-freight.save")).toBe(null);
    s.clear();
    expect(real.dump()).toEqual(live);
    expect(s.length).toBe(0);
  });

  it("counts and lists only its own keys, without the prefix, in order", () => {
    const real = fakeStorage({ a: "live", "preview-v3:one": "1", b: "live", "preview-v3:two": "2" });
    const s = makePrefixedStorage(real);
    expect(s.length).toBe(2);
    expect(s.key(0)).toBe("one");
    expect(s.key(1)).toBe("two");
    expect(s.key(2)).toBe(null);
    expect(s.key(-1)).toBe(null);
  });

  it("stores values as text, like the real storage", () => {
    const real = fakeStorage();
    const s = makePrefixedStorage(real);
    s.setItem("n", 42 as unknown as string);
    expect(s.getItem("n")).toBe("42");
  });

  it("keeps the preview's data between page loads (a second wrapper over the same box sees it)", () => {
    const real = fakeStorage();
    makePrefixedStorage(real).setItem("k", "v");
    expect(makePrefixedStorage(real).getItem("k")).toBe("v");
  });
});

describe("installing the wrapper on a page", () => {
  it("changes nothing without the flag", () => {
    const real = fakeStorage({ "lazy-freight.save": "LIVE" });
    const win = { localStorage: real };
    expect(installPreviewStorage(win, false)).toBe(false);
    expect(win.localStorage === real).toBe(true);
    expect(win.localStorage.getItem("lazy-freight.save")).toBe("LIVE");
  });

  it("with the flag, the page's localStorage becomes the wrapper (and the live key is hidden)", () => {
    const real = fakeStorage({ "lazy-freight.save": "LIVE" });
    const win = { localStorage: real as BackingStorage };
    expect(installPreviewStorage(win, true)).toBe(true);
    expect(win.localStorage === real).toBe(false);
    expect(win.localStorage.getItem("lazy-freight.save")).toBe(null);
    win.localStorage.setItem("lazy-freight.save", "PREVIEW");
    expect(real.dump()).toEqual({ "lazy-freight.save": "LIVE", "preview-v3:lazy-freight.save": "PREVIEW" });
  });

  it("does nothing when the browser has no storage at all (nothing to share)", () => {
    const win = {} as { localStorage: BackingStorage };
    expect(installPreviewStorage(win, true)).toBe(false);
  });

  it("works on a storage that is a read-only getter, like the browser's own", () => {
    const real = fakeStorage();
    const win = {} as { localStorage: BackingStorage };
    Object.defineProperty(win, "localStorage", { get: () => real, configurable: true });
    expect(installPreviewStorage(win, true)).toBe(true);
    win.localStorage.setItem("a", "1");
    expect(real.dump()).toEqual({ "preview-v3:a": "1" });
  });

  it("stops the page (throws) if the storage cannot be replaced, rather than sharing the live save", () => {
    const real = fakeStorage();
    const win = {} as { localStorage: BackingStorage };
    Object.defineProperty(win, "localStorage", { get: () => real, configurable: false });
    let message = "";
    try {
      installPreviewStorage(win, true);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message.startsWith("PREVIEW")).toBe(true);
  });
});

describe("every page entry installs it first", () => {
  /** The entry files named by the root html pages (<script type="module" src="/src/x.ts">). */
  function entryFiles(): string[] {
    const files: string[] = [];
    for (const page of readdirSync(".").filter((f) => f.endsWith(".html"))) {
      const html = readFileSync(page, "utf8");
      for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="\/(src\/[^"]+\.ts)"/g)) files.push(m[1] as string);
    }
    return Array.from(new Set(files));
  }

  it("finds the game and the developer pages", () => {
    const entries = entryFiles();
    for (const need of ["src/main.ts", "src/debug.ts", "src/game-debug.ts", "src/models.ts", "src/planets.ts", "src/galaxy-debug.ts"]) {
      expect(entries.includes(need)).toBe(true);
    }
  });

  it("has './previewboot' as the very first line of each entry file", () => {
    for (const file of entryFiles()) {
      const first = (readFileSync(file, "utf8").split("\n")[0] ?? "").trim();
      expect(`${file}: ${first.startsWith("import") && /['"]\.\/previewboot['"]/.test(first)}`).toBe(`${file}: true`);
    }
  });

  it("reads the flag exactly as VITE_PREVIEW === \"1\"", () => {
    expect(readFileSync("src/previewboot.ts", "utf8").includes('import.meta.env.VITE_PREVIEW === "1"')).toBe(true);
  });

  it("the game never registers its offline helper in the preview (it would share the live game's stored copies)", () => {
    expect(readFileSync("src/main.ts", "utf8").includes("if (!IS_PREVIEW) startOfflineApp(")).toBe(true);
  });
});
