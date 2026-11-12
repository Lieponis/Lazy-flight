// Plain functions (no drawing) for stage P3: the SAVE FILE panel, the install hint and the tester speed switch.
// Tested in tests/ui-savefile.test.ts.

import type { SaveSummary } from "../save";
import { formatCredits } from "./logic";

// ------------------------------------------------------------ SAVE FILE panel

/** Short lines describing a save: what YOUR GAME NOW or THIS FILE holds. */
export function summaryLines(s: SaveSummary): string[] {
  const lines = [
    `${formatCredits(s.credits)} · ${s.ships.length} ${s.ships.length === 1 ? "ship" : "ships"} (flying the ${s.activeShip})`,
    s.ranks.map((r) => `${capital(r.label)}: ${r.rankName}`).join(" · "),
    `Explorer: ${s.explorer.rankName} · ${s.explorer.systems} ${s.explorer.systems === 1 ? "system" : "systems"} · ${s.explorer.planets} ${
      s.explorer.planets === 1 ? "planet" : "planets"
    }`,
  ];
  const extras: string[] = [];
  if (s.outposts > 0) extras.push(`${s.outposts} ${s.outposts === 1 ? "outpost" : "outposts"}`);
  if (s.paintJobs > 0) extras.push(`${s.paintJobs} ${s.paintJobs === 1 ? "paint job" : "paint jobs"}`);
  if (extras.length > 0) lines.push(extras.join(" · "));
  if (s.travelling) lines.push("A trip was under way when it was saved.");
  return lines;
}

/** One row of the side-by-side confirm (Andy chose A): label, THIS FILE, YOUR GAME NOW. */
export interface CompareRow {
  label: string;
  file: string;
  now: string;
}

/** The side-by-side table before an import replaces the game. `now` is null when there is no game here yet. */
export function compareRows(file: SaveSummary, now: SaveSummary | null): CompareRow[] {
  const ships = (s: SaveSummary): string => `${s.ships.length} ${s.ships.length === 1 ? "ship" : "ships"}`;
  const best = (s: SaveSummary): string => {
    const top = [...s.ranks].sort((a, b) => b.rankNumber - a.rankNumber || b.jobsDone - a.jobsDone)[0];
    return top ? top.rankName : "-";
  };
  const seen = (s: SaveSummary): string => `${s.explorer.systems} sys · ${s.explorer.planets} pl`;
  const dash = "-";
  return [
    { label: "CREDITS", file: formatCredits(file.credits), now: now ? formatCredits(now.credits) : dash },
    { label: "SHIPS", file: ships(file), now: now ? ships(now) : dash },
    { label: "BEST RANK", file: best(file), now: now ? best(now) : dash },
    { label: "EXPLORED", file: seen(file), now: now ? seen(now) : dash },
    { label: "OUTPOSTS", file: String(file.outposts), now: now ? String(now.outposts) : dash },
  ];
}

/** Warnings from the import check, made friendly: each starts with "!" so they read as a caution, never HTML. */
export function warningLines(warnings: readonly string[]): string[] {
  return warnings.filter((w) => w.trim() !== "").map((w) => `! ${w.trim()}`);
}

/** The red line on the big confirm button: it must be clear this replaces the current game. */
export const REPLACE_WARNING = "This replaces the game on this device. You can undo it once with UNDO LAST IMPORT.";

/** "lazy-flight-save-2026-11-12.json" is what the save code names the file; this just checks a name looks sane. */
export function isSaveFileName(name: string): boolean {
  return /\.(json|txt)$/i.test(name.trim());
}

// ------------------------------------------------------------ install hint and app tip (once only)

/** Its own small storage slot (not inside the save: each device shows its own hints once). */
export const HINTS_KEY = "lazy-freight.hints";

export interface HintsSeen {
  installHintSeen: boolean;
  appTipSeen: boolean;
}

/** Reads the stored flags. Missing or broken text: nothing seen yet. */
export function parseHints(text: string | null): HintsSeen {
  const none: HintsSeen = { installHintSeen: false, appTipSeen: false };
  if (!text) return none;
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object") return none;
    const r = raw as Record<string, unknown>;
    return { installHintSeen: r.installHintSeen === true, appTipSeen: r.appTipSeen === true };
  } catch {
    return none;
  }
}

export type DeviceKind = "ios" | "android" | "desktop";

/** Which kind of device, from the browser's user agent text (and touch points: new iPads say "Macintosh"). */
export function deviceKind(userAgent: string, maxTouchPoints = 0): DeviceKind {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** Which once-only note to show now, or null. Never during a trip, never with a menu open, never on desktop. */
export function hintToShow(
  device: DeviceKind,
  installedApp: boolean,
  seen: HintsSeen,
  safeMoment: boolean,
): "install-ios" | "install-android" | "app-tip" | null {
  if (!safeMoment) return null;
  if (installedApp) return seen.appTipSeen ? null : "app-tip";
  if (seen.installHintSeen) return null;
  if (device === "ios") return "install-ios";
  if (device === "android") return "install-android";
  return null;
}

export const HINT_TEXT = {
  "install-ios": "PLAY OFFLINE: tap Share, then Add to Home Screen.",
  "install-android": "PLAY OFFLINE: install Lazy Flight on this phone.",
  "app-tip": "Your progress from the browser is not here. Use MENU > SAVE FILE > IMPORT to bring it over.",
} as const;

/** The one-line tutorial hint in MENU (P3). */
export const SAVE_FILE_TIP = "New phone? SAVE FILE takes your game along.";

// ------------------------------------------------------------ tester speed (MENU > SETTINGS > TESTER)

/** Its own storage slot: not in the save, not exported. The game reads it at start (src/game/clock.ts startSpeed). */
export const TEST_SPEED_KEY = "lazy-freight.testspeed";

/** Andy's choices (2026-11-12). */
export const TEST_SPEEDS = [1, 10, 20, 60, 300, 1000] as const;

/** The stored choice as a number from the list, or 1. */
export function storedTestSpeed(text: string | null): number {
  const n = Number(text);
  return (TEST_SPEEDS as readonly number[]).includes(n) ? n : 1;
}

export function testSpeedLabel(speed: number): string {
  return speed === 1 ? "1x NORMAL" : `${speed}x`;
}

/** The line under the TESTER buttons. */
export function testSpeedStatus(chosen: number, running: number, addressSpeed: boolean): string {
  if (addressSpeed) return `Running at ${running}x from the web address (?speed=), which wins over this choice.`;
  if (chosen === running) return chosen === 1 ? "Running at normal speed." : `Running at ${running}x. Trips and income are faster.`;
  return `Chosen ${testSpeedLabel(chosen)}. Reload the game to use it (now ${running}x).`;
}

export const TESTER_WARNING = "For testing only: trips and income run faster. Set back to 1x NORMAL to play.";

function capital(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
