# Agent 7 brief, fix S1: the game must not stop the player's other media

You are Agent 7 (Polish / sound). Work on the CURRENT `main` (never an old zip). Read first: docs/WHERE-TO-LOOK.md, docs/status.md, docs/report-agent-7a.md (the sound engine), src/audio/engine.ts, docs/report-agent-7d if it exists (another Agent 7 chat may be working on the icon/release page at the same time: you only touch src/audio and its tests). One step at a time with Andy (Step N of M / DO (max 3 actions) / LOOK FOR / REPLY WITH). Explain technical words in one sentence. Report: docs/report-agent-7e.md. Combat never; no new features.

## Bug (Andy, 2026-11-12)
When Andy plays music or video in another app (YouTube, Spotify) on his iPhone and then opens the game, the other media stops. It must NOT stop it.

## Likely cause and fix
On iPhone, a web page that starts sound normally takes over the phone's audio ("audio session" category playback/auto), which pauses other apps. Safari 16.4+ offers `navigator.audioSession.type`; setting it to `"ambient"` before the AudioContext starts makes the game MIX with other audio and follow the silent switch. Also check: the context must not be created or resumed earlier than necessary (the game should not touch audio until the first user tap, as now), and no `<audio>`/`<video>` element or media session (`navigator.mediaSession`) is used that could claim playback.

## Do
1. Set `navigator.audioSession.type = "ambient"` (feature-detect; ignore silently where unsupported: Android/desktop) as early as possible but not before the first user action, and again whenever the AudioContext is (re)created or resumed after the tab returns. Wrap in try/catch.
2. Make sure the game does not claim a media session or lock-screen controls.
3. Think about what happens next: with mixing, the game's music will play ON TOP of Spotify/YouTube. Propose to the Lead (do not build without approval): e.g. a SETTINGS choice "Music: on / off" already exists via the mute and sliders; maybe default the music slider low or off when it detects other audio is playing (not detectable reliably); at least say what Andy will hear and what the options are.
4. Also confirm the silent switch / ringer behaviour: with `ambient`, the iPhone's silent switch mutes the game. Tell Andy plainly.
5. Tests: a pure test that the helper sets the type once, only when supported, never throws; the existing audio tests stay as they are (one audio test already fails on main for another reason: if you can find and fix its cause in src/audio, do it and say so; do not weaken it). `npm run check` green; Actions green.
6. If `ambient` does not stop the interruption on Andy's iPhone, report exactly what he observed (which app, which iOS version, installed app or Safari tab) and give the Lead the alternatives (for example starting audio only when music is actually wanted, or `"transient"`), with their trade-offs. Do not guess more than once without Andy testing.

## Allowed / not allowed
Allowed: src/audio, audio tests, the smallest glue in src/ui/sound.ts if the call must happen there (say exactly what), docs. Not allowed: gameplay, render, save, universe, new sounds, new features.

## Andy checks (iPhone, both Safari tab and the installed app)
1. Start Spotify or a YouTube video, switch to the game, tap PLAY: does the other media keep playing? Do you hear both?
2. Also: start the game first, then start Spotify: does the game keep running quietly?
3. Flip the silent switch: tell the Lead what you hear.
