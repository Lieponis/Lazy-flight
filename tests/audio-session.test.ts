// Agent 7e, bug S1: the game must mix with other apps' audio on iPhone (audio session type "ambient").
import { afterEach, describe, expect, it, vi } from "vitest";
import { SoundEngine, DEFAULT_PREFS, useAmbientAudioSession, type NavigatorLike } from "../src/audio";

describe("useAmbientAudioSession", () => {
  it("sets 'ambient' where the browser supports it (iPhone Safari 16.4+), once", () => {
    const nav: NavigatorLike = { audioSession: { type: "auto" } };
    expect(useAmbientAudioSession(nav)).toBe("set");
    expect(nav.audioSession!.type).toBe("ambient");
    expect(useAmbientAudioSession(nav)).toBe("already"); // a second call changes nothing
  });

  it("does nothing where it is not supported (Android, desktop, old iPhones)", () => {
    expect(useAmbientAudioSession({})).toBe("unsupported");
    expect(useAmbientAudioSession({ audioSession: null })).toBe("unsupported");
    expect(useAmbientAudioSession(undefined)).toBe("unsupported");
    const noType = { audioSession: {} as { type?: string } };
    expect(useAmbientAudioSession(noType)).toBe("unsupported");
    expect(noType.audioSession.type).toBeUndefined();
  });

  it("never throws, even if the browser refuses", () => {
    const refusing = {
      audioSession: {
        get type(): string {
          return "auto";
        },
        set type(_v: string) {
          throw new Error("not allowed");
        },
      },
    };
    expect(() => useAmbientAudioSession(refusing)).not.toThrow();
    expect(useAmbientAudioSession(refusing)).toBe("failed");
    const ignoring = { audioSession: { get type(): string { return "playback"; }, set type(_v: string) { /* ignored */ } } };
    expect(useAmbientAudioSession(ignoring)).toBe("failed");
    const broken = { get audioSession(): never { throw new Error("boom"); } } as unknown as NavigatorLike;
    expect(useAmbientAudioSession(broken)).toBe("failed");
  });
});

describe("the sound engine asks for 'ambient' BEFORE it creates its audio", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("first tap: session set first, then the AudioContext is made", () => {
    const session = { type: "auto" };
    const seen: string[] = [];
    vi.stubGlobal("navigator", { userAgent: "test", maxTouchPoints: 0, audioSession: session });
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          seen.push(session.type);
          throw new Error("no real audio in tests"); // the engine then stays silent, as on a browser without sound
        }
      },
    );
    const engine = new SoundEngine({ ...DEFAULT_PREFS });
    expect(session.type).toBe("auto"); // nothing happens before the first tap
    engine.unlock();
    expect(seen).toEqual(["ambient"]);
    expect(() => engine.unlock()).not.toThrow();
  });
});
