// HOW each sound is made: every sound is built from code with Web Audio (oscillators, filtered noise). No sound files,
// no licences, nothing downloaded. Andy chose (2026-11-11) from the sample page: music A "Nebula drift",
// effects B "soft and smooth", click B, ka-ching B. Extra sounds (his choice D): rank-up jingle, bonk, blip, refuel glug.
// The squeak in the bay was removed at Andy's request.

import type { SoundEvent } from "./cues";

/** What every recipe needs: the context, a shared noise buffer, where to plug in (effects bus) and the reverb send. */
export interface Kit {
  ctx: AudioContext;
  noise: AudioBuffer;
  out: AudioNode;
  reverb: AudioNode;
}

// ------------------------------------------------------------------ small helpers

export function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** A soft room echo made from decaying noise (no file). */
export function makeReverb(ctx: AudioContext, seconds = 2.8): ConvolverNode {
  const verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  verb.buffer = ir;
  return verb;
}

/** A staircase curve: the "lo-fi crunch" used on the music in warp. */
export function crushCurve(steps: number): Float32Array {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.round(x * steps) / steps;
  }
  return c;
}

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

function noiseSrc(k: Kit, t: number, dur: number): AudioBufferSourceNode {
  const s = k.ctx.createBufferSource();
  s.buffer = k.noise;
  s.loop = true;
  s.start(t, Math.random() * Math.max(0, k.noise.duration - 0.5));
  s.stop(t + dur + 0.05);
  return s;
}
function osc(k: Kit, type: OscillatorType, f: number, t: number, dur: number): OscillatorNode {
  const o = k.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}
function gain(k: Kit, v: number): GainNode {
  const g = k.ctx.createGain();
  g.gain.value = v;
  return g;
}
function filt(k: Kit, type: BiquadFilterType, f: number, q?: number): BiquadFilterNode {
  const b = k.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  if (q !== undefined) b.Q.value = q;
  return b;
}
function panner(k: Kit): StereoPannerNode | GainNode {
  return typeof k.ctx.createStereoPanner === "function" ? k.ctx.createStereoPanner() : gain(k, 1);
}
/** Connects a -> b -> c ... The last one may be a dial (AudioParam), e.g. a filter's frequency. */
function chain(...nodes: [AudioNode, ...(AudioNode | AudioParam)[]]): void {
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i] as AudioNode;
    const to = nodes[i + 1]!;
    if (to instanceof AudioNode) from.connect(to);
    else from.connect(to);
  }
}
/** 0 -> peak in `a` seconds, then a smooth fade over about `d` seconds. */
function env(g: GainNode, t: number, a: number, peak: number, d: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(0.0001, t + a, d / 4);
}

// ------------------------------------------------------------------ effects (style B: soft and smooth)

const SUB = 0.9;

function roar(k: Kit, t: number, level: number, length: number): void {
  const L = Math.max(1.5, length);
  const g = gain(k, 0);
  const lp = filt(k, "lowpass", 150, 1.2);
  const o1 = osc(k, "sawtooth", 48, t, L);
  const o2 = osc(k, "sawtooth", 48.6, t, L);
  const sub = osc(k, "sine", 36, t, L);
  o1.frequency.linearRampToValueAtTime(64, t + 1.6);
  o2.frequency.linearRampToValueAtTime(65, t + 1.6);
  o1.frequency.linearRampToValueAtTime(80, t + L);
  o2.frequency.linearRampToValueAtTime(81.2, t + L);
  const n = noiseSrc(k, t, L);
  const nlp = filt(k, "lowpass", 300, 0.7);
  nlp.frequency.linearRampToValueAtTime(1400, t + 1.6);
  nlp.frequency.linearRampToValueAtTime(900, t + L * 0.6);
  nlp.frequency.linearRampToValueAtTime(1800, t + L);
  lp.frequency.linearRampToValueAtTime(900, t + 1.6);
  lp.frequency.linearRampToValueAtTime(600, t + L * 0.6);
  lp.frequency.linearRampToValueAtTime(1100, t + L);
  o1.connect(lp);
  o2.connect(lp);
  lp.connect(g);
  chain(n, nlp, gain(k, 0.7), g);
  chain(sub, gain(k, 0.35 * SUB), g);
  g.connect(k.out);
  // Roar up, settle while the ship curves round the planet, swell again as it speeds away, then hand over to the warp flash.
  const peak = 0.42 * level;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.9);
  g.gain.linearRampToValueAtTime(peak * 0.55, t + Math.min(L * 0.5, 3));
  g.gain.linearRampToValueAtTime(peak * 0.8, t + L - 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + L);
}

