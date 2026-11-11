/* LAZY FLIGHT offline helper (service worker).
 *
 * The build (scripts/pwa/postbuild.mjs) made this file from scripts/pwa/sw.template.js by filling in the version, the
 * file list and the offline page. Edit the template, never dist/sw.js.
 *
 * What it does, in plain words:
 *  1. First visit: downloads EVERY game file into one new box (a "cache"), checks each file's fingerprint, and only
 *     keeps the box if all files are present and correct. Otherwise it throws the box away.
 *  2. Later visits: serves the game from that box, so it works with no internet.
 *  3. New game version: the new version downloads into a NEW box in the background. The old version keeps running.
 *     The switch happens only at the next launch, or when the player taps REFRESH on the "new version ready" note.
 *     Old and new files are never mixed, and the old box is deleted only after the new one is complete.
 *  4. Developer pages (debug, models, ...) are never kept offline. They go to the network as usual.
 *  Saves live in localStorage, which this script never touches.
 */
"use strict";

const VERSION = __LF_VERSION__;
const FILES = __LF_FILES__; // [{ path, hash }] paths are relative to the folder this script lives in
const OFFLINE_HTML = __LF_OFFLINE_HTML__;

const CACHE_PREFIX = "lazy-flight-";
const CACHE = CACHE_PREFIX + VERSION;

const SCOPE = self.registration.scope; // e.g. https://name.github.io/Lazy-flight/
const urlOf = (path) => new URL(path, SCOPE).href;
const INDEX_URL = urlOf("index.html");
const COMPLETE_URL = urlOf("__complete__"); // written last: its presence means "the whole box is here"
const PRECACHED = new Set(FILES.map((f) => urlOf(f.path)));

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function offlineResponse() {
  return new Response(OFFLINE_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Download one file fresh from the network and check its fingerprint. */
async function download(file) {
  const response = await fetch(new Request(urlOf(file.path), { cache: "reload" }));
  if (!response.ok) throw new Error("Download failed (" + response.status + "): " + file.path);
  const bytes = await response.clone().arrayBuffer();
  const digest = toHex(await crypto.subtle.digest("SHA-256", bytes));
  if (digest !== file.hash) throw new Error("File is not the expected version: " + file.path);
  return response;
}

/** Fill a brand new box with the whole game. All or nothing. */
async function fillBox() {
  await caches.delete(CACHE);
  const cache = await caches.open(CACHE);
  try {
    const responses = await Promise.all(FILES.map(download));
    await Promise.all(FILES.map((file, i) => cache.put(urlOf(file.path), responses[i])));
    await cache.put(COMPLETE_URL, new Response(VERSION));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
}

self.addEventListener("install", (event) => {
  // No skipWaiting here on purpose: an update waits until a safe moment (next launch, or the player's tap).
  event.waitUntil(fillBox());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      if (!(await cache.match(COMPLETE_URL))) {
        // The box vanished between install and activate (the phone cleaned storage). Try again; if offline, keep the old boxes.
        try {
          await fillBox();
        } catch (error) {
          return;
        }
      }
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function serveGamePage(request) {
  const cache = await caches.open(CACHE);
  const kept = await cache.match(INDEX_URL); // the address may carry ?seed= or ?speed=: always the same page
  if (kept) return kept;
  try {
    return await fetch(request);
  } catch (error) {
    return offlineResponse();
  }
}

async function serveFile(url, request) {
  const cache = await caches.open(CACHE);
  const kept = await cache.match(url);
  if (kept) return kept;
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== new URL(SCOPE).origin) return; // never touch other sites

  if (request.mode === "navigate") {
    const page = url.origin + url.pathname;
    if (page === SCOPE || page === INDEX_URL) {
      event.respondWith(serveGamePage(request));
    } else {
      // Developer pages and anything else: network only. Offline shows the friendly page, not the browser's error.
      event.respondWith(fetch(request).catch(() => offlineResponse()));
    }
    return;
  }

  const key = url.origin + url.pathname; // files are matched without ?query
  if (PRECACHED.has(key)) event.respondWith(serveFile(key, request));
});
