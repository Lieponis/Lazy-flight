// NAV-3 (Agent 5k): the words of MY PLACES and the FLIGHT PLAN screen.
import { describe, expect, it } from "vitest";
import type { Place, RouteHop, RoutePlan } from "../src/game";
import { Game, createClock } from "../src/game";
import { WORLD_SEED, startDockOf } from "../src/universe";
import { overlayAllowed } from "../src/ui/logic";
import { PLACE_BADGES, formatLyShort, groupPlaces, hopText, placeGroup, placeRowText, planText, starButtonText } from "../src/ui/navlogic";

const place = (over: Partial<Place>): Place => ({
  id: "1/1",
  kinds: ["recent"],
  name: "Rattling Biscuit Station",
  systemId: 1,
  systemName: "Bimlithus Junction N2M5P-9RJ6",
  dockId: "1/1",
  distanceLy: 212,
  fuelNeeded: 424,
  reach: "never",
  reachText: "Too far for this ship: needs 424 fuel, the tank holds 60.",
  starred: false,
  isHere: false,
  ...over,
});

const hop = (over: Partial<RouteHop>): RouteHop => ({
  index: 1,
  dockId: "2/1",
  dockName: "Lonely Basin Outpost",
  systemId: 2,
  systemName: "Kopipex JR62R-MT37",
  distanceLy: 28.04,
  fuelNeeded: 56,
  refuelBefore: false,
  refuelCredits: 0,
  ...over,
});

const plan = (over: Partial<RoutePlan>): RoutePlan => ({
  status: "ok",
  target: { id: "9/1", name: "Far Away Station", systemId: 9 },
  hops: [hop({}), hop({ index: 2, refuelBefore: true, refuelCredits: 40 })],
  moreHops: false,
  hopsTotalEstimate: 2,
  totalLy: 56.1,
  totalFuel: 112,
  totalRefuelCredits: 40,
  rangeLy: 29,
  closestLy: null,
  gapLy: null,
  message: null,
  ...over,
});

describe("MY PLACES words (Andy chose A: grouped rows, badges READY TO FLY / REFUEL FIRST / NEEDS HOPS)", () => {
  it("badges", () => {
    expect(PLACE_BADGES).toEqual({ now: "READY TO FLY", refuel: "REFUEL FIRST", never: "NEEDS HOPS" });
  });

  it("each place sits in one group, in the order start, outposts, starred, recent", () => {
    expect(placeGroup({ kinds: ["outpost", "starred"] })).toBe("OUTPOSTS");
    expect(placeGroup({ kinds: ["recent", "starred"] })).toBe("STARRED");
    expect(placeGroup({ kinds: ["start", "recent"] })).toBe("START");
    const groups = groupPlaces([place({ kinds: ["recent"] }), place({ kinds: ["start"] }), place({ kinds: ["starred"] })]);
    expect(groups.map((g) => g.group)).toEqual(["START", "STARRED", "RECENT"]);
  });

  it("row text keeps the whole name and code, shows distance and badge; here and starred", () => {
    const t = placeRowText(place({ kinds: ["outpost"], starred: true }));
    expect(t).toMatchObject({ title: "Rattling Biscuit Station", sub: "Bimlithus Junction N2M5P-9RJ6 · 212.0 ly", badge: "NEEDS HOPS", reach: "never", star: "★" });
    expect(placeRowText(place({ kinds: ["starred"], starred: true })).star).toBe(""); // already under STARRED
    const here = placeRowText(place({ isHere: true, distanceLy: 0, reach: "now" }));
    expect(here).toMatchObject({ badge: "", reach: "here", sub: "Bimlithus Junction N2M5P-9RJ6 · YOU ARE HERE" });
    expect(formatLyShort(12345.67)).toBe("12,345.7 ly");
    expect(starButtonText(false)).toBe("☆ STAR");
    expect(starButtonText(true)).toBe("★ UNSTAR");
  });
});

describe("FLIGHT PLAN words (Andy chose B: a big NEXT HOP card first)", () => {
  it("ok plan: totals, refuel line, the 'next 20 of about N' line", () => {
    const t = planText(plan({}));
    expect(t).toMatchObject({ title: "NEXT HOP", message: "", totals: "2 hops · 56.1 ly · 112 fuel · about 40 CR of fuel", more: "" });
    const long = planText(
      plan({ moreHops: true, hopsTotalEstimate: 61, message: "The plan shows the next 2 hops of about 61. Ask again after you arrive." }),
    );
    expect(long.more).toBe("The plan shows the next 2 hops of about 61. Ask again after you arrive.");
    expect(long.message).toBe(""); // not twice
    expect(hopText(hop({}))).toEqual({ title: "1. Lonely Basin Outpost", sub: "Kopipex JR62R-MT37 · 28.0 ly · 56 fuel", refuel: "" });
    expect(hopText(hop({ refuelBefore: true, refuelCredits: 40 })).refuel).toBe("Refuel first (about 40 CR)");
  });

  it("friendly titles for here, too far, stuck and unknown", () => {
    expect(planText(plan({ status: "here", hops: [], message: "You are already in that star system. Fly there directly." })).title).toBe("YOU MADE IT");
    const far = planText(plan({ status: "too-far-no-docks", hops: [], message: "No dock lies within one tank of here (29 ly)." }));
    expect(far).toMatchObject({ title: "NO WAY OUT FROM HERE", message: "No dock lies within one tank of here (29 ly).", totals: "" });
    const stuck = planText(plan({ status: "stuck", hops: [], closestLy: 120.5, gapLy: 41.2, message: null }));
    expect(stuck.title).toBe("THE TRAIL GOES COLD");
    expect(stuck.message).toBe("The trail goes cold 120.5 ly from there. A gap of 41.2 ly of empty space is wider than your hop (29.0 ly).");
    expect(planText(plan({ status: "no-such-place", target: null, hops: [], message: null })).title).toBe("UNKNOWN PLACE");
  });

  it("MY PLACES and FLIGHT PLAN may open on every screen, in flight too (MENU everywhere)", () => {
    expect(overlayAllowed("starmap", "places", false)).toBe("places");
    expect(overlayAllowed("system", "plan", false)).toBe("plan");
    expect(overlayAllowed("flight", "plan", false, true)).toBe("plan");
    expect(overlayAllowed("flight", "places", true)).toBe("places");
    expect(overlayAllowed("flight", "menu", true)).toBe("menu");
    expect(overlayAllowed("starmap", "ranks", false)).toBe("ranks");
    expect(overlayAllowed("flight", "jobs", true)).toBe("none"); // the Jobs board stays a dock thing
  });

  it("a real plan from the start dock to a far place reads well", () => {
    const g = new Game(WORLD_SEED, startDockOf(WORLD_SEED).id, createClock(1));
    const far = g.getPlaces().find((p) => !p.isHere);
    const target = far?.id ?? String(startDockOf(WORLD_SEED).systemId);
    const t = planText(g.planRoute(target));
    expect(t.title.length).toBeGreaterThan(0);
  });
});