function whoosh(k: Kit, t: number, level: number, dir: "out" | "in" | "down", dur = 1.5): void {
  const n = noiseSrc(k, t, dur);
  const bp = filt(k, "bandpass", 400, 1.4);
  const g = gain(k, 0);
  const pn = panner(k);
  const f = dir === "in" ? [2800, 900, 260] : dir === "down" ? [3600, 1200, 300] : [350, 2800, 700];
  bp.frequency.setValueAtTime(f[0]!, t);
  bp.frequency.exponentialRampToValueAtTime(f[1]!, t + dur * 0.55);
  bp.frequency.exponentialRampToValueAtTime(f[2]!, t + dur);
  if ("pan" in pn) {
    pn.pan.setValueAtTime(dir === "in" ? 0.7 : -0.7, t);
    pn.pan.linearRampToValueAtTime(dir === "in" ? -0.5 : 0.7, t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.75 * level, t + dur * 0.5);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  chain(n, bp, g, pn, k.out);
}

function vacuum(k: Kit, t: number, level: number): void {
  // the inhale: air rushing in, rising, then a hard stop
  const n = noiseSrc(k, t, 0.75);
  const bp = filt(k, "bandpass", 250, 2);
  const g = gain(k, 0);
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.exponentialRampToValueAtTime(3000, t + 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6 * level, t + 0.68);
  g.gain.setValueAtTime(0.0001, t + 0.72);
  chain(n, bp, g, k.out);
  // the implosion: a deep drop and a muffled burst, with echo
  const b = t + 0.72;
  const s = osc(k, "sine", 150, b, 2);
  const sg = gain(k, 0);
  s.frequency.exponentialRampToValueAtTime(28, b + 0.9);
  env(sg, b, 0.01, 0.95 * SUB * level, 1.6);
  chain(s, sg, k.out);
  const n2 = noiseSrc(k, b, 1.6);
  const lp = filt(k, "lowpass", 900, 0.5);
  const g2 = gain(k, 0);
  lp.frequency.exponentialRampToValueAtTime(70, b + 1.2);
  env(g2, b, 0.005, 0.7 * level, 1.3);
  chain(n2, lp, g2, k.out);
  const v = gain(k, 0);
  env(v, b, 0.01, 0.5 * level, 2.2);
  chain(n2, v, k.reverb);
}

function exitWarp(k: Kit, t: number, level: number): void {
  whoosh(k, t, level, "down", 1.3);
  const s = osc(k, "sine", 95, t + 0.9, 0.8);
  const g = gain(k, 0);
  s.frequency.exponentialRampToValueAtTime(45, t + 1.6);
  env(g, t + 0.9, 0.01, 0.5 * SUB * level, 0.6);
  chain(s, g, k.out);
}

function windDown(k: Kit, t: number, level: number, length: number): void {
  const L = Math.max(1.5, length);
  const g = gain(k, 0);
  const lp = filt(k, "lowpass", 900, 1);
  const o1 = osc(k, "sawtooth", 72, t, L);
  const o2 = osc(k, "sawtooth", 72.8, t, L);
  o1.frequency.exponentialRampToValueAtTime(34, t + L * 0.95);
  o2.frequency.exponentialRampToValueAtTime(34.5, t + L * 0.95);
  lp.frequency.exponentialRampToValueAtTime(140, t + L * 0.95);
  o1.connect(lp);
  o2.connect(lp);
  chain(lp, g, k.out);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.38 * level, t + 0.6);
  g.gain.linearRampToValueAtTime(0.0001, t + L);
}

