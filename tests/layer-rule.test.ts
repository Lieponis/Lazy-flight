import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Guards the layer rule from docs/CONVENTIONS.md:
// src/universe is pure logic. It must NEVER import Three.js, rendering, UI,
// game or save code.

function listTsFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...listTsFiles(full));
    } else if (name.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

const FORBIDDEN = [
  /from\s+['"]three(\/[^'"]*)?['"]/,
  /import\s+['"]three(\/[^'"]*)?['"]/,
  /from\s+['"](\.\.?\/)+(render|ui|game|save)(\/[^'"]*)?['"]/,
  /from\s+['"]@\/(render|ui|game|save)(\/[^'"]*)?['"]/,
];

describe('layer rule: src/universe stays pure', () => {
  it('never imports Three.js, render, ui, game or save code', () => {
    const offenders: string[] = [];
    for (const file of listTsFiles('src/universe')) {
      const text = readFileSync(file, 'utf8');
      if (FORBIDDEN.some((pattern) => pattern.test(text))) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
