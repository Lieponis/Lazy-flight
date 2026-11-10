# src/audio: sound effects and music (Agent 7a)

Everything is made by code with Web Audio. No sound files.

| File | What |
|---|---|
| `cues.ts` | WHEN to play WHICH sound (pure, tested): flight moments, mood, money/fuel changes, funny-line blip |
| `prefs.ts` | mute + two volumes, the volume curve, load/save under its own key `lazy-freight.sound` (pure, tested) |
| `synth.ts` | HOW each sound is made (effects style B, music A "Nebula drift", engine hum) |
| `engine.ts` | the AudioContext: starts on the first tap, pauses when the tab is hidden, sleeps when muted |
| `index.ts` | front door |

Layer rule: imports nothing from render, ui, game, save or universe (tests/audio.test.ts).
Glue: `src/ui/sound.ts` (watches the game and buttons), settings panel in `src/ui/gamemenu.ts`.
Change a sound's loudness: `SOUND_LEVELS` in `cues.ts`. Music chords: `CHORDS` in `synth.ts`.
