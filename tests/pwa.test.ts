import { describe, expect, it } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
// @ts-expect-error plain JavaScript helper file (no type declarations needed)
import { findReferences, planPrecache, readMode, relativeImports, renderSw, structuredLocalUrls, versionOf } from "../scripts/pwa/lib.mjs";
import { noteVisible } from "../src/ui/updatenote";

// Stage P1 (offline app): the build helpers, the service worker's behaviour, the manifest, the icons, the kill switch.
// The service worker is run here inside a small pretend browser (fake caches and a fake network), so every rule is checked
// without a phone. The full headless-browser offline suite is stage P4.

const root = fileURLToPath(new URL("..", import.meta.url));
const template = readFileSync(join(root, "scripts/pwa/sw.template.js"), "utf8");
const killSource = readFileSync(join(root, "scripts/pwa/sw-kill.js"), "utf8");

// ---------------------------------------------------------------- a fake built game (shaped like Vite's output)
function makeDist(extra: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "lf-dist-"));
  const files: Record<string, string> = {
    "index.html": `<!doctype html><html><head>
      <link rel="manifest" href="./manifest.webmanifest">
      <link rel="apple-touch-icon" href="./icons/apple-touch-icon-180.png">
      <script type="module" crossorigin src="./assets/index-AAAA1111.js"></script>
      <link rel="stylesheet" crossorigin href="./assets/index-BBBB2222.css"></head><body></body></html>`,
    "assets/index-AAAA1111.js": `import"./three-CCCC3333.js";const lazy=()=>import("./lazy-DDDD4444.js");console.log("game")`,
    "assets/three-CCCC3333.js": `export const T=1;`,
    "assets/lazy-DDDD4444.js": `export const L=1;`,
    "assets/index-BBBB2222.css": `@font-face{font-family:V;src:url(./VT323-EEEE5555.woff2) format("woff2")}`,
    "assets/VT323-EEEE5555.woff2": "FONT",
    "manifest.webmanifest": JSON.stringify({ name: "x", start_url: "./", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] }),
    "icons/icon-192.png": "PNG192",
    "icons/apple-touch-icon-180.png": "PNG180",
    "offline.html": "<html><body>offline</body></html>",
    "debug.html": `<script type="module" src="./assets/debug-FFFF6666.js"></script>`,
    "assets/debug-FFFF6666.js": `import"./three-CCCC3333.js";import"./devonly-GGGG7777.js";`,
    "assets/devonly-GGGG7777.js": `export const D=1;`,
    "models.html": `<script type="module" src="./assets/devonly-GGGG7777.js"></script>`,
    ...extra,
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

describe("pwa-mode.txt (the kill switch word)", () => {
  it("reads on, retire, comments and a missing file", () => {
    expect(readMode("on")).toBe("on");
    expect(readMode("retire")).toBe("retire");
    expect(readMode("  RETIRE \n")).toBe("retire");
    expect(readMode("# comment\n\nretire\n")).toBe("retire");
    expect(readMode("# retire\non")).toBe("on");
    expect(readMode("")).toBe("on");
    expect(readMode(undefined)).toBe("on");
    expect(readMode("something odd")).toBe("on");
  });
  it("the real pwa-mode.txt exists and holds a word the build understands (on OR retire: both must keep publishing)", () => {
    const text = readFileSync(join(root, "pwa-mode.txt"), "utf8");
    expect(["on", "retire"]).toContain(readMode(text));
    expect(text).toMatch(/^(on|retire)\s*$/im); // an actual line "on" or "retire", not only the comment lines
  });
});

describe("finding the files the game needs", () => {
  it("matches whole file names only", () => {
    const all = ["assets/a-1.js", "assets/a-1.js.map", "assets/b.css"];
    const hit = findReferences('import"./a-1.js";', all);
    expect([...hit]).toEqual(["assets/a-1.js"]);
    expect(findReferences("nothing here", all).size).toBe(0);
  });
  it("resolves relative imports, html tags, css urls and manifest icons", () => {
    expect([...relativeImports("assets/x.js", 'import"./y.js";import("../z.js")')].sort()).toEqual(["assets/y.js", "z.js"]);
    expect([...structuredLocalUrls("index.html", '<script src="./a/b.js"></script><link href="https://x.org/c.css"><a href="#top">')]).toEqual(["a/b.js"]);
    expect([...structuredLocalUrls("assets/s.css", "src:url(./f.woff2?v=1)")]).toEqual(["assets/f.woff2"]);
    expect([...structuredLocalUrls("manifest.webmanifest", '{"icons":[{"src":"icons/i.png"}],"start_url":"./"}')]).toEqual(["icons/i.png"]);
  });
});

