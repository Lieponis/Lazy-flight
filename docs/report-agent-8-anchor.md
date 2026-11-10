# Report: Agent 8, small task: screenRightWing anchor (2026-11-10)

## 1. What was built

The base cockpit (`src/render/assets/cockpitBase.ts`) now has a `screenRightWing` anchor on the right wing screen.

| Field | Value (cockpit frame: eye at the origin, crates) |
|---|---|
| `pos` (screen middle) | (1.58, -0.61, -0.67) |
| `dir` (into the cabin) | (-0.59, 0, 0.81) |
| `size` | 0.33 x 0.23 |

- **Mirror of the fuel screen:** it is the exact mirror of `screenFuel` (-0.38, -0.61, -0.67; dir (0.59, 0, 0.81))
  across the cockpit's middle line, which is x = 0.6 from the eye.
- **Built from the screen itself:** like the other screen anchors, it is computed from the screen's own corners, not
  copied from the fuel screen.
- **Nothing else changed:** the model, the triangle count and every decided item are untouched. Deferred items
  (dog, lamp, window light, per-ship cockpits) were not built.

Files changed:

| File | Change |
|---|---|
| `src/render/assets/cockpitBase.ts` | The anchor. |
| `tests/assets.test.ts` | New test: the anchor exists, mirrors `screenFuel` (position, direction, size) and faces into the cabin. |
| `docs/ASSET-CATALOG.md` | Line about the new anchor. |
| `docs/INTEGRATION-cockpit.md` | Anchor table. |
| `docs/report-agent-8-anchor.md` | This report. |

## 2. How to check

- **Tests:** `npm run check` passes (377 tests), and the Actions run is green.
- **Viewer:** `/models.html?asset=cockpit-base&show=anchors`. The `screenRightWing` marker sits on the right wing
  screen, mirroring `screenFuel` on the left wing.
- **Live:** https://lieponis.github.io/Lazy-flight/models.html
- **Andy's check:** he looked in the viewer (anchors on) and replied "good" on 2026-11-10.

## 3. For the Lead: the follow-up for Agent 3 (one small change, not done by Agent 8)

In `src/render/cockpitscreens.ts`:

1. **Use the new anchor:** in `makeFace`, use `model.anchors[name]` for every screen, including `"screenRightWing"`:
   ```ts
   const a = model.anchors[name];
   ```
2. **Remove the workaround:** delete `mirroredFuelAnchor()` and `COCKPIT_CENTRE_X`. Also delete the tests that use
   them, if any.
3. **Check:**
   - the right wing picture appears in the same place as before, because the positions are identical;
   - `npm run check` passes;
   - Cockpit view looks unchanged.

## 4. Known issues / not verified

- **Viewer only:** checked in the viewer and with tests, not in the game. The game still uses Agent 3's mirrored copy
  until the follow-up above is done.
