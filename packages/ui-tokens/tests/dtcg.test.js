/**
 * `toDtcg(resolved, { keepAliases })` and `fromDtcg(json, { id })`: the
 * Design Tokens Format Module 2025.10 and its Color Module, round trip
 * included.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  DTCG_EXTENSION,
  fromDtcg,
  readTokens,
  resolveTokens,
  toDtcg,
} from '@link-foundation/ui-tokens';
import { comparable, full, golden, resolveText, sample } from './helpers.js';

const json = (dtcg) => `${JSON.stringify(dtcg, null, 2)}\n`;

/** Export, import back, read and resolve again. */
function roundTrip(resolved, id, options) {
  const lino = fromDtcg(toDtcg(resolved, options), { id });
  const { sets, diagnostics } = readTokens(lino);
  expect(diagnostics).toEqual([]);
  return { lino, again: resolveTokens(sets, id) };
}

describe('toDtcg', () => {
  it('equals the golden file for the issue-1 sample', () => {
    const text = json(toDtcg(sample()));
    expect(text).toBe(golden('material3.tokens.json', text));
  });

  it('equals the golden file for the full fixture', () => {
    const text = json(toDtcg(full()));
    expect(text).toBe(golden('full/brand.tokens.json', text));
  });

  it('writes colours as Color Module objects with a hex fallback', () => {
    const dtcg = toDtcg(full());
    expect(dtcg.color.primary).toEqual({
      $type: 'color',
      $value: {
        colorSpace: 'srgb',
        components: [0.4039, 0.3137, 0.6431],
        alpha: 1,
        hex: '#6750a4',
      },
      $description: 'Brand colour',
    });
    expect(dtcg.color.scrim.$value.alpha).toBe(0.502);
    expect(dtcg.color.accent.$value).toEqual({
      colorSpace: 'oklch',
      components: [0.7, 0.15, 300],
      alpha: 1,
      hex: dtcg.color.accent.$value.hex,
    });
    expect(dtcg.color.accent.$value.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps aliases as references, or writes their values', () => {
    expect(toDtcg(full()).color.action.$value).toBe('{color.primary}');
    expect(toDtcg(full()).elevation.low.$value.color).toBe('{color.scrim}');
    const resolved = toDtcg(full(), { keepAliases: false });
    expect(resolved.color.action.$value).toEqual(resolved.color.primary.$value);
    expect(resolved.elevation.high.$value.length).toBe(2);
  });

  it('writes $root for a path that is also a group', () => {
    const dtcg = toDtcg(
      resolveText(
        '(t: theme (token a 1px) (token a.b 2px) (token c (token a)))',
        't'
      )
    );
    expect(dtcg.a.$root.$value).toEqual({ value: 1, unit: 'px' });
    expect(dtcg.a.b.$value).toEqual({ value: 2, unit: 'px' });
    expect(dtcg.c.$value).toBe('{a.$root}');
  });

  it('writes the modes into the root $extensions', () => {
    const modes = toDtcg(full()).$extensions[DTCG_EXTENSION].modes;
    expect(Object.keys(modes)).toEqual(['dark']);
    expect(modes.dark.color.surface.$value.hex).toBe('#141218');
    expect(modes.dark.color.action.$value).toBe('{color.primary}');
  });
});

describe('DTCG round trip', () => {
  it('is lossless for the issue-1 sample', () => {
    const { lino, again } = roundTrip(sample(), 'material3');
    expect(comparable(again)).toEqual(comparable(sample()));
    expect(lino).toBe(`material3: theme
  token color.primary '#6750A4'
  token color.on-primary '#FFFFFF'
  token space.medium 16px
  token shape.corner.medium 12px
  token motion.duration.short 150ms
`);
  });

  it('is lossless for aliases, modes, a shadow and a typography', () => {
    const { again } = roundTrip(full(), 'brand');
    expect(comparable(again)).toEqual(comparable(full()));
    expect(comparable(again.modes.get('dark'))).toEqual(
      comparable(full().modes.get('dark'))
    );
    expect(again.get('elevation.high').raw).toEqual(
      full().get('elevation.high').raw
    );
  });

  it('is lossless with the aliases resolved', () => {
    const { again } = roundTrip(full(), 'brand', { keepAliases: false });
    const values = (tokens) =>
      comparable(tokens).map(({ path, type, value }) => ({
        path,
        type,
        value,
      }));
    expect(values(again)).toEqual(values(full()));
  });

  it('keeps __proto__ and constructor names as plain names', () => {
    const resolved = resolveText(
      `(t: theme
  (token __proto__.polluted '#FFFFFF')
  (token constructor.polluted 1px)
  (mode __proto__ (token constructor.polluted 2px)))`,
      't'
    );
    expect(resolved.diagnostics).toEqual([]);
    const dtcg = JSON.parse(JSON.stringify(toDtcg(resolved)));
    expect(Object.keys(dtcg)).toEqual([
      '__proto__',
      'constructor',
      '$extensions',
    ]);
    expect(Object.keys(dtcg.$extensions[DTCG_EXTENSION].modes)).toEqual([
      '__proto__',
    ]);
    expect({}.polluted).toBeUndefined();
    expect(Object.polluted).toBeUndefined();
    const { again } = roundTrip(resolved, 't');
    expect(comparable(again)).toEqual(comparable(resolved));
    expect(
      again.modes.get('__proto__').get('constructor.polluted').value
    ).toEqual({ type: 'dimension', value: 2, unit: 'px' });
  });
});

describe('fromDtcg', () => {
  it('reads group types, references, $ref and other colour spaces', () => {
    const lino = fromDtcg(
      {
        color: {
          $type: 'color',
          base: {
            $value: {
              colorSpace: 'display-p3',
              components: [1, 0, 0],
              hex: '#ff0000',
            },
            $description: "It's red",
          },
          link: { $value: '{color.base}' },
          pointer: { $value: { $ref: '#/color/base/$value' } },
        },
        size: { $type: 'number', root: { $value: 16 } },
      },
      { id: 'imported' }
    );
    expect(lino).toBe(`imported: theme
  token color.base '#FF0000'
    description "It's red"
  token color.link
    token color.base
    type color
  token color.pointer
    token color.base
    type color
  token size.root 16
`);
    const resolved = resolveText(lino, 'imported');
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.get('color.pointer').value.r).toBe(1);
  });

  it('accepts a JSON string and names the set tokens by default', () => {
    expect(
      fromDtcg(
        '{"a": {"$type": "duration", "$value": {"value": 0.2, "unit": "s"}}}'
      )
    ).toBe('tokens: theme\n  token a 0.2s\n');
  });

  it('spells the type out when the value would read as another', () => {
    const lino = fromDtcg({
      w: { $type: 'fontWeight', $value: 400 },
      f: { $type: 'fontFamily', $value: 'Inter' },
      n: { $type: 'number', $value: 1 },
    });
    expect(lino).toContain('\n  token w 400\n    type fontWeight\n');
    expect(lino).toContain('\n  token f Inter\n');
    expect(lino).toContain('\n  token n 1\n');
  });

  it('throws on what it cannot represent', () => {
    expect(() => fromDtcg({ a: { $value: 1 } })).toThrow(/no \$type/);
    expect(() => fromDtcg({ a: { $type: 'gradient', $value: [] } })).toThrow(
      /gradient/
    );
    expect(() => fromDtcg({ g: { $extends: '{x}' } })).toThrow(/\$extends/);
    expect(() =>
      fromDtcg({
        c: {
          $type: 'color',
          $value: { colorSpace: 'lab', components: [1, 2, 3] },
        },
      })
    ).toThrow(/hex fallback/);
    expect(() => fromDtcg('[]')).toThrow(TypeError);
  });
});