describe("planPrecache (the build check)", () => {
  it("keeps every game file, with fingerprints, and leaves developer pages out", () => {
    const dist = makeDist();
    const plan = planPrecache(dist);
    const kept = plan.files.map((f: { path: string }) => f.path);
    expect(kept).toEqual(
      [
        "assets/VT323-EEEE5555.woff2",
        "assets/index-AAAA1111.js",
        "assets/index-BBBB2222.css",
        "assets/lazy-DDDD4444.js",
        "assets/three-CCCC3333.js",
        "icons/apple-touch-icon-180.png",
        "icons/icon-192.png",
        "index.html",
        "manifest.webmanifest",
        "offline.html",
      ].sort(),
    );
    expect(kept).not.toContain("debug.html");
    expect(kept).not.toContain("models.html");
    expect(plan.devOnly).toEqual(["assets/debug-FFFF6666.js", "assets/devonly-GGGG7777.js", "debug.html", "models.html"]);
    const font = plan.files.find((f: { path: string }) => f.path === "assets/VT323-EEEE5555.woff2");
    expect(font.hash).toBe(createHash("sha256").update("FONT").digest("hex"));
  });

  it("fails when a file is in the built site but nobody uses it (it could be loaded while the game runs)", () => {
    const dist = makeDist({ "assets/mystery-HHHH8888.png": "?" });
    expect(() => planPrecache(dist)).toThrow(/mystery-HHHH8888\.png/);
  });

  it("fails when the game imports a file the built site does not contain", () => {
    const dist = makeDist({ "assets/three-CCCC3333.js": 'import"./gone-IIII9999.js";' });
    expect(() => planPrecache(dist)).toThrow(/gone-IIII9999\.js/);
  });

  it("fails when index.html or offline.html is missing", () => {
    const noOffline = makeDist();
    rmSync(join(noOffline, "offline.html"));
    expect(() => planPrecache(noOffline)).toThrow(/offline\.html/);
    const noGame = makeDist();
    rmSync(join(noGame, "index.html"));
    expect(() => planPrecache(noGame)).toThrow(/index\.html/);
  });

  it("never follows a mention of a developer page into its files", () => {
    const dist = makeDist({ "assets/three-CCCC3333.js": 'export const T="see debug.html";' });
    const plan = planPrecache(dist);
    expect(plan.files.map((f: { path: string }) => f.path)).not.toContain("debug.html");
    expect(plan.files.map((f: { path: string }) => f.path)).not.toContain("assets/devonly-GGGG7777.js");
  });
});

describe("version naming", () => {
  const files = [
    { path: "a.js", hash: "1" },
    { path: "b.js", hash: "2" },
  ];
  it("is stable, order-independent and changes when a file or the helper's code changes", () => {
    const v = versionOf(files, "T");
    expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(versionOf([...files].reverse(), "T")).toBe(v);
    expect(versionOf([{ path: "a.js", hash: "1" }, { path: "b.js", hash: "3" }], "T")).not.toBe(v);
    expect(versionOf(files, "T2")).not.toBe(v);
  });
});

describe("renderSw", () => {
  it("fills the template into valid JavaScript with no placeholders left", () => {
    const code = renderSw(template, { version: "abc", files: [{ path: "index.html", hash: "h" }], offlineHtml: "<p>hi</p>" });
    expect(code).not.toMatch(/__LF_[A-Z_]+__/);
    expect(code).toContain('"abc"');
    expect(() => new vm.Script(code)).not.toThrow();
  });
  it("refuses a template that lacks a placeholder", () => {
    expect(() => renderSw("const V = __LF_VERSION__;", { version: "x", files: [], offlineHtml: "" })).toThrow(/placeholder/);
  });
});

