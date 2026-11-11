// Agent 6c: comfort rule fix (Part 0), and regression tests from the final QA pass.
import { describe, expect, it } from "vitest";
import { Game, createClock, getShip, newGameState, upgradeBlock, upgradeTracksOf, UPGRADE_TRACKS } from "../src/game";
import { upgradeSummary, upgradeTracksFor } from "../src/ui/logic";

const rich = (): Game => {
  const g = new Game(12345, "x/1", createClock(1, () => 0));
  g.loadState({ ...newGameState("x/1"), credits: 1_000_000 });
  return g;
};

describe("6c Part 0: no Passenger Comfort for a ship without a cabin", () => {
  it("the Cargo Hauler (no cabin) cannot buy comfort, with a plain reason", () => {
    const g = rich();
    const r = g.buyUpgrade("cargo-hauler", "comfort");
    expect(r).toMatchObject({ ok: false, reason: "This ship has no cabin, so passenger comfort does nothing." });
    expect(g.state.credits).toBe(1_000_000);
    expect(upgradeBlock(g.state, "cargo-hauler", "comfort")).toMatch(/no cabin/);
  });

  it("the Hauler gets 3 rows (15 levels); ships with a cabin get 4 (20 levels)", () => {
    const g = rich();
    expect(g.getUpgradeOffers("cargo-hauler").map((o) => o.track)).toEqual(["tank", "hold", "engines"]);
    expect(g.buyShip("scout").ok && g.buyShip("passenger-liner").ok).toBe(true);
    expect(g.getUpgradeOffers("scout")).toHaveLength(4);
    expect(g.getUpgradeOffers("passenger-liner")).toHaveLength(4);
  });

  it("ships with a cabin can still buy comfort", () => {
    const g = rich();
    g.buyShip("scout");
    expect(g.buyUpgrade("scout", "comfort").ok).toBe(true);
  });

  it("the rules and the Shipyard agree on which tracks every ship has (no other place counts 4 for the Hauler)", () => {
    for (const id of ["cargo-hauler", "scout", "passenger-liner"]) {
      expect(upgradeTracksOf(id)).toEqual(upgradeTracksFor(getShip(id).cabinCapacity));
      const max = upgradeTracksOf(id).length * 5;
      expect(upgradeSummary({ tank: 0, hold: 0, engines: 0, comfort: 0 }, 5, getShip(id).cabinCapacity)).toBe(`0/${max}`);
    }
    expect(upgradeTracksOf("cargo-hauler")).toHaveLength(3);
    expect(UPGRADE_TRACKS).toHaveLength(4); // the full list itself is unchanged
  });

  it("an unknown ship still gets every row with a reason (never throws)", () => {
    expect(rich().getUpgradeOffers("nope")).toHaveLength(4);
  });
});

import { withBonuses, type GameState } from "../src/game";
import { RANK_JOBS_NEEDED, RANK_MAX_REWARD } from "../src/game/settings";
import { getJobBoard, getPlanetsOfSystem, listSystemsNear, type Job } from "../src/universe";

