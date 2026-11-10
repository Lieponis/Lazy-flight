# Agent 5 report, part 5d: Upgrades panel in the Shipyard

## 1. What was built (src/ui and tests only)
- **Upgrades inside the ship card** (Andy chose layout B out of A/B/C). Every owned ship's Shipyard card has an **UPGRADES n/15 or n/20 ▼** button next to ACTIVE or SWITCH. It unfolds the tracks inside the card. Each row shows: the name, LEVEL n/5 with a small bar, "Next: <effect>" (the API's `effect` text), and **BUY LEVEL n · price**, or **MAX**. Blocked rows show short plain reasons: "Need 2,500 CR more", "Not during a flight", "Max level", "Buy the ship first". A purchase shows the funny `line` in the shared message card. It works for the active ship and for parked owned ships (the API takes a ship id). BUY and SWITCH work as before.
- **Andy's decision during testing:** no **Passenger Comfort** for a ship without a cabin. The Cargo Hauler shows 3 tracks, counted out of 15. Ships with a cabin show 4, counted out of 20. (`upgradeTracksFor` in `logic.ts`.)
- **Real numbers everywhere:**
  - the status-strip tank: `game.getShipStats().fuelTankSize`;
  - the cockpit glue in `index.ts`: `fuelMax` is the real tank, and `fuelUsed` is `tripFuelCost(game.state, distance)`;
  - the Shipyard card's cargo, cabin, tank and fuel: `entry.stats`.
  The Jobs menu (fuel needed, blocked reasons), Refuel and emergency fuel already go through game rules that use the real numbers. A search of src/ui finds no other `getShip(...)` or `fuelCost(...)` reads.
- **Tests:** 10 new tests in `tests/ui.test.ts`, covering real vs base numbers, upgrade row text, max, short reasons, the summary count, no comfort without a cabin, and engines lowering trip fuel. Total: 465 tests pass.

## 2. Verified
- `npm run check` on current `main`: 465 pass. GitHub Actions green for commits 702f030 and bca25a8.
- Headless browser at 360×740 and 740×360: unfold, buy each track, the message card, blocked reasons, status strip 30/66, Refuel to 66, reload keeps levels. The page never scrolls.
- Andy (live game, phone upright and sideways): buying levels; the Hauler without comfort; real numbers in the status strip, Jobs, Refuel and Shipyard; switching ships shows each ship's own levels; blocked buy; MAX; reload keeps everything.

## 3. Known issues, and for the Lead
- **Rule gap (needs Agent 4, src/game):** `buyUpgrade` still allows Passenger Comfort on a ship with no cabin. The UI hides it, but `/game-debug.html` can still buy it, and a level already bought on the Hauler stays spent (it is hidden and has no effect). Suggested rule: `upgradeBlock` refuses "comfort" when the ship's cabin is 0, and `getUpgradeOffers` leaves that row out.
- The cockpit fuel numbers use the real values from the glue. They were not checked visually in the cockpit during flight in this part.
- Balance simulator untouched (Agent 6's task).

## 4. For other agents
- Agent 6: no new saved state in the UI. The unfolded state of the cards is forgotten when the Shipyard closes (on purpose).
- Agent 4: the UI relies on `getUpgradeOffers(shipId)`, `buyUpgrade(shipId, track)`, `getShipStats(shipId)`, `tripFuelCost`, and `ShipCatalogEntry.stats` / `.upgrades`.

## 5. Changes outside src/ui
`tests/ui.test.ts` only.

## 6. Suggestions (not built)
- Show the pay-bonus split (rank / outpost / comfort) on job cards.
- A small upgrade badge on the docked ship (needs src/render).