function click(k: Kit, t: number, level: number): void {
  // a keyboard key: a tiny tick plus a little "thock" (sample B)
  const n = noiseSrc(k, t, 0.04);
  const f = filt(k, "highpass", 1600, 0.7);
  const g = gain(k, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.35 * level * 2, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
  chain(n, f, g, k.out);
  const s = osc(k, "sine", 190, t, 0.06);
  const sg = gain(k, 0);
  s.frequency.exponentialRampToValueAtTime(80, t + 0.04);
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.linearRampToValueAtTime(0.3 * level * 2, t + 0.003);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  chain(s, sg, k.out);
}

function kaching(k: Kit, t: number, level: number): void {
  // "ka": two little mechanical ticks, then "ching": a soft bell (sample B)
  for (const dt of [0, 0.06]) {
    const n = noiseSrc(k, t + dt, 0.03);
    const bp = filt(k, "bandpass", 2600, 3);
    const g = gain(k, 0);
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.linearRampToValueAtTime(0.5 * level, t + dt + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.03);
    chain(n, bp, g, k.out);
  }
  const b = t + 0.13;
  [1568, 2349].forEach((f, i) => {
    const at = b + i * 0.05;
    const o = osc(k, "sine", f, at, 1.3);
    const g = gain(k, 0);
    env(g, at, 0.004, 0.22 * level, 0.7);
    chain(o, g, k.out);
    const o2 = osc(k, "sine", f * 2.76, at, 0.5);
    const g2 = gain(k, 0);
    env(g2, at, 0.002, 0.06 * level, 0.25);
    chain(o2, g2, k.out);
  });
}

function rankup(k: Kit, t: number, level: number): void {
  // a short happy rising jingle in the music's key, with a little sparkle on top
  const notes = [72, 76, 79, 84];
  notes.forEach((m, i) => {
    const at = t + i * 0.11;
    const o = osc(k, "triangle", mtof(m), at, i === notes.length - 1 ? 1.2 : 0.3);
    const g = gain(k, 0);
    env(g, at, 0.01, 0.22 * level, i === notes.length - 1 ? 1.1 : 0.25);
    chain(o, g, k.out);
    const send = gain(k, 0);
    env(send, at, 0.01, 0.12 * level, 0.6);
    chain(o, send, k.reverb);
  });
  const top = t + notes.length * 0.11;
  const s = osc(k, "sine", mtof(91), top, 1);
  const sg = gain(k, 0);
  env(sg, top, 0.005, 0.07 * level, 0.8);
  chain(s, sg, k.out);
}

function bonk(k: Kit, t: number, level: number): void {
  // a soft, slightly silly "bonk": a round low knock that drops in pitch
  const o = osc(k, "triangle", 260, t, 0.35);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.18);
  const g = gain(k, 0);
  env(g, t, 0.004, 0.45 * level, 0.25);
  chain(o, filt(k, "lowpass", 900, 0.7), g, k.out);
  const s = osc(k, "sine", 90, t, 0.3);
  const sg = gain(k, 0);
  env(sg, t, 0.004, 0.3 * level, 0.2);
  chain(s, sg, k.out);
}

function blip(k: Kit, t: number, level: number): void {
  // the ship computer clears its throat: two quick friendly beeps
  [
    [988, 0],
    [1319, 0.09],
  ].forEach(([f, dt]) => {
    const at = t + dt!;
    const o = osc(k, "sine", f!, at, 0.12);
    const g = gain(k, 0);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.18 * level, at + 0.005);
    g.gain.setValueAtTime(0.18 * level, at + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, at + 0.08);
    chain(o, g, k.out);
  });
}

function glug(k: Kit, t: number, level: number): void {
  // glug-glug: a few bubbles (quick rising tones in a low filter), then a little "full" tick
  const times = [0, 0.16, 0.29, 0.47, 0.58];
  times.forEach((dt, i) => {
    const at = t + dt + Math.random() * 0.03;
    const base = 160 + Math.random() * 60 + i * 12;
    const o = osc(k, "sine", base, at, 0.14);
    o.frequency.exponentialRampToValueAtTime(base * 2.3, at + 0.1);
    const g = gain(k, 0);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.4 * level, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    chain(o, filt(k, "lowpass", 1200, 1), g, k.out);
  });
  click(k, t + 0.8, level * 0.6);
}

