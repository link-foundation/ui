import { describe, it, expect } from 'test-anywhere';

import { coerce, randomize } from '../src/index.js';
import { demoSchema, seeded } from './helpers.js';

const schema = demoSchema();

describe('randomize', () => {
  it('gives the same look for the same seed', () => {
    const a = randomize(schema, undefined, { random: seeded(42) });
    const b = randomize(schema, undefined, { random: seeded(42) });
    expect(a).toEqual(b);
  });

  it('gives valid values', () => {
    const random = seeded(7);
    for (let i = 0; i < 100; i++) {
      const out = randomize(schema, undefined, { random });
      for (const field of schema.fields.values()) {
        expect(coerce(field, out[field.key])).toEqual({
          ok: true,
          value: out[field.key],
        });
      }
    }
  });

  it('never changes comfort fields and locked keys', () => {
    const random = seeded(3);
    const viewer = { 'motion.reduce': true, accent: '#123456' };
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const out = randomize(schema, viewer, {
        random,
        locked: new Set(['accent']),
      });
      expect(out['motion.reduce']).toBe(true);
      expect(out.accent).toBe('#123456');
      seen.add(out['liquid.blur']);
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('needs a random function', () => {
    expect(() => randomize(schema, undefined, {})).toThrow();
    expect(() => randomize(schema, undefined)).toThrow();
  });
});
