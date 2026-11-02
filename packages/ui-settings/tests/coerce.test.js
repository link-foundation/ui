import { describe, it, expect } from 'test-anywhere';

import {
  coerce,
  defineFieldType,
  fieldType,
  readSchema,
  toLino,
  fromLino,
  randomize,
} from '../src/index.js';
import { demoSchema, seeded } from './helpers.js';

const schema = demoSchema();
const field = (key) => schema.fields.get(key);

describe('coerce', () => {
  it('clamps ranges and rounds them to the step', () => {
    expect(coerce(field('liquid.blur'), 99)).toEqual({ ok: true, value: 40 });
    expect(coerce(field('liquid.blur'), -3)).toEqual({ ok: true, value: 0 });
    expect(coerce(field('liquid.blur'), '24.4')).toEqual({
      ok: true,
      value: 24,
    });
    expect(coerce(field('liquid.blur'), 'abc')).toEqual({ ok: false });
    expect(coerce(field('liquid.blur'), '0x10')).toEqual({ ok: false });
    expect(coerce(field('liquid.blur'), Infinity)).toEqual({ ok: false });
    expect(coerce(field('liquid.blur'), true)).toEqual({ ok: false });
  });

  it('rounds decimal steps without float noise', () => {
    const { schema: s } = readSchema(
      '(x: (type range) (default 0.5) (min 0.1) (max 1) (step 0.1))'
    );
    expect(coerce(s.fields.get('x'), 0.7000001).value).toBe(0.7);
    expect(coerce(s.fields.get('x'), 0.36).value).toBe(0.4);
  });

  it('accepts only the options of a choice', () => {
    expect(coerce(field('theme.mode'), 'dark')).toEqual({
      ok: true,
      value: 'dark',
    });
    expect(coerce(field('theme.mode'), 'sepia')).toEqual({ ok: false });
    expect(coerce(field('theme.mode'), 'toString')).toEqual({ ok: false });
  });

  it('accepts #rrggbb colors only', () => {
    expect(coerce(field('accent'), '#00aaff').ok).toBe(true);
    expect(coerce(field('accent'), 'red')).toEqual({ ok: false });
    expect(coerce(field('accent'), '#0af')).toEqual({ ok: false });
  });

  it('accepts true and false for toggles', () => {
    expect(coerce(field('motion.reduce'), 'true')).toEqual({
      ok: true,
      value: true,
    });
    expect(coerce(field('motion.reduce'), false).value).toBe(false);
    expect(coerce(field('motion.reduce'), 'yes')).toEqual({ ok: false });
  });

  it('reads numbers with optional bounds and text', () => {
    const { schema: s } = readSchema(`(n: (type number) (default 3) (min 1))
(t: (type text) (default 'hello world'))`);
    expect(coerce(s.fields.get('n'), -5).value).toBe(1);
    expect(coerce(s.fields.get('n'), 1e6).value).toBe(1e6);
    expect(s.fields.get('t').default).toBe('hello world');
    expect(coerce(s.fields.get('t'), {}).ok).toBe(false);
  });

  it('rejects missing values', () => {
    expect(coerce(field('accent'), undefined)).toEqual({ ok: false });
    expect(coerce(field('accent'), null)).toEqual({ ok: false });
  });
});

describe('defineFieldType', () => {
  defineFieldType('vector3', {
    coerce(f, raw) {
      const list = Array.isArray(raw) ? raw.map(Number) : [];
      return list.length === 3 && list.every(Number.isFinite)
        ? { ok: true, value: list }
        : { ok: false };
    },
    random: (f, random) =>
      [random(), random(), random()].map((n) => n.toFixed(2)),
  });
  const { schema: s, diagnostics } = readSchema(`(s: schema (version 1))
(light.direction: (type vector3) (default 0 0 1) (apply (css-var --light)))`);

  it('adds a type that schemas can use', () => {
    expect(diagnostics).toEqual([]);
    expect(s.fields.get('light.direction').default).toEqual([0, 0, 1]);
    expect(fieldType('vector3')).toBeTruthy();
  });

  it('writes and reads values of the type', () => {
    const values = { 'light.direction': [1, 0.5, 0] };
    const text = toLino(s, values);
    expect(text).toBe('(settings (version 1) (light.direction 1 0.5 0))');
    expect(fromLino(s, text).values).toEqual(values);
  });

  it('randomises with the type random', () => {
    const out = randomize(s, undefined, { random: seeded(1) });
    expect(out['light.direction'].length).toBe(3);
  });

  it('cannot replace built-in types and needs coerce', () => {
    expect(() => defineFieldType('range', { coerce: () => ({}) })).toThrow();
    expect(() => defineFieldType('broken', {})).toThrow();
    expect(() => defineFieldType('', { coerce: () => ({}) })).toThrow();
  });

  it('rejects a value when a custom coerce throws', () => {
    defineFieldType('fragile', {
      coerce() {
        throw new Error('boom');
      },
    });
    expect(coerce({ key: 'x', type: 'fragile' }, 'a')).toEqual({ ok: false });
  });
});
