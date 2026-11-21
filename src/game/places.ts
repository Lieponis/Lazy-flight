// MY PLACES (stage NAV-1): the start dock, your outposts, the last docks you used and the places you starred.
// Pure list rules; the Game adds names and distances from the universe.

import { MAX_RECENT_DOCKS, MAX_STARRED_PLACES } from "./settings";

export type PlaceKind = "start" | "outpost" | "recent" | "starred";

/** Newest first, no duplicates, at most MAX_RECENT_DOCKS. */
export function pushRecentDock(list: readonly string[], dockId: string): string[] {
  return [dockId, ...list.filter((id) => id !== dockId)].slice(0, MAX_RECENT_DOCKS);
}

export type StarResult = { ok: true; list: string[] } | { ok: false; reason: string; full?: true };

/** Adds a place id to the stars. Starring twice changes nothing. The 31st is refused. */
export function addStar(list: readonly string[], id: string): StarResult {
  if (list.includes(id)) return { ok: true, list: [...list] };
  if (list.length >= MAX_STARRED_PLACES) return { ok: false, full: true, reason: `You can star ${MAX_STARRED_PLACES} places. Remove one first.` };
  return { ok: true, list: [...list, id] };
}

export function removeStar(list: readonly string[], id: string): StarResult {
  if (!list.includes(id)) return { ok: false, reason: "That place is not starred." };
  return { ok: true, list: list.filter((x) => x !== id) };
}

/** A saved list of ids made safe: text only, no empty ids, no duplicates, at most `max`. */
export function cleanIdList(raw: unknown, max: number): string[] {
  const out: string[] = [];
  if (!Array.isArray(raw)) return out;
  for (const id of raw as unknown[]) {
    if (typeof id === "string" && id !== "" && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
