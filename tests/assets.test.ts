import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { ASSETS } from '../src/render/assets/registry';
import { bayIntrusions, checkEntry, checkModel, countModel, windowBlockers } from '../src/render/assets/checker';
import { ModelKit } from '../src/render/assets/kit';
import { BROKEN_DEMO, SCALE_TEST } from '../src/render/assets/reference';
import { RULES } from '../src/render/assets/style';
import { parseHexColor, safeTint, TINT_EXAMPLES } from '../src/render/assets/palette';

function listTsFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...listTsFiles(full));
    else if (name.endsWith('.ts')) found.push(full);
  }
  return found;
}

function hasProblem(problems: { text: string }[], words: string): boolean {
  return problems.some((p) => p.text.includes(words));
}

describe('asset layer rule', () => {
  it('src/render/assets never imports game, ui or save code', () => {
    const bad = /from\s+['"](\.\.?\/)+(game|ui|save)(\/[^'"]*)?['"]|from\s+['"]@\/(game|ui|save)/;
    const offenders = listTsFiles('src/render/assets').filter((f) => bad.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('registry', () => {
  it('ids are unique and written in lowercase with hyphens', () => {
    const ids = ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('every entry builds every variant with all required anchors, within budget, with no problems', () => {
    for (const entry of ASSETS) {
      const rules = RULES[entry.kind];
      for (let v = 0; v < entry.variants; v++) {
        const model = entry.build({ variant: v });
        for (const name of rules.requiredAnchors) expect(model.anchors[name], `${entry.id} ${name}`).toBeDefined();
        for (const name of entry.anchorNames) expect(model.anchors[name], `${entry.id} ${name}`).toBeDefined();
        const counts = countModel(model);
        expect(counts.triangles, entry.id).toBeLessThanOrEqual(rules.maxTriangles);
        expect(counts.triangles, `${entry.id} declared count`).toBeLessThanOrEqual(entry.triangles);
      }
      expect(checkEntry(entry).flatMap((r) => r.problems.filter((p) => p.level === 'error'))).toEqual([]);
    }
  });
});

describe('station bays', () => {
  const stations = ASSETS.filter((a) => a.kind === 'station');

  it('nothing but the bay floor, walls, ceiling, marks and lights is inside any station bay', () => {
    expect(stations.length).toBeGreaterThan(0);
    for (const entry of stations) expect(bayIntrusions(entry.build()), entry.id).toEqual([]);
  });

  it('the bay test itself catches a face across the bay', () => {
    const m = stations[0]!.build();
    const k = new ModelKit();
    const z = m.anchors.dockEntrance!.pos.z + 6;
    k.box('wall across the bay', 20, 20, 0.2, 'hullMid', { at: [0, 0, z] });
    m.group.add(k.finish().group);
    expect(bayIntrusions(m)).toContain('wall across the bay');
  });
});

describe('cockpit tooling (kept after the C1 reset; no cockpit designs exist)', () => {
  /** A bare test frame, not a design: one window opening in front of the eye and a desk below it. */
  function testCockpit(extra?: (k: ModelKit) => void) {
    const k = new ModelKit();
    k.windowOpening('front glass', [[-1, 0, -2], [1, 0, -2], [1, 1, -2], [-1, 1, -2]]);
    k.box('desk', 2, 0.3, 0.6, 'hullMid', { at: [0, -0.6, -1.5] });
    k.screenAnchor('screenInfo', [-0.5, -0.4, -1.4], [0, 0.5, 1], 0.4, 0.3);
    k.screenAnchor('screenMap', [0, -0.4, -1.4], [0, 0.5, 1], 0.4, 0.3);
    k.screenAnchor('screenFuel', [0.5, -0.4, -1.4], [0, 0.5, 1], 0.4, 0.3);
    k.box('sill light', 2, 0.05, 0.1, 'windowLight', { at: [0, -0.43, -1.75], layer: 'light' });
    k.anchor('windowLight', [0, 0.5, -2], [0, 0, 1]);
    k.anchor('eye', [0, 0, 0], [0, 0, -1]);
    extra?.(k);
    return k.finish();
  }

  it('there are no cockpit designs in the registry', () => {
    expect(ASSETS.filter((a) => a.kind === 'cockpit')).toEqual([]);
  });

  it('the window rule passes a clear window and catches something in front of it', () => {
    expect(windowBlockers(testCockpit())).toEqual([]);
    const blocked = testCockpit((k) => k.box('cup in the way', 0.3, 0.3, 0.3, 'orange', { at: [0.2, 0.3, -1.2] }));
    expect(windowBlockers(blocked)).toContain('cup in the way');
    expect(checkModel(blocked, 'cockpit').some((p) => p.text.includes('block the window'))).toBe(true);
  });

  it('screen anchors keep their size, and the window-light mesh can be tinted', () => {
    const m = testCockpit();
    expect(m.anchors.screenMap!.size).toEqual({ w: 0.4, h: 0.3 });
    expect(m.windowLight).toBeDefined();
    for (const name of RULES.cockpit.requiredAnchors) expect(m.anchors[name], name).toBeDefined();
  });
});

describe('model kit', () => {
  it('the size yard reference model is clean', () => {
    const problems = checkModel(SCALE_TEST.build(), 'reference', SCALE_TEST);
    expect(problems).toEqual([]);
  });

  it('builds the same model twice', () => {
    const a = countModel(SCALE_TEST.build());
    const b = countModel(SCALE_TEST.build());
    expect(a).toEqual(b);
  });

  it('every shape of the kit faces outwards', () => {
    const k = new ModelKit();
    k.box('box', 1, 1, 1, 'hullMid', { at: [0, 0.5, 0] });
    k.cyl('cyl', 0.5, 0.5, 1, 8, 'hullMid', { at: [0.8, 0.5, 0] });
    k.cone('cone', 0.5, 1, 6, 'hullMid', { at: [1.6, 0.5, 0] });
    k.ball('ball', 0.5, 1, 'hullMid', { at: [2.4, 0.5, 0] });
    k.dome('dome', 0.5, 8, 'hullMid', { at: [3.2, 0.0, 0] });
    k.ring('ring', 1, 0.2, 8, 'hullMid', { at: [4.4, 0.2, 0] });
    k.wedge('wedge', 1, 1, 2, 0.5, 1, 'hullMid', { at: [5.8, 0.5, 0], topShiftZ: 0.3 });
    k.anchor('parking', [0, 0, 0]);
    const problems = checkModel(k.finish(), 'reference');
    expect(problems.filter((p) => p.text.includes('inside out'))).toEqual([]);
  });

  it('blinking groups take turns', () => {
    const m = SCALE_TEST.build();
    m.update(0.1);
    const [a, b] = m.animation.blinkers;
    expect(a!.mesh.visible).toBe(true);
    expect(b!.mesh.visible).toBe(false);
    m.update(1.5);
    expect(a!.mesh.visible).toBe(false);
    expect(b!.mesh.visible).toBe(true);
  });
});

describe('problem checker catches a broken model', () => {
  const problems = checkModel(BROKEN_DEMO.build(), 'outpost');

  it('finds the inside-out roof', () => expect(hasProblem(problems, 'inside out')).toBe(true));
  it('finds the floating antenna', () => expect(hasProblem(problems, 'antenna (floating)')).toBe(true));
  it('finds too many triangles', () => expect(hasProblem(problems, 'Too many triangles')).toBe(true));
  it('finds the missing anchors', () => {
    expect(hasProblem(problems, 'Missing anchor "beacon"')).toBe(true);
    expect(hasProblem(problems, 'Missing anchor "entrance"')).toBe(true);
  });
  it('does not blame the good parts', () => {
    expect(hasProblem(problems, 'shed')).toBe(false);
    expect(hasProblem(problems, 'floor')).toBe(false);
  });

  it('finds broken numbers (NaN)', () => {
    const m = SCALE_TEST.build();
    const mesh = m.group.children[0] as THREE.Mesh;
    (mesh.geometry.getAttribute('position').array as Float32Array)[4] = Number.NaN;
    expect(hasProblem(checkModel(m, 'reference'), 'broken (NaN')).toBe(true);
  });

  it('finds a model that is far too big', () => {
    const m = SCALE_TEST.build();
    m.group.scale.setScalar(10);
    expect(hasProblem(checkModel(m, 'reference'), 'Size is off')).toBe(true);
  });

  it('finds a ship with no engine anchors', () => {
    const k = new ModelKit();
    k.box('hull', 1.5, 1, 4, 'hullLight', { at: [0, 0.5, 0] });
    k.anchor('parking', [0, 0, 0]).anchor('eye', [0, 1, -1]).anchor('nose', [0, 0.5, -2]);
    expect(hasProblem(checkModel(k.finish(), 'ship'), 'engine anchors')).toBe(true);
  });
});

describe('palette tint rules', () => {
  it('keeps every tint readable (not too dark, not washed out)', () => {
    for (const hex of [0x000000, 0xffffff, 0x05060d, 0xff0000, ...TINT_EXAMPLES.map((t) => t.hex)]) {
      const t = safeTint(hex);
      const ch = [(t >> 16) & 255, (t >> 8) & 255, t & 255].map((v) => v / 255);
      const l = (Math.max(...ch) + Math.min(...ch)) / 2;
      expect(l).toBeGreaterThanOrEqual(0.39);
      expect(l).toBeLessThanOrEqual(0.66);
    }
  });
  it('reads colour text from the address', () => {
    expect(parseHexColor('ff8844')).toBe(0xff8844);
    expect(parseHexColor('#FF8844')).toBe(0xff8844);
    expect(parseHexColor('nope')).toBeNull();
  });
});

describe('variant pickers', async () => {
  const { pickOutpostVariant, pickStationVariant, OUTPOST_IDS, STATION_IDS } = await import('../src/render/assets/pickers');
  const ids = Array.from({ length: 400 }, (_, i) => `${i % 7}:${-i % 5}:${i % 3}:0/${i % 8}`);

  it('give the same answer for the same dock every time', () => {
    for (const id of ids) {
      expect(pickOutpostVariant(id, 'DESERT')).toBe(pickOutpostVariant(id, 'DESERT'));
      expect(pickStationVariant(id)).toBe(pickStationVariant(id));
    }
  });

  it('only return designs that exist in the registry, and use every one of them', () => {
    for (const [list, pick] of [
      [OUTPOST_IDS, (id: string) => pickOutpostVariant(id, 'ROCKY')],
      [STATION_IDS, (id: string) => pickStationVariant(id)],
    ] as const) {
      const seen = new Set(ids.map(pick));
      if (list.length === 0) {
        expect([...seen]).toEqual([null]);
        continue;
      }
      for (const id of seen) expect(ASSETS.some((a) => a.id === id)).toBe(true);
      expect(seen.size).toBe(list.length);
    }
  });
});
