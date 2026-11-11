// Helpers for the offline app (PWA) build step. Pure Node, no extra libraries, no network.
// Used by scripts/pwa/postbuild.mjs (runs after "vite build") and by tests/pwa.test.ts.
//
// Plain words: after Vite builds the game into the "dist" folder, we look at that folder, work out EVERY file
// the game needs to run, and write dist/sw.js (the service worker: a helper script that keeps a copy of those
// files on the phone and serves them when there is no network). Nothing is typed by hand.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix } from "node:path";

export const CACHE_PREFIX = "lazy-flight-";
export const GAME_PAGE = "index.html";
export const OFFLINE_PAGE = "offline.html";
/** Developer pages: online only, never kept offline. */
export const DEV_PAGES = ["debug.html", "game-debug.html", "models.html", "planets.html"];
/** The helper script itself is never in its own list. */
export const SW_FILE = "sw.js";

const TEXT_FILE = /\.(html|js|mjs|css|webmanifest|json|svg)$/i;

/** All files below a folder, as "a/b/c.js" paths (always forward slashes), sorted. */
export function listFiles(dir, base = "") {
  const out = [];
  for (const name of readdirSync(join(dir, base)).sort()) {
    const rel = base ? `${base}/${name}` : name;
    if (statSync(join(dir, rel)).isDirectory()) out.push(...listFiles(dir, rel));
    else out.push(rel);
  }
  return out;
}

export function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Reads pwa-mode.txt: "retire" turns the offline app off (the kill switch); anything else (or no file) is "on". */
export function readMode(text) {
  const first = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("#"));
  return (first ?? "on").toLowerCase() === "retire" ? "retire" : "on";
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Which of the known file paths does this text mention? A file counts when its file name appears as a whole token. */
export function findReferences(text, allPaths) {
  const found = new Set();
  for (const path of allPaths) {
    const name = posix.basename(path);
    if (!text.includes(name)) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_.-])${escapeRegExp(name)}(?![A-Za-z0-9_-]|\\.[A-Za-z0-9])`);
    if (re.test(text)) found.add(path);
  }
  return found;
}

/** Relative imports written in built JavaScript ("./chunk-abc.js"), resolved to dist paths. May point at missing files. */
export function relativeImports(fromPath, text) {
  const out = new Set();
  const re = /(?:\bfrom|\bimport)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.add(posix.normalize(posix.join(posix.dirname(fromPath), m[1])));
  }
  return out;
}

/** Local URLs written in HTML (src / href), CSS (url()) and the manifest (icons), resolved to dist paths. */
export function structuredLocalUrls(fromPath, text) {
  const raw = new Set();
  if (/\.html$/i.test(fromPath)) {
    const re = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(text)) !== null) raw.add(m[1]);
  } else if (/\.css$/i.test(fromPath)) {
    const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let m;
    while ((m = re.exec(text)) !== null) raw.add(m[1]);
  } else if (/\.webmanifest$/i.test(fromPath)) {
    try {
      const manifest = JSON.parse(text);
      for (const icon of manifest.icons ?? []) if (icon && typeof icon.src === "string") raw.add(icon.src);
      if (typeof manifest.start_url === "string") raw.add(manifest.start_url);
    } catch {
      /* a broken manifest is reported by the manifest check */
    }
  }
  const out = new Set();
  for (const url of raw) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) continue; // http:, data:, mailto:, //host, #anchor
    const clean = url.split(/[?#]/)[0];
    if (clean === "" || clean === "." || clean === "./") continue; // the page itself
    out.add(posix.normalize(posix.join(posix.dirname(fromPath), clean)));
  }
  return out;
}

/**
 * Everything reachable from the starting files. Returns { files: Set of dist paths, missing: [{from, to}] }.
 * "missing" = a file that is clearly imported (HTML tags, CSS url(), relative JS imports, manifest icons) but not in dist.
 */
export function closure(starts, allPaths, readText, skip = () => false) {
  const have = new Set(allPaths);
  const files = new Set();
  const missing = [];
  const queue = [...starts].filter((p) => have.has(p) && !skip(p));
  for (const p of queue) files.add(p);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!TEXT_FILE.test(current)) continue;
    const text = readText(current);
    const next = new Set(findReferences(text, allPaths));
    for (const to of structuredLocalUrls(current, text)) {
      if (!have.has(to)) missing.push({ from: current, to });
      else next.add(to);
    }
    if (/\.m?js$/i.test(current)) {
      for (const to of relativeImports(current, text)) {
        if (!have.has(to)) missing.push({ from: current, to });
        else next.add(to);
      }
    }
    for (const to of next) {
      if (to !== current && !files.has(to) && !skip(to)) {
        files.add(to);
        queue.push(to);
      }
    }
  }
  return { files, missing };
}

/**
 * Decide what the offline app keeps. Throws (with a plain message) when the build is not understood:
 * a file nobody references, or a file the game imports but dist does not contain.
 */
export function planPrecache(distDir) {
  const all = listFiles(distDir).filter((p) => p !== SW_FILE);
  if (!all.includes(GAME_PAGE)) throw new Error(`The built game page ${GAME_PAGE} is missing from ${distDir}.`);
  if (!all.includes(OFFLINE_PAGE)) throw new Error(`${OFFLINE_PAGE} is missing from ${distDir} (it lives in public/).`);
  const readText = (p) => readFileSync(join(distDir, p), "utf8");

  // The game's list never follows into developer pages, even if some text mentions one by name.
  const game = closure([GAME_PAGE, OFFLINE_PAGE], all, readText, (p) => DEV_PAGES.includes(p));
  const devStarts = DEV_PAGES.filter((p) => all.includes(p));
  const dev = closure(devStarts, all, readText);

  const problems = [];
  for (const m of game.missing) problems.push(`${m.from} uses ${m.to}, but that file is not in the built site.`);
  const unknown = all.filter((p) => !game.files.has(p) && !dev.files.has(p));
  for (const p of unknown) {
    problems.push(`${p} is in the built site but neither the game nor a developer page uses it. If the game loads it while running, the offline app would miss it.`);
  }
  if (problems.length > 0) throw new Error(`The offline file list cannot be made safely:\n- ${problems.join("\n- ")}`);

  const precache = [...game.files].sort();
  const files = precache.map((path) => ({ path, hash: sha256Hex(readFileSync(join(distDir, path))) }));
  const devOnly = [...dev.files].filter((p) => !game.files.has(p)).sort();
  return { files, devOnly, all };
}

/** A short name for this exact build. Changes when any kept file changes, or when the helper script's own code changes. */
export function versionOf(files, templateText) {
  const h = createHash("sha256");
  h.update(templateText);
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) h.update(`\n${f.path}:${f.hash}`);
  return h.digest("hex").slice(0, 12);
}

/** Fills the template's three placeholders. Throws if the template and this function disagree. */
export function renderSw(template, { version, files, offlineHtml }) {
  const parts = {
    __LF_VERSION__: JSON.stringify(version),
    __LF_FILES__: JSON.stringify(files),
    __LF_OFFLINE_HTML__: JSON.stringify(offlineHtml),
  };
  let out = template;
  for (const [token, value] of Object.entries(parts)) {
    if (!out.includes(token)) throw new Error(`The helper script template has no ${token} placeholder.`);
    out = out.split(token).join(value);
  }
  if (/__LF_[A-Z_]+__/.test(out)) throw new Error("The helper script template still has an unfilled placeholder.");
  return out;
}

export function fileExists(path) {
  return existsSync(path);
}
