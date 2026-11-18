# src/save

Saving and loading player progress in the browser (localStorage). For Agent 6.

Only player progress is saved here. The universe itself is never stored; it is always recomputed from the seed.

## Universe 3 (stage G4)

`migrateSave` moves every save made before universe 3 (or holding an old-shape id, or from another seed) to the start dock of the shared world:
credits, fuel, ships, upgrades, paint, ranks and completed counts are kept; the job and free trip are cancelled (fuel back), outposts are refunded
(`outpostPrices`, else an estimate), explored, discoveries and delivered lists are cleared, `universeVersion` is stamped, and a "universe rebuilt"
message is returned once. The same rule applies to imported save files (`transfer.ts`). `SAVE_VERSION` stays 1.