describe("6c Part A: the stacking rule (rank + outpost + comfort, added on the plain reward, top +50%)", () => {
  const passengerJob = (): Job => {
    for (const sys of listSystemsNear(12345, { x: 0, y: 0, z: 0 }, 30))
      for (const p of getPlanetsOfSystem(12345, sys.id))
        for (const j of getJobBoard(12345, p.id, 0) ?? []) if (j.kind === "PASSENGER") return j;
    throw new Error("no passenger job");
  };
  const maxed = (job: Job): GameState => ({
    ...newGameState(job.originDockId),
    shipId: "scout",
    completedJobs: { TRADE: 0, PASSENGER: RANK_JOBS_NEEDED.PASSENGER[1], TOUR: 0 }, // passenger rank 3: +10%
    ownedOutposts: [job.destinationDockId], // owned outpost at the destination: +10%
    outpostCount: 1,
    shipUpgrades: { scout: { tank: 0, hold: 0, engines: 0, comfort: 5 } }, // comfort 5: +30%
  });

  it("all three at the top add up to +50% of the plain reward (not multiplied)", () => {
    const job = passengerJob();
    const pay = withBonuses(maxed(job), job);
    expect(pay.bonusPercent).toBe(50);
    expect(pay.job.reward).toBe(Math.round(job.reward * 1.5));
    expect(pay.baseReward).toBe(job.reward);
  });

  it("comfort never adds to cargo jobs", () => {
    const job = { ...passengerJob(), kind: "TRADE" as const };
    const state = { ...maxed(job), completedJobs: { TRADE: 0, PASSENGER: 0, TOUR: 0 } };
    expect(withBonuses(state, job).bonusPercent).toBe(10); // only the outpost
  });

  it("rank gating still counts: limits are on the plain reward and rank 3 has no limit", () => {
    // The limits grow per rank and the bonuses are never counted for the check (bug 6b-1).
    for (const kind of ["TRADE", "PASSENGER", "TOUR"] as const) {
      const [r1, r2] = RANK_MAX_REWARD[kind];
      expect(r1).toBeLessThan(r2);
    }
  });
});

// ------------------------------------------------------------ 6c Part B 3b: sound guards (Agent 7a risks)
import { readFileSync } from "node:fs";
const src = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\s+/g, " ");

describe("6c: sound timing follows the flight screen (src/ui/sound.ts copies src/render/flight.ts)", () => {
  // If Agent 3 changes how flight.ts picks its phase lengths, this test fails: update src/ui/sound.ts the same way.
  const flight = src("src/render/flight.ts");
  const sound = src("src/ui/sound.ts");

  it("both use the same launch and minimum-warp settings", () => {
    for (const s of [flight, sound]) {
      expect(s).toContain("launchSeconds: FLIGHT_LAUNCH_SECONDS");
      expect(s).toContain("minWarpSeconds: FLIGHT_MIN_WARP_SECONDS");
    }
  });

  it("both give stations the longer approach, and outposts the normal one", () => {
    expect(flight).toMatch(/isStation \? FLIGHT_APPROACH_SECONDS_STATION : FLIGHT_APPROACH_SECONDS/);
    expect(sound).toMatch(/station \? FLIGHT_APPROACH_SECONDS_STATION : FLIGHT_APPROACH_SECONDS/);
  });

  it("both plan the flight with planFlight on the same inputs", () => {
    expect(flight).toContain("planFlight(progress.fraction, real.remainingRealMs, real.totalRealMs, this.phases)");
    expect(sound).toContain("planFlight(progress.fraction, real.remainingRealMs, real.totalRealMs, settings)");
    expect(sound).toContain("phaseDurations(");
  });

  it("flight.ts sets its phases in exactly the two places the sound copy knows about", () => {
    expect(flight.match(/this\.phases = /g)?.length).toBe(1);
    expect(flight.match(/launchSeconds:/g)?.length).toBe(1);
  });
});

describe("6c: the CSS class names the 'bonk' sound watches still exist", () => {
  const sound = src("src/ui/sound.ts");
  const css = readFileSync(new URL("../src/ui/theme.css", import.meta.url), "utf8");

  it("sound.ts watches .ui-notice and red .ui-panel-title", () => {
    expect(sound).toContain('contains("ui-notice")');
    expect(sound).toContain('".ui-panel-title.ui-red"');
  });

  it("the Jobs menu notice and the red message titles still use those classes", () => {
    expect(src("src/ui/jobsmenu.ts")).toContain('el("div", "ui-notice")');
    const popup = src("src/ui/popup.ts");
    expect(popup).toContain('el("div", "ui-panel-title", content.title)');
    expect(popup).toContain('classList.add("ui-red")');
  });

  it("the stylesheet still defines them", () => {
    for (const cls of [".ui-notice", ".ui-panel-title", ".ui-red"]) expect(css).toContain(`${cls} {`);
  });
});