// ---------------------------------------------------------------- the service worker, run in a pretend browser
const SCOPE = "https://example.test/Lazy-flight/";
type Listener = (event: any) => void;

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function pretendBrowser(source: string, opts: { network: Record<string, string>; offline?: boolean; existing?: Record<string, string[]> }) {
  const listeners: Record<string, Listener> = {};
  const store = new Map<string, Map<string, { body: Buffer; status: number }>>();
  for (const [name, urls] of Object.entries(opts.existing ?? {})) {
    store.set(name, new Map(urls.map((u) => [u, { body: Buffer.from("old"), status: 200 }])));
  }
  const log = { skipWaiting: 0, claim: 0, unregistered: 0, navigated: [] as string[], fetched: [] as string[] };
  const state = { offline: opts.offline ?? false };

  const toResponse = (e: { body: Buffer; status: number }) => new Response(e.body, { status: e.status });
  const keyOf = (r: string | Request) => (typeof r === "string" ? r : r.url);
  const cachesApi = {
    async open(name: string) {
      if (!store.has(name)) store.set(name, new Map());
      const box = store.get(name)!;
      return {
        async put(r: string | Request, res: Response) {
          box.set(keyOf(r), { body: Buffer.from(await res.arrayBuffer()), status: res.status });
        },
        async match(r: string | Request) {
          const e = box.get(keyOf(r));
          return e ? toResponse(e) : undefined;
        },
      };
    },
    async delete(name: string) {
      return store.delete(name);
    },
    async keys() {
      return [...store.keys()];
    },
  };
  const fakeFetch = async (r: string | Request) => {
    const url = keyOf(r);
    log.fetched.push(url);
    if (state.offline) throw new TypeError("Failed to fetch");
    const path = url.split("?")[0];
    if (!(path in opts.network)) return new Response("not found", { status: 404 });
    return new Response(opts.network[path], { status: 200 });
  };
  const self = {
    registration: {
      scope: SCOPE,
      async unregister() {
        log.unregistered++;
        return true;
      },
    },
    clients: {
      async claim() {
        log.claim++;
      },
      async matchAll() {
        return [{ url: SCOPE, async navigate(u: string) { log.navigated.push(u); } }];
      },
    },
    skipWaiting() {
      log.skipWaiting++;
    },
    addEventListener(type: string, fn: Listener) {
      listeners[type] = fn;
    },
  };
  const sandbox: Record<string, unknown> = { self, caches: cachesApi, fetch: fakeFetch, Request, Response, URL, crypto: webcrypto, console };
  vm.runInNewContext(source, sandbox);

  const waitable = (extra: object) => {
    let pending: Promise<unknown> = Promise.resolve();
    const event: any = { ...extra, waitUntil: (p: Promise<unknown>) => (pending = p), respondWith: (p: Promise<Response>) => (event.response = p) };
    return { event, done: () => pending };
  };
  return {
    log,
    state,
    listeners,
    store,
    async install() {
      const { event, done } = waitable({});
      listeners.install(event);
      await done();
    },
    async activate() {
      const { event, done } = waitable({});
      listeners.activate(event);
      await done();
    },
    message(data: unknown) {
      listeners.message({ data });
    },
    request(url: string, init: { method?: string; mode?: string } = {}) {
      const req = new Request(url, { method: init.method ?? "GET" });
      const wrapped = { url: req.url, method: req.method, mode: init.mode ?? "no-cors" } as unknown as Request;
      const { event } = waitable({ request: wrapped });
      listeners.fetch(event);
      return event.response as Promise<Response> | undefined;
    },
  };
}

const GAME_FILES: Record<string, string> = {
  "index.html": "<html>GAME v1</html>",
  "assets/app-1.js": "console.log(1)",
  "offline.html": "<html>OFFLINE FILE</html>",
};
const toList = (files: Record<string, string>) => Object.entries(files).map(([path, text]) => ({ path, hash: sha(text) }));
const toNetwork = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([p, t]) => [SCOPE + p, t]));
function swSource(files: Record<string, string>, version = "v1"): string {
  return renderSw(template, { version, files: toList(files), offlineHtml: "<html>BUILT-IN OFFLINE PAGE</html>" });
}
const text = async (p: Promise<Response> | undefined) => (await p!).text();
/** The error a promise rejects with (read by its message, because the helper script runs in its own pretend world). */
const rejection = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (error) {
    return String((error as { message?: string }).message ?? error);
  }
  return "DID NOT REJECT";
};

describe("service worker: install", () => {
  it("downloads every game file into one new box and does NOT take over by itself", async () => {
    const b = pretendBrowser(swSource(GAME_FILES), { network: toNetwork(GAME_FILES) });
    await b.install();
    expect([...b.store.keys()]).toEqual(["lazy-flight-v1"]);
    const box = b.store.get("lazy-flight-v1")!;
    for (const p of Object.keys(GAME_FILES)) expect(box.has(SCOPE + p)).toBe(true);
    expect(box.has(SCOPE + "__complete__")).toBe(true);
    expect(b.log.skipWaiting).toBe(0);
  });

  it("keeps nothing when a file is not the expected version (old and new never mix)", async () => {
    const net = toNetwork(GAME_FILES);
    net[SCOPE + "assets/app-1.js"] = "console.log('NEWER FILE FROM A LATER BUILD')";
    const b = pretendBrowser(swSource(GAME_FILES), { network: net });
    expect(await rejection(b.install())).toMatch(/expected version/);
    expect([...b.store.keys()]).toEqual([]);
  });

  it("keeps nothing when a download fails halfway", async () => {
    const net = toNetwork(GAME_FILES);
    delete net[SCOPE + "assets/app-1.js"];
    const b = pretendBrowser(swSource(GAME_FILES), { network: net });
    expect(await rejection(b.install())).toMatch(/Download failed/);
    expect([...b.store.keys()]).toEqual([]);
  });

  it("fails cleanly when offline during install, leaving older boxes alone", async () => {
    const b = pretendBrowser(swSource(GAME_FILES, "v2"), { network: toNetwork(GAME_FILES), offline: true, existing: { "lazy-flight-v1": [SCOPE + "index.html"] } });
    expect(await rejection(b.install())).not.toBe("DID NOT REJECT");
    expect([...b.store.keys()]).toEqual(["lazy-flight-v1"]);
  });
});

