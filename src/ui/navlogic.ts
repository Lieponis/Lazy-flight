// NAV-3 (Agent 5k): the words of MY PLACES and the FLIGHT PLAN screen. Pure functions, no screen code, so they are tested.
// Andy chose: rows grouped START / OUTPOSTS / STARRED / RECENT, tap a row for its buttons (A); badges READY TO FLY /
// REFUEL FIRST / NEEDS HOPS (A); the plan starts with a big NEXT HOP card (B).
// All numbers come from the game (getPlaces, planRoute); nothing is computed here but text.

import type { Place, RouteHop, RoutePlan } from "../game";
import { formatCredits } from "./logic";

export type PlaceGroup = "START" | "OUTPOSTS" | "STARRED" | "RECENT";

export const PLACE_BADGES: Record<Place["reach"], string> = {
  now: "READY TO FLY",
  refuel: "REFUEL FIRST",
  never: "NEEDS HOPS",
};

/** "12.0 ly" (one decimal, thousands separators for the far ones). */
export function formatLyShort(ly: number): string {
  return `${ly.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ly`;
}

/** The one group a place is listed under (a place appears once): start, then outpost, then starred, then recent. */
export function placeGroup(p: Pick<Place, "kinds">): PlaceGroup {
  if (p.kinds.includes("start")) return "START";
  if (p.kinds.includes("outpost")) return "OUTPOSTS";
  if (p.kinds.includes("starred")) return "STARRED";
  return "RECENT";
}

/** The places in their groups, in the order START, OUTPOSTS, STARRED, RECENT; empty groups are left out. */
export function groupPlaces<T extends Pick<Place, "kinds">>(places: readonly T[]): { group: PlaceGroup; places: T[] }[] {
  const order: PlaceGroup[] = ["START", "OUTPOSTS", "STARRED", "RECENT"];
  return order.map((group) => ({ group, places: places.filter((p) => placeGroup(p) === group) })).filter((g) => g.places.length > 0);
}

export interface PlaceRowText {
  title: string;
  /** "Kopipex JR62R-MT37 · 212.0 ly" or "Kopipex JR62R-MT37 · YOU ARE HERE" */
  sub: string;
  /** The badge, or "" when you are here. */
  badge: string;
  reach: Place["reach"] | "here";
  /** "★" when starred (and not already listed under STARRED), else "". */
  star: string;
  /** The game's plain sentence about the fuel, shown when the row is open. */
  detail: string;
}

export function placeRowText(p: Place): PlaceRowText {
  const here = p.isHere;
  return {
    title: p.name,
    sub: `${p.systemName} · ${here ? "YOU ARE HERE" : formatLyShort(p.distanceLy)}`,
    badge: here ? "" : PLACE_BADGES[p.reach],
    reach: here ? "here" : p.reach,
    star: p.starred && placeGroup(p) !== "STARRED" ? "★" : "",
    detail: here ? "You are here. Kettle's on." : p.reachText,
  };
}

export function starButtonText(starred: boolean): string {
  return starred ? "★ UNSTAR" : "☆ STAR";
}

export const PLACES_EMPTY = "No places yet. Fly somewhere and it shows up here.";
export const PLACES_TIP = "Tap a place for its buttons. Star the ones you like (up to 30).";

// ------------------------------------------------------------ flight plan

export interface PlanText {
  /** Title of the friendly box: "NEXT HOP", "YOU MADE IT", "NO WAY OUT FROM HERE", "THE TRAIL GOES COLD", "UNKNOWN PLACE". */
  title: string;
  /** The game's own sentence (or "" for a plain ok plan). */
  message: string;
  /** One friendly hint in the game's voice, or "". */
  hint: string;
  /** "8 hops · 212.0 ly · 410 fuel · about 600 CR of fuel" for ok plans, else "". */
  totals: string;
  /** "The plan shows the next 20 hops of about 61." when only part of the way is shown, else "". */
  more: string;
}

export function planText(plan: RoutePlan): PlanText {
  const none = { totals: "", more: "" };
  switch (plan.status) {
    case "here":
      return { title: "YOU MADE IT", message: plan.message ?? "", hint: "No hops needed. Tap the planet on the SYSTEM map to fly there.", ...none };
    case "too-far-no-docks":
      return { title: "NO WAY OUT FROM HERE", message: plan.message ?? "", hint: "Bigger tanks in the SHIPYARD reach farther.", ...none };
    case "stuck": {
      const gap = plan.gapLy !== null ? ` A gap of ${formatLyShort(plan.gapLy)} of empty space is wider than your hop (${formatLyShort(plan.rangeLy)}).` : "";
      const close = plan.closestLy !== null ? `The trail goes cold ${formatLyShort(plan.closestLy)} from there.` : "The trail goes cold.";
      return { title: "THE TRAIL GOES COLD", message: plan.message ?? `${close}${gap}`, hint: "A ship with a bigger tank could jump it. SHIPYARD.", ...none };
    }
    case "no-such-place":
      return { title: "UNKNOWN PLACE", message: plan.message ?? "There is no such place.", hint: "", ...none };
    default: {
      const n = plan.hops.length;
      const cost = plan.totalRefuelCredits > 0 ? ` · about ${formatCredits(plan.totalRefuelCredits)} of fuel` : "";
      const totals = `${n} ${n === 1 ? "hop" : "hops"} · ${formatLyShort(plan.totalLy)} · ${plan.totalFuel} fuel${cost}`;
      const more = plan.moreHops ? `The plan shows the next ${n} hops of about ${plan.hopsTotalEstimate}. Ask again after you arrive.` : "";
      // The game's message may repeat the "next 20 hops" sentence: show only what it adds.
      const msg = (plan.message ?? "").replace(/The plan shows the next \d+ hops of about \d+\. Ask again after you arrive\./, "").trim();
      return { title: "NEXT HOP", message: msg, hint: "", totals, more };
    }
  }
}

export interface HopText {
  title: string;
  /** "Fizfuwic TT-PR · 28.0 ly · 56 fuel" */
  sub: string;
  /** "Refuel first (about 40 CR)" or "". */
  refuel: string;
}

export function hopText(h: RouteHop): HopText {
  return {
    title: `${h.index}. ${h.dockName}`,
    sub: `${h.systemName} · ${formatLyShort(h.distanceLy)} · ${h.fuelNeeded} fuel`,
    refuel: h.refuelBefore ? `Refuel first${h.refuelCredits > 0 ? ` (about ${formatCredits(h.refuelCredits)})` : ""}` : "",
  };
}

export const PLAN_NONE = "No destination yet. Open MY PLACES and tap SET AS DESTINATION.";
export const STAR_FULL_HINT = "Unstar one in MY PLACES first.";
