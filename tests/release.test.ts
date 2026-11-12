// Agent 7d (stage P5): app icon, version number, release page.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain JavaScript build helper without types
import { DEV_PAGES } from "../scripts/pwa/lib.mjs";
// @ts-expect-error plain JavaScript build helper without types
import { PAL, iconPixel } from "../scripts/pwa/icon-art.mjs";
import { APP_VERSION } from "../src/save/transfer";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

describe("version number (one place: package.json)", () => {
  it("is a plain x.y.z version", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is put into the code at build time and reaches the save files", () => {
    const vite = readFileSync("vite.config.ts", "utf8");
    expect(vite).toContain("__APP_VERSION__");
    expect(vite).toContain("VITE_APP_VERSION");
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("the title screen shows it small", async () => {
    const { VERSION_TEXT } = await import("../src/ui/title");
    expect(VERSION_TEXT).toBe(`v${pkg.version}`);
  });
});

describe("app icon (look A, ringed planet; drawn by code)", () => {
  it("the four icon files are exactly what the script draws (can be redrawn any time)", () => {
    const dir = mkdtempSync(join(tmpdir(), "icons-"));
    try {
      execFileSync(process.execPath, ["scripts/pwa/make-icons.mjs"], { env: { ...process.env, OUT_DIR: dir, ICON_STYLE: "A" }, stdio: "ignore" });
      const made = readdirSync(dir).sort();
      expect(made).toEqual(["apple-touch-icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]);
      for (const f of made) expect(readFileSync(join(dir, f)).equals(readFileSync(join("public/icons", f))), f).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the round (maskable) icon keeps the planet and ring inside the safe circle", () => {
    const n = 64;
    const isBackground = (c: number[]) => c === PAL.space || PAL.stars.includes(c);
    for (let py = 0; py < n; py++) {
      for (let px = 0; px < n; px++) {
        const c = iconPixel("A", px, py, n, 0.78);
        if (isBackground(c)) continue;
        const x = ((px + 0.5) / n) * 2 - 1;
        const y = ((py + 0.5) / n) * 2 - 1;
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(0.8); // the safe zone is the middle 80 %
      }
    }
  });
});

describe("release page (about.html)", () => {
  const html = readFileSync("about.html", "utf8");

  it("has a big PLAY button to the game, the version, install steps and credits", () => {
    expect(html).toMatch(/class="play" href="\.\/"/);
    expect(html).toContain("%VITE_APP_VERSION%");
    expect(html).toContain("Add to Home Screen");
    expect(html).toContain("SAVE FILE");
    expect(html).toMatch(/CREDITS/);
  });

  it("loads nothing from other websites (links are fine, loading is not)", () => {
    expect(html).not.toMatch(/<(script|img|link|iframe)[^>]+(src|href)="https?:/i);
    expect(html).not.toMatch(/@import|fonts\.googleapis/);
    const css = readFileSync("src/about.css", "utf8");
    expect(css).not.toMatch(/https?:/);
  });

  it("is an online-only page: never part of the offline app", () => {
    expect(DEV_PAGES).toContain("about.html");
  });

  it("every screenshot it shows exists and is small", () => {
    const imgs = [...html.matchAll(/src="\/(about\/[^"]+)"/g)].map((m) => m[1]!);
    expect(imgs.length).toBeGreaterThanOrEqual(4);
    expect(imgs.length).toBeLessThanOrEqual(6);
    for (const p of imgs) expect(readFileSync(join("public", p)).length).toBeLessThan(80_000);
  });
});
