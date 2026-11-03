/**
 * Effects: the registry and the seeded `decipher` port.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import {
  decipher,
  effectNames,
  getEffect,
  loadAnimations,
  registerEffect,
  sample,
  seededRandom,
} from '@link-foundation/ui-animation';

const SOURCE = fileURLToPath(new URL('../src/', import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

/** decipher('Hello, links!', p, 42) at p = 0, 0.1, ..., 1. */
const SEED_42_FRAMES = [
  '_o--_d dQ7fyV',
  'uels0Y TFjsKv',
  'Hjl0B4 XE8cKx',
  'H3lv , -k0L21',
  'HUlNz, W-r s ',
  'H8lZ2, V-Vks!',
  'H-ll-, - hks!',
  'Helly, _31ks!',
  'HellL, l4Eks!',
  'HellC, ljnks!',
  'Hello, links!',
];

describe('decipher', () => {
  const text = 'Hello, links!';
  const frames = Array.from({ length: 11 }, (_, i) =>
    decipher(text, i / 10, 42)
  );

  it('gives a snapshot-stable sequence for seed 42', () => {
    expect(frames).toEqual(SEED_42_FRAMES);
  });

  it('keeps the length and the spaces and ends on the text', () => {
    for (const frame of frames) {
      expect(frame.length).toBe(text.length);
      expect(frame[6]).toBe(' ');
    }
    expect(frames[10]).toBe(text);
  });

  it('reveals more characters as progress grows', () => {
    const revealed = (frame) =>
      [...frame].filter((c, i) => c === text[i]).length;
    const counts = frames.map(revealed);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i] >= counts[i - 1] - 1).toBe(true);
    }
    expect(counts[10]).toBe(text.length);
  });

  it('depends on the seed', () => {
    expect(decipher(text, 0.5, 7) === decipher(text, 0.5, 42)).toBe(false);
    expect(decipher(text, 0.5, 'title')).toBe(decipher(text, 0.5, 'title'));
  });

  it('never uses the platform random generator', () => {
    const offenders = sourceFiles(SOURCE).filter((path) =>
      readFileSync(path, 'utf8').includes('Math.random')
    );
    expect(offenders).toEqual([]);
  });
});

describe('seededRandom', () => {
  it('repeats its sequence for a seed and stays in 0..1', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x >= 0 && x < 1).toBe(true);
    }
  });
});

describe('registerEffect', () => {
  it('lists decipher as a built-in effect', () => {
    expect(effectNames()).toContain('decipher');
    expect(getEffect('decipher').property).toBe('text');
  });

  it('plays a registered effect through sample', () => {
    registerEffect(
      'count-up',
      (input, progress, seed, params) =>
        Math.round(progress * Number(params.to ?? input)),
      { property: 'value' }
    );
    const { animations, diagnostics } = loadAnimations(
      '(c: animation (duration 1000ms) (effect count-up (to 200)))'
    );
    expect(diagnostics).toEqual([]);
    expect(sample(animations.get('c'), 250)).toEqual({ value: 50 });
  });
});
