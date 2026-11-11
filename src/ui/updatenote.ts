// Offline app glue (stage P1, Agent 1b). One small file; the game code does not know about it.
//  1. Registers the offline helper (service worker, "sw.js") in the game page only, only in the published game.
//  2. When a new version of the game has finished downloading in the background, shows a small note:
//     "NEW VERSION READY - REFRESH". It appears only at a SAFE moment (never during a trip), and tapping REFRESH
//     reloads into the new version. If nobody taps, the new version starts by itself at the next launch.
//  3. Kill switch: when the build is made with pwa-mode.txt = "retire", this file only removes any old helper.
// Saves are never touched here: this file does not read or write any browser storage.

import { button, el } from "./dom";

/** Set at build time from pwa-mode.txt (see vite.config.ts): true = offline app on, false = retired (kill switch). */
declare const __PWA_ENABLED__: boolean;

/** Pure rule, tested: show the note only when a new version is waiting, it is a safe moment and the player has not said LATER. */
export function noteVisible(updateReady: boolean, safeMoment: boolean, dismissed: boolean): boolean {
  return updateReady && safeMoment && !dismissed;
}

const STYLE = `
.lf-update { position: fixed; left: 50%; transform: translateX(-50%); bottom: max(10px, env(safe-area-inset-bottom));
  z-index: 200; max-width: min(92vw, 420px); box-sizing: border-box; padding: 10px 12px;
  background: var(--ui-bg-panel, #05090f); border: 1px solid var(--ui-amber, #ffb547); color: var(--ui-text, #cfe9e6);
  font-family: var(--ui-font, monospace); font-size: 20px; line-height: 1.1; text-align: center; }
.lf-update[hidden] { display: none; }
.lf-update-title { color: var(--ui-amber, #ffb547); letter-spacing: 1px; margin-bottom: 4px; }
.lf-update-row { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }
`;

function buildNote(parent: HTMLElement, onRefresh: () => void, onLater: () => void): HTMLElement {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);
  const root = el("div", "lf-update ui-layer");
  root.setAttribute("role", "status");
  root.hidden = true;
  root.append(
    el("div", "lf-update-title", "NEW VERSION READY"),
    el("div", "", "A fresher Lazy Flight is waiting. Your progress is saved."),
  );
  const row = el("div", "lf-update-row");
  row.append(button("REFRESH", "ui-btn-primary", onRefresh), button("LATER", "", onLater));
  root.append(row);
  parent.append(root);
  return root;
}

/**
 * Starts the offline app. isSafe() must be true only when nothing important is running
 * (no job, no free trip, not on the flight screen).
 */
export function startOfflineApp(parent: HTMLElement, isSafe: () => boolean): void {
  if (!import.meta.env.PROD) return; // "npm run dev" has no sw.js
  if (!("serviceWorker" in navigator)) return;

  if (!__PWA_ENABLED__) {
    // Kill switch build: remove any helper that is still registered (the retired sw.js also clears the stored copies).
    void navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => void r.unregister()));
    return;
  }
  if (!window.isSecureContext) return; // helpers only work on https (and localhost)

  let waiting: ServiceWorker | null = null;
  let dismissed = false;
  let refreshing = false;
  const note = buildNote(
    parent,
    () => {
      if (!waiting) return;
      refreshing = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => window.location.reload(), 4000); // if the switch is slow, reload anyway (old files still work)
    },
    () => {
      dismissed = true;
      note.hidden = true;
    },
  );
  const sync = (): void => {
    note.hidden = !noteVisible(waiting !== null, isSafe(), dismissed);
  };
  window.setInterval(sync, 1500);

  // When the new helper takes over (after the player tapped REFRESH), load the new version.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) window.location.reload();
  });

  const watch = (registration: ServiceWorkerRegistration): void => {
    const update = (worker: ServiceWorker | null): void => {
      // "controller" is set only if an older helper already runs this page: then it is an UPDATE, not the first visit.
      if (worker && navigator.serviceWorker.controller) {
        waiting = worker;
        sync();
      }
    };
    update(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") update(worker);
      });
    });
    // An installed app can stay open for days: look for a new version whenever the player comes back to it.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void registration.update().catch(() => undefined);
    });
  };

  const register = (): void => {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then(watch)
      .catch(() => undefined); // no helper = the game still plays online, exactly as before
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register); // after the game has loaded, so the first visit is never slowed down
}