describe("service worker: activate", () => {
  it("deletes only OLD lazy-flight boxes, after the new one is complete, and takes over open pages", async () => {
    const b = pretendBrowser(swSource(GAME_FILES, "v2"), {
      network: toNetwork(GAME_FILES),
      existing: { "lazy-flight-v1": [SCOPE + "index.html"], "lazy-flight-v0": [], "someone-elses-box": [] },
    });
    await b.install();
    await b.activate();
    expect([...b.store.keys()].sort()).toEqual(["lazy-flight-v2", "someone-elses-box"]);
    expect(b.log.claim).toBe(1);
  });

  it("keeps the old boxes if the new box has vanished and the network is down", async () => {
    const b = pretendBrowser(swSource(GAME_FILES, "v2"), { network: toNetwork(GAME_FILES), offline: true, existing: { "lazy-flight-v1": [SCOPE + "index.html"] } });
    await b.activate();
    expect(b.store.has("lazy-flight-v1")).toBe(true);
    expect(b.log.claim).toBe(0);
  });
});

describe("service worker: serving", () => {
  async function ready() {
    const b = pretendBrowser(swSource(GAME_FILES), { network: toNetwork(GAME_FILES) });
    await b.install();
    await b.activate();
    return b;
  }

  it("serves the game page from the box with no network, even with ?seed= or ?speed= on the address", async () => {
    const b = await ready();
    b.state.offline = true;
    expect(await text(b.request(SCOPE, { mode: "navigate" }))).toContain("GAME v1");
    expect(await text(b.request(SCOPE + "index.html?seed=5&speed=600", { mode: "navigate" }))).toContain("GAME v1");
    expect(await text(b.request(SCOPE + "?speed=60", { mode: "navigate" }))).toContain("GAME v1");
  });

  it("serves kept game files from the box with no network, and does not touch the network for them", async () => {
    const b = await ready();
    b.state.offline = true;
    const before = b.log.fetched.length;
    expect(await text(b.request(SCOPE + "assets/app-1.js"))).toBe("console.log(1)");
    expect(b.log.fetched.length).toBe(before);
  });

  it("developer pages go to the network when online and show the friendly page (not a browser error) when offline", async () => {
    const net = { ...toNetwork(GAME_FILES), [SCOPE + "debug.html"]: "<html>DEBUG PAGE</html>" };
    const b = pretendBrowser(swSource(GAME_FILES), { network: net });
    await b.install();
    await b.activate();
    expect(await text(b.request(SCOPE + "debug.html", { mode: "navigate" }))).toContain("DEBUG PAGE");
    expect(b.store.get("lazy-flight-v1")!.has(SCOPE + "debug.html")).toBe(false);
    b.state.offline = true;
    expect(await text(b.request(SCOPE + "models.html", { mode: "navigate" }))).toContain("BUILT-IN OFFLINE PAGE");
  });

  it("if the stored copy was wiped and there is no network, shows the built-in friendly page", async () => {
    const b = await ready();
    b.store.get("lazy-flight-v1")!.clear();
    b.state.offline = true;
    expect(await text(b.request(SCOPE, { mode: "navigate" }))).toContain("BUILT-IN OFFLINE PAGE");
  });

  it("ignores other sites, non-GET requests and files it does not keep", async () => {
    const b = await ready();
    expect(b.request("https://other.example/x.js")).toBeUndefined();
    expect(b.request(SCOPE + "assets/app-1.js", { method: "POST" })).toBeUndefined();
    expect(b.request(SCOPE + "assets/not-kept.js")).toBeUndefined();
  });

  it("switches only when told to (REFRESH tap), never by itself", async () => {
    const b = await ready();
    b.message({ type: "SOMETHING_ELSE" });
    b.message(undefined);
    expect(b.log.skipWaiting).toBe(0);
    b.message({ type: "SKIP_WAITING" });
    expect(b.log.skipWaiting).toBe(1);
  });
});