/** Plays one sound `delay` seconds from now. `length` stretches the two engine sounds to fit their phase. */
export function playSound(k: Kit, sound: SoundEvent, level: number, delay = 0, length = 3): void {
  const t = k.ctx.currentTime + Math.max(0, delay) + 0.01;
  switch (sound) {
    case "click":
      return click(k, t, level);
    case "kaching":
      return kaching(k, t, level);
    case "rankup":
      return rankup(k, t, level);
    case "bonk":
      return bonk(k, t, level);
    case "blip":
      return blip(k, t, level);
    case "refuel":
      return glug(k, t, level);
    case "takeoff":
      return roar(k, t, level, length);
    case "whooshOut":
      return whoosh(k, t, level, "out", 1.6);
    case "warpIn":
      return vacuum(k, t, level);
    case "warpOut":
      return exitWarp(k, t, level);
    case "approach":
      return windDown(k, t, level, length);
    case "whooshIn":
      return whoosh(k, t, level, "in", 1.6);
  }
}

// ------------------------------------------------------------------ engine bed (continuous hum)

export interface Bed {
  stop(fadeSeconds: number): void;
}

/** docked: a calm idle engine hum. warp: the deep warp hum. Both very quiet. */
export function startBed(k: Kit, kind: "idle" | "warp"): Bed {
  const ctx = k.ctx;
  const t = ctx.currentTime;
  const warp = kind === "warp";
  const g = gain(k, 0);
  const lp = filt(k, "lowpass", warp ? 230 : 140, warp ? 2 : 0.7);
  const nodes: OscillatorNode[] = [];
  const freqs = warp ? [41.2, 41.75] : [55, 55.4];
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = warp ? "sawtooth" : "sine";
    o.frequency.value = f;
    o.connect(lp);
    nodes.push(o);
  }
  if (warp) {
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 82.4;
    chain(sub, gain(k, 0.3 * SUB), lp);
    nodes.push(sub);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    chain(lfo, gain(k, 70), lp.frequency);
    nodes.push(lfo);
  }
  chain(lp, g, k.out);
  nodes.forEach((o) => o.start(t));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.setTargetAtTime(warp ? 0.2 : 0.09, t + 0.1, 0.8);
  return {
    stop(fade: number) {
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, Math.max(0.05, fade / 4));
      nodes.forEach((o) => o.stop(now + fade + 0.5));
    },
  };
}

// ------------------------------------------------------------------ music A "Nebula drift"

export const MUSIC_CHORD_SECONDS = 7;
const BEAT = MUSIC_CHORD_SECONDS / 8;
/** Cmaj7, Am, Fmaj7, G: slow and warm. Twinkles from a C major pentatonic. */
const CHORDS = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [41, 52, 57, 60],
  [43, 50, 55, 59],
];
const TWINKLES = [72, 74, 76, 79, 81, 84, 86, 88];
const TWINKLE_CHANCE = 0.45;

/** The music bus: pads -> mood filter -> (clean + lo-fi crunch) -> out, with an echo and the room reverb. */
export class Music {
  readonly out: GainNode;
  private input: GainNode;
  private lp: BiquadFilterNode;
  private dry: GainNode;
  private wet: GainNode;
  private moodGain: GainNode;
  private wobble: ConstantSourceNode | null = null;
  private wobbleDepth: GainNode;
  private hiss: GainNode;
  private nextChord = 0;
  private chordIndex = 0;

