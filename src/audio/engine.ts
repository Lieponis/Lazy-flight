// The sound engine: owns the browser's AudioContext, the music, the engine hum and the two volume buses.
//
// Browser rules it follows:
// - Browsers block sound until the player taps or presses a key. Nothing is created before that, so there are no
//   errors or console warnings; the first tap (any tap) switches sound on.
// - When the tab is hidden, everything pauses (AudioContext suspended). It carries on when the tab comes back.
// - When everything is muted (or both sliders are at zero), the engine also sleeps to save phone battery.
// - Volume changes glide (no clicks).

import { SOUND_LEVELS, type Mood, type SoundEvent } from "./cues";
import { busGains, isSilent, VOLUME_GLIDE_S, type SoundPrefs } from "./prefs";
import { makeNoiseBuffer, makeReverb, Music, playSound, startBed, type Bed, type Kit } from "./synth";

type AudioCtor = typeof AudioContext;

function audioConstructor(): AudioCtor | null {
  const w = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private kit: Kit | null = null;
  private musicBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private music: Music | null = null;
  private bed: Bed | null = null;
  private bedKind: "idle" | "warp" | null = null;
  private mood: Mood = "docked";
  private hidden = false;
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private failed = false;

  constructor(private prefs: SoundPrefs) {}

  /** True once sound is running (after the first tap). */
  get started(): boolean {
    return this.ctx !== null;
  }

  /**
   * Call from inside a tap / click / key handler. The first call creates the sound engine; later calls wake it
   * (iPhones sometimes need a second tap). Never throws: if this browser has no Web Audio, the game is simply silent.
   */
  unlock(): void {
    if (this.failed) return;
    if (!this.ctx) {
      const Ctor = audioConstructor();
      if (!Ctor) {
        this.failed = true;
        return;
      }
      try {
        this.build(new Ctor());
      } catch {
        this.failed = true;
        return;
      }
    }
    this.wake();
  }

  private build(ctx: AudioContext): void {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    const g = busGains(this.prefs);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = g.music;
    this.musicBus.connect(comp);
    this.fxBus = ctx.createGain();
    this.fxBus.gain.value = g.effects;
    this.fxBus.connect(comp);
    // effects style B: a soft top end and a little room
    const fxIn = ctx.createGain();
    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 2600;
    soft.Q.value = 0.3;
    fxIn.connect(soft);
    soft.connect(this.fxBus);
    const reverb = makeReverb(ctx);
    const fxSend = ctx.createGain();
    fxSend.gain.value = 0.25;
    soft.connect(fxSend);
    fxSend.connect(reverb);
    reverb.connect(this.fxBus);
    this.kit = { ctx, noise: makeNoiseBuffer(ctx), out: fxIn, reverb: fxSend };
    // the music has its own room, on the music bus
    const musicReverb = makeReverb(ctx);
    musicReverb.connect(this.musicBus);
    this.music = new Music({ ctx, noise: this.kit.noise, out: this.musicBus, reverb: musicReverb });
    this.music.out.connect(this.musicBus);
    this.music.setMood(this.mood === "warp");
    this.applyBed();
    setInterval(() => this.music?.tick(busGains(this.prefs).music > 0), 250);
    this.music.tick(busGains(this.prefs).music > 0);
  }

  /** The player's settings changed: glide both buses to the new volume. */
  setPrefs(prefs: SoundPrefs): void {
    this.prefs = { ...prefs };
    if (!this.ctx || !this.musicBus || !this.fxBus) return;
    const g = busGains(this.prefs);
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(g.music, t, VOLUME_GLIDE_S / 3);
    this.fxBus.gain.setTargetAtTime(g.effects, t, VOLUME_GLIDE_S / 3);
    this.wake();
  }

  /** docked / flight / warp: the music's mood and the engine hum follow. */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.music?.setMood(mood === "warp");
    this.applyBed();
  }

  private applyBed(): void {
    if (!this.kit) return;
    const want = this.mood === "docked" ? "idle" : this.mood === "warp" ? "warp" : null;
    if (want === this.bedKind) return;
    this.bed?.stop(1.2);
    this.bed = want ? startBed(this.kit, want) : null;
    this.bedKind = want;
  }

  /** Plays one effect (silently ignored before the first tap, while hidden or when effects are off). */
  play(sound: SoundEvent, delay = 0, length?: number): void {
    if (!this.kit || !this.ctx || this.hidden || this.ctx.state !== "running") return;
    if (busGains(this.prefs).effects <= 0) return;
    try {
      playSound(this.kit, sound, SOUND_LEVELS[sound], delay, length);
    } catch {
      // A sound that cannot be made must never stop the game.
    }
  }

  /** The tab was hidden (true) or shown again (false). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) this.sleep(0);
    else this.wake();
  }

  private wake(): void {
    if (!this.ctx) return;
    if (this.sleepTimer !== null) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
    if (this.hidden) return;
    if (isSilent(this.prefs)) {
      this.sleep(400); // let the fade finish, then rest
      return;
    }
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => undefined);
  }

  private sleep(afterMs: number): void {
    if (!this.ctx) return;
    if (this.sleepTimer !== null) clearTimeout(this.sleepTimer);
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = null;
      if (this.ctx && this.ctx.state === "running") this.ctx.suspend().catch(() => undefined);
    }, afterMs);
  }
}
