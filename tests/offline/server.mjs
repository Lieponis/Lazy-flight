// A tiny web server for the offline checks: serves a built folder under /Lazy-flight/, the way GitHub Pages does.
// - The folder can be switched while running (update test: version A, then version B).
// - Every request is written to a log, so a check can prove "the game never asked the server".
// - It can be paused (answers nothing, like a dead connection) without stopping.
// Plain Node, no libraries.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

export const BASE = "/Lazy-flight/";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * Starts the server on a free port. Returns { url, setRoot(dir), log, clearLog(), close() }.
 * url ends with /Lazy-flight/.
 */
export async function startServer(rootDir) {
  let root = resolve(rootDir);
  const log = [];
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    log.push(path);
    if (!path.startsWith(BASE)) {
      res.writeHead(404).end("not here");
      return;
    }
    let rel = path.slice(BASE.length);
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = normalize(join(root, rel));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      const body = await readFile(file);
      // GitHub Pages lets browsers keep files for 10 minutes; the offline helper must not depend on that, so the
      // checks use "no-cache" (always ask) to make sure the service worker, not the browser cache, does the work.
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("404 not found");
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}${BASE}`,
    setRoot(dir) {
      root = resolve(dir);
    },
    log,
    clearLog() {
      log.length = 0;
    },
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}
