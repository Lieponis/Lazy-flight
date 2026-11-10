# Report: Agent 7, part 7a (sound effects and music)

**Status:** DONE. Andy checked it on his iPhone Air (Safari) on 2026-11-11: "Fixed. Keep" (all parts kept).
Live: https://lieponis.github.io/Lazy-flight/ (testing aid `?speed=10` for short trips).
Commits on `main`: dcc1b2d, 8f652cb, adbf1e2, 4f691ba. All GitHub Actions runs green. `npm run check`: 457 tests pass.

## 1. What was built
Every sound is **made by code in the browser** (Web Audio). There are no sound files and no licences (see `docs/CREDITS.md`).
The download grows by about 10 kB (gzipped code).

Andy's choices came from a sample page with options A/B/C (published as a private claude.ai artifact) and multiple-choice questions:
- **Music A "Nebula drift"**: slow dreamy synth pads (Cmaj7, Am, Fmaj7, G) with random twinkles, so it never repeats exactly. One track everywhere, in two moods. **Docked:** quieter, clear, with a calm engine idle hum. **Warp:** louder, deeper, lo-fi crunch, tape wobble and hiss, with the warp hum. Mood changes glide over about 2 s.
- **Effects style B "soft and smooth"**:
  - Take-off roar that lasts the launch, then a whoosh.
  - Warp flash: a "vacuum implosion" (an inhale, then a deep thump timed to land on the screen flash).
  - Whoosh out of warp.
  - Approach: the engines wind down, then a whoosh into the station or onto the pad.
- **Buttons:** only a soft keyboard click (click B). **Money:** ka-ching B, when the Delivered card shows and when buying a ship, outpost or upgrade.
- **Extras (Andy's choice D):** rank-up jingle (on the Delivered card), a soft "bonk" when something is blocked (red NOT BOUGHT / NO SWITCH cards, the Jobs menu's red notice, a tap on a greyed-out button), a blip when the cockpit shows a new funny line (every 25 s, at the message page), and a "glug-glug" on refuel and emergency fuel.
- **No squeak in the bay.** Andy asked to remove it.
- **MENU → SETTINGS** (Andy's choice): a SOUND ON/OFF button (red while muted), a MUSIC slider and a SOUND EFFECTS slider, plus BACK. Fits a sideways phone (740×360).

## 2. Browser rules
- **Sound starts on the first user action.** Browsers forbid sound before that. Any press, click, key, touch end or drag end counts (Andy chose this). Nothing is created before it, so there are no console warnings. Andy decided to leave the rest to the title screen: see 7b below.
- **Tab hidden:** the sound engine is paused, and comes back when the tab returns.
- **iPhone / Safari:** after swiping to another app and back, Safari's sound engine stays broken (found by Andy). There, the engine is paused on return and a **new one is built on the first tap** (music restarts with a soft fade-in). The same happens after an iPhone interruption (phone call, Siri) and on `pageshow`. Other browsers resume at once, no tap needed. Fixed and confirmed by Andy on iPhone Air Safari.
- **Muted, or both sliders at 0:** the engine sleeps (saves battery).
- **Volume changes:** they glide over about 0.1 s, so there are no clicks.
- **Settings are saved under their own key**, `lazy-freight.sound`, NOT inside the game save. They are remembered after a reload and survive NEW GAME. The save format and `src/save` are untouched, and old saves load as before. Missing, broken or blocked storage gives the defaults: not muted, music 50 %, effects 70 %.

## 3. Files
| File | What |
|---|---|
| `src/audio/cues.ts` | pure: when each flight sound plays (from the phase lengths), mood, money/fuel → sound, funny-line blip, sound levels |
| `src/audio/prefs.ts` | pure: settings, defaults, volume curve (slider² × max), load/save |
| `src/audio/synth.ts` | how each sound and the music are made |
| `src/audio/engine.ts` | the sound engine (first tap, hidden tab, sleep, iPhone rebuild) |
| `src/audio/index.ts`, `README.md` | front door, short guide |
| `src/ui/sound.ts` (new) | glue: watches game changes, buttons, red cards, the flight clock |
| `src/ui/index.ts` | 4 small additions (start sound, pass settings to MENU, arrival sound, tick) |
| `src/ui/gamemenu.ts` | SETTINGS page (optional 6th argument `SoundSettingsHooks`) |
| `src/ui/theme.css` | settings page styles only |
| `tests/audio.test.ts` | 23 tests: layer rule both ways, settings, volume maths, sound table (no squeak), flight cue order and timing with a 250 ms clock, mid-flight join, stale cues, short trips, blip, money/fuel cases, Safari detection |
| `docs/CREDITS.md` | new |

Not changed: `src/render`, `src/game`, `src/universe`, `src/save`, `src/render/assets`.

## 4. Known issues and what is NOT verified
- **Flight timing is copied, not shared.** `src/ui/sound.ts` works out the flight phases with the same pure functions and settings the flight screen uses (`planFlight`, `phaseDurations`, `FLIGHT_*` from src/render). If Agent 3 changes how `flight.ts` picks the phase lengths (today: a longer approach for stations), the sounds must follow. A comment marks the place.
- **Blip timing:** the blip follows the cockpit message page (15 s status + 10 s message). In Orbit view the funny line changes at a different moment (`FLIGHT_LINE_SECONDS` = 25). The render layer does not tell the UI which view is showing.
- **Bonk detection** watches for red card titles and the Jobs notice (`.ui-panel-title.ui-red`, `.ui-notice`). If Agent 5 renames those classes, the bonk stops (nothing breaks). "REALLY START OVER?" is skipped on purpose.
- **Not verified:** Android phones, Firefox, desktop Safari (Mac). Andy tested iPhone Air Safari and desktop listening. CPU cost on phones was not measured. The music adds about 10 short notes every 7 s, and the engine sleeps when muted.
- **iPhone silent switch:** like most web games, the game respects it. With the switch on, there is no sound.

## 5. For the next agents
- **7b (title screen):** browsers need a tap before any sound. The PLAY / CONTINUE tap on the title screen does this by itself, because any tap unlocks sound. Nothing to wire. *Suggestion:* the title can show while the docked mood music plays.
- **6c (QA):** add to the phone checklist on Android: first tap starts sound, mute is remembered, there is no sound in the background, and sound comes back after an app switch.
- **Changing the sounds:** loudness per sound is `SOUND_LEVELS` in `src/audio/cues.ts`. The chords are `CHORDS` in `src/audio/synth.ts`, and the default volumes are `DEFAULT_PREFS` in `prefs.ts`.

## 6. Suggestions (not built)
- A small speaker button on the top strip, so you can mute during flight (MENU opens only when docked). Needs the Lead's OK, because it touches `statusstrip.ts`.
- A second music track for long play sessions, picked at random.
- Render could expose the view mode (Orbit / Cockpit), so the blip matches the funny line in both views.
