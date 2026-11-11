/* LAZY FLIGHT kill switch (retired offline helper).
 *
 * When pwa-mode.txt says "retire", the build publishes THIS file as sw.js instead of the real helper.
 * Phones that run the old helper check sw.js, find this one, and this one removes itself:
 * it deletes the stored game copies, unregisters, and reloads the open game from the network.
 * It has no fetch handler, so it never serves anything. Saves (localStorage) are not touched.
 */
"use strict";

const CACHE_PREFIX = "lazy-flight-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      for (const w of windows) {
        try {
          await w.navigate(w.url);
        } catch (error) {
          /* the player's next launch will load from the network anyway */
        }
      }
    })(),
  );
});