describe("update flow A to B", () => {
  it("B downloads in the background while A keeps serving; after the switch only B files are served and A's box is gone", async () => {
    const filesB = { ...GAME_FILES, "index.html": "<html>GAME v2</html>", "assets/app-1.js": "console.log(2)" };
    const net = { ...toNetwork(GAME_FILES) };
    const a = pretendBrowser(swSource(GAME_FILES, "vA"), { network: net });
    await a.install();
    await a.activate();

    // version B is published; a pretend browser with A's box already stored installs B
    const b = pretendBrowser(swSource(filesB, "vB"), { network: toNetwork(filesB), existing: {} });
    for (const [name, box] of a.store) b.store.set(name, box);
    await b.install();
    expect([...b.store.keys()].sort()).toEqual(["lazy-flight-vA", "lazy-flight-vB"]);
    expect(b.log.skipWaiting).toBe(0);
    // until the switch, A's box is still complete and untouched
    expect(b.store.get("lazy-flight-vA")!.get(SCOPE + "index.html")!.body.toString()).toContain("GAME v1");
    await b.activate();
    expect([...b.store.keys()]).toEqual(["lazy-flight-vB"]);
    expect(await text(b.request(SCOPE, { mode: "navigate" }))).toContain("GAME v2");
    expect(await text(b.request(SCOPE + "assets/app-1.js"))).toBe("console.log(2)");
  });
});

describe("kill switch", () => {
  it("removes the stored copies, unregisters itself, reloads open pages, and never serves anything", async () => {
    const b = pretendBrowser(killSource, { network: {}, existing: { "lazy-flight-v1": [], "lazy-flight-v2": [], "someone-elses-box": [] } });
    expect(b.listeners.fetch).toBeUndefined();
    b.listeners.install({});
    expect(b.log.skipWaiting).toBe(1);
    await b.activate();
    expect([...b.store.keys()]).toEqual(["someone-elses-box"]);
    expect(b.log.unregistered).toBe(1);
    expect(b.log.navigated).toEqual([SCOPE]);
  });
});

describe("the new-version note", () => {
  it("shows only when an update is waiting, the moment is safe and the player has not said LATER", () => {
    expect(noteVisible(true, true, false)).toBe(true);
    expect(noteVisible(false, true, false)).toBe(false);
    expect(noteVisible(true, false, false)).toBe(false);
    expect(noteVisible(true, true, true)).toBe(false);
  });
});

describe("manifest, icons and page tags", () => {
  const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8"));
  function pngSize(path: string): [number, number] {
    const b = readFileSync(path);
    expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  }

  it("has the required fields for the GitHub Pages sub-folder", () => {
    expect(manifest.name).toBe("LAZY FLIGHT");
    expect(manifest.short_name).toBe("Lazy Flight");
    expect(manifest.start_url).toBe("./"); // relative to the manifest = the game folder, whatever it is called
    expect(manifest.scope).toBe("./");
    expect(["standalone", "fullscreen"]).toContain(manifest.display);
    expect(manifest.orientation).toBe("any");
    expect(manifest.background_color).toBe("#05060d");
    expect(manifest.theme_color).toBe("#05060d");
  });

  it("lists icons that exist and have the size they claim, including a maskable one", () => {
    const purposes = new Set<string>();
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(join(root, "public", icon.src))).toEqual([w, h]);
      purposes.add(icon.purpose);
    }
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
    expect(purposes.has("maskable")).toBe(true);
    expect(pngSize(join(root, "public/icons/apple-touch-icon-180.png"))).toEqual([180, 180]);
  });

  it("the game page links the manifest and the iPhone tags; other pages do not register a helper", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Lazy Flight"');
    for (const page of ["debug.html", "game-debug.html", "models.html", "planets.html"]) {
      expect(readFileSync(join(root, page), "utf8")).not.toMatch(/serviceWorker|rel="manifest"/);
    }
  });

  it("only src/ui/updatenote.ts talks to the service worker, and it never uses browser storage", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|css)$/.test(name) && /serviceWorker/.test(readFileSync(full, "utf8"))) hits.push(relative(root, full).replace(/\\/g, "/"));
      }
    };
    walk(join(root, "src"));
    expect(hits).toEqual(["src/ui/updatenote.ts"]);
    expect(readFileSync(join(root, "src/ui/updatenote.ts"), "utf8")).not.toMatch(/localStorage|sessionStorage/);
  });
});
