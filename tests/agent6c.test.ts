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
