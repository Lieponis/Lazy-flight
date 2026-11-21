// RESCUE START (hotfix 2026-11-21). Imported by src/main.ts right after the preview boot, so it runs before any heavy game code.
//
// Plain words: the game counts how many times in a row it started but did not keep running for 20 seconds or close normally (a crash, or the
// phone closing it). After 2 such starts in a row, or when the address has ?rescue=1, the game does NOT start. Instead a small
// SAFE START screen appears: it forgets only the flight plan destination (never the save), offers SAVE FILE DOWNLOAD to back
// up the save, and a START GAME button. The installed iPhone app cannot type ?rescue=1, which is why the counter exists.

import { exportSaveFile } from "./save/transfer";
import type { StorageLike } from "./save/save";
import { NAV_TARGET_KEY } from "./ui/navtarget";
import { useNewestVersion } from "./ui/updatenote";

/** Unfinished starts in a row. Reset to 0 once the game has run for BOOT_OK_MS. */
export const BOOT_GUARD_KEY = "lazy-flight.boot-guard";
export const BOOT_OK_MS = 20_000;
/** This many unfinished starts in a row open the SAFE START screen. */
export const RESCUE_AFTER_FAILED_STARTS = 2;
/** Set (for this tab only) by START GAME on the rescue screen, so the next start goes ahead once. */
const SKIP_KEY = "lazy-flight.rescue-skip";

export interface RescueDecision {
  rescue: boolean;
  why: "asked" | "crashes" | null;
  failedStarts: number;
}

/** Pure: should this start open the SAFE START screen? */
export function decideRescue(search: string, guardText: string | null, skipOnce: boolean): RescueDecision {
  const failedStarts = Math.max(0, Math.min(99, Number.parseInt(guardText ?? "0", 10) || 0));
  if (/[?&]rescue=1(&|$)/.test(search)) return { rescue: true, why: "asked", failedStarts };
  if (!skipOnce && failedStarts >= RESCUE_AFTER_FAILED_STARTS) return { rescue: true, why: "crashes", failedStarts };
  return { rescue: false, why: null, failedStarts };
}

function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}

/**
 * Runs the start guard. Returns true when the rescue screen took over (the caller must then start NOTHING else).
 * Never touches the save.
 */
export function runBootGuard(
  storage: StorageLike | null,
  session: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
  parent: HTMLElement,
): boolean {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const skipOnce = safe(() => session?.getItem(SKIP_KEY) === "1", false);
  if (skipOnce) safe(() => session?.removeItem(SKIP_KEY), undefined);
  const decision = decideRescue(search, safe(() => storage?.getItem(BOOT_GUARD_KEY) ?? null, null), skipOnce);
  if (decision.rescue) {
    // Forget only the flight plan destination (a browser preference, not part of the save) and reset the counter.
    safe(() => storage?.removeItem(NAV_TARGET_KEY), undefined);
    safe(() => storage?.removeItem(BOOT_GUARD_KEY), undefined);
    showRescueScreen(storage, session, parent, decision);
    useNewestVersion();
    return true;
  }
  // Count this start; it is taken back once the game has kept running for BOOT_OK_MS, or when the page is left normally
  // (reload, closing or switching away: "pagehide" / hidden). A crash does neither, so only crashes keep counting.
  safe(() => storage?.setItem(BOOT_GUARD_KEY, String(decision.failedStarts + 1)), undefined);
  const clear = (): void => safe(() => storage?.removeItem(BOOT_GUARD_KEY), undefined);
  window.setTimeout(clear, BOOT_OK_MS);
  window.addEventListener("pagehide", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") clear();
  });
  return false;
}

function showRescueScreen(
  storage: StorageLike | null,
  session: Pick<Storage, "setItem"> | null,
  parent: HTMLElement,
  decision: RescueDecision,
): void {
  const box = document.createElement("div");
  box.className = "lf-rescue";
  box.style.cssText =
    "position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;" +
    "padding:24px;background:#000;color:#cfd3ff;font:16px/1.4 monospace;text-align:center;";
  const title = document.createElement("div");
  title.textContent = "SAFE START";
  title.style.cssText = "font-size:22px;letter-spacing:3px;color:#fff;";
  const text = document.createElement("div");
  text.style.maxWidth = "28em";
  text.textContent =
    (decision.why === "crashes" ? "The game did not start properly the last times. " : "") +
    "The flight plan destination was cleared. Your save is untouched. Back it up first, then start the game.";
  const status = document.createElement("div");
  status.style.cssText = "min-height:1.4em;color:#9fe0a0;";
  const makeButton = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = "font:bold 16px monospace;padding:12px 18px;min-width:14em;background:#1d2350;color:#fff;border:2px solid #6f7cff;border-radius:4px;";
    b.addEventListener("click", onClick);
    return b;
  };
  const download = makeButton("SAVE FILE DOWNLOAD", () => {
    const r = safe(() => exportSaveFile(storage), { ok: false as const, reason: "The save could not be read." });
    if (!r.ok) {
      status.textContent = r.reason;
      return;
    }
    const file = new File([r.json], r.filename, { type: "application/json" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const plain = (): void => {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = `Saved ${r.filename} (look in Downloads or Files).`;
    };
    if (typeof nav.share === "function" && safe(() => nav.canShare?.({ files: [file] }) === true, false)) {
      nav.share({ files: [file], title: r.filename }).then(() => (status.textContent = `Shared ${r.filename}.`)).catch(plain);
      return;
    }
    plain();
  });
  const start = makeButton("START GAME", () => {
    safe(() => session?.setItem(SKIP_KEY, "1"), undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("rescue");
    window.location.replace(url.toString());
  });
  box.append(title, text, download, start, status);
  parent.append(box);
}