  constructor(private k: Kit) {
    const ctx = k.ctx;
    this.input = gain(k, 1);
    this.lp = filt(k, "lowpass", 2400, 0.4);
    this.dry = gain(k, 1);
    this.wet = gain(k, 0);
    this.moodGain = gain(k, 0.3);
    this.out = gain(k, 1);
    const shaper = ctx.createWaveShaper();
    shaper.curve = crushCurve(10);
    chain(this.input, this.lp);
    this.lp.connect(this.dry);
    chain(this.lp, shaper, this.wet);
    this.dry.connect(this.moodGain);
    this.wet.connect(this.moodGain);
    this.moodGain.connect(this.out);
    // a soft echo on the beat
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = BEAT * 0.75;
    const fb = gain(k, 0.38);
    const dl = filt(k, "lowpass", 1800);
    chain(this.moodGain, delay, dl, fb, delay);
    dl.connect(this.out);
    chain(this.moodGain, gain(k, 0.6), k.reverb);
    // gentle tape wobble shared by every note (deeper in warp)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    this.wobbleDepth = gain(k, 3);
    if (typeof ctx.createConstantSource === "function") {
      this.wobble = ctx.createConstantSource();
      this.wobble.offset.value = 0;
      chain(lfo, this.wobbleDepth, this.wobble.offset);
      this.wobble.start();
    }
    lfo.start();
    // tape hiss, only heard in warp
    const hs = ctx.createBufferSource();
    hs.buffer = k.noise;
    hs.loop = true;
    this.hiss = gain(k, 0);
    chain(hs, filt(k, "highpass", 4000), this.hiss, this.moodGain);
    hs.start();
    this.nextChord = ctx.currentTime + 0.2;
  }

  /** docked/flight: lower and clear. warp: louder, deeper, a bit lo-fi and wobbly. Changes glide (no clicks). */
  setMood(warp: boolean): void {
    const t = this.k.ctx.currentTime;
    const tc = 0.8;
    this.moodGain.gain.setTargetAtTime(warp ? 0.55 : 0.3, t, tc);
    this.lp.frequency.setTargetAtTime(warp ? 650 : 2400, t, tc);
    this.dry.gain.setTargetAtTime(warp ? 0.55 : 1, t, tc);
    this.wet.gain.setTargetAtTime(warp ? 0.35 : 0, t, tc);
    this.wobbleDepth.gain.setTargetAtTime(warp ? 16 : 3, t, tc);
    this.hiss.gain.setTargetAtTime(warp ? 0.012 : 0, t, tc);
  }

  /** Call a few times a second. Schedules the next chords a little ahead. `audible` false = keep time but play nothing. */
  tick(audible: boolean): void {
    const now = this.k.ctx.currentTime;
    if (this.nextChord < now) this.nextChord = now + 0.1; // came back from a pause: carry on from now, no burst of notes
    while (this.nextChord < now + 1.5) {
      if (audible) this.chord(this.nextChord);
      this.chordIndex++;
      this.nextChord += MUSIC_CHORD_SECONDS;
    }
  }

  private chord(t: number): void {
    const ch = CHORDS[this.chordIndex % CHORDS.length]!;
    for (const n of ch) this.pad(n, t, MUSIC_CHORD_SECONDS, "sawtooth", 0.06, 2.2, 3);
    this.pad(ch[0]! - 12, t, MUSIC_CHORD_SECONDS, "sine", 0.12, 1.5, 2);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < TWINKLE_CHANCE) {
        const m = TWINKLES[Math.floor(Math.random() * TWINKLES.length)]!;
        this.twinkle(m, t + i * BEAT + (Math.random() < 0.3 ? BEAT / 2 : 0));
      }
    }
  }

  private pad(midi: number, t: number, dur: number, type: OscillatorType, level: number, attack: number, release: number): void {
    const k = this.k;
    const g = gain(k, 0);
    const lp = filt(k, "lowpass", 1500, 0.5);
    for (const det of [-7, 7]) {
      const o = osc(k, type, mtof(midi), t, dur + release);
      o.detune.value = det;
      this.wobbleOn(o);
      o.connect(lp);
    }
    chain(lp, g, this.input);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + release);
  }

  /** Connects the shared wobble to a note, and lets go of it when the note ends (no build-up over a long session). */
  private wobbleOn(o: OscillatorNode): void {
    const w = this.wobble;
    if (!w) return;
    w.connect(o.detune);
    o.onended = () => {
      try {
        w.disconnect(o.detune);
      } catch {
        // already gone
      }
    };
  }

  private twinkle(midi: number, t: number): void {
    const k = this.k;
    const o = osc(k, "triangle", mtof(midi), t, 2.5);
    this.wobbleOn(o);
    const g = gain(k, 0);
    env(g, t, 0.01, 0.05, 2.2);
    chain(o, g, this.input);
  }
}
