/**
 * `resolveTokens(sets, setId, { mode })`: extends, then modes, then aliases;
 * problems are diagnostics, never exceptions.
 */

import { describe, it, expect } from 'test-anywhere';
import { full, resolveText, sample, codes } from './helpers.js';

const dims = (resolved) =>
  Object.fromEntries(
    [...resolved.values()].map((t) => [
      t.path,
      `${t.value.value}${t.value.unit ?? ''}`,
    ])
  );

const SETS = `(base: theme
  (token space.small 4px)
  (token space.medium 8px)
  (token space.large 24px)
  (mode dark (token space.large 32px) (token space.medium 10px)))
(other: theme
  (token space.small 6px)
  (token space.huge 64px))
(child: theme
  (extends base other)
  (token space.medium 16px)
  (mode dark (token space.small 2px)))`;

describe('resolveTokens: extends', () => {
  it('gives the inherited tokens, the set’s own and the later parent winning', () => {
    const resolved = resolveText(SETS, 'child');
    expect(resolved.diagnostics).toEqual([]);
    expect(dims(resolved)).toEqual({
      'space.small': '6px', // other (the later parent) overrides base
      'space.medium': '16px', // the child's own token
      'space.large': '24px',
      'space.huge': '64px',
    });
    expect(resolved.get('space.small').set).toBe('other');
    expect(resolved.get('space.medium').set).toBe('child');
  });

  it('reports an unknown parent and a cycle, and still resolves', () => {
    const resolved = resolveText(
      `(a: theme (extends b missing) (token x 1px))
(b: theme (extends a) (token y 2px))`,
      'a'
    );
    expect(codes(resolved.diagnostics)).toEqual([
      'extends-cycle',
      'unknown-set',
    ]);
    expect(resolved.diagnostics[0].at.cycle).toEqual(['a', 'b', 'a']);
    expect(resolved.diagnostics[1].severity).toBe('warning');
    expect(dims(resolved)).toEqual({ y: '2px', x: '1px' });
  });

  it('reports an unknown set as an error', () => {
    const resolved = resolveText('(a: theme (token x 1px))', 'nope');
    expect(resolved.size).toBe(0);
    expect(resolved.diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['unknown-set', 'error'],
    ]);
  });

  it('warns about the missing base of the issue-1 sample', () => {
    const resolved = sample();
    expect(resolved.size).toBe(5);
    expect(
      resolved.diagnostics.map((d) => [d.code, d.severity, d.message])
    ).toEqual([
      [
        'unknown-set',
        'warning',
        'The token set "material3" extends "base", which does not exist',
      ],
    ]);
  });
});

describe('resolveTokens: modes', () => {
  it('overrides with the mode, but a child’s plain token beats a parent’s mode token', () => {
    const resolved = resolveText(SETS, 'child', { mode: 'dark' });
    expect(resolved.mode).toBe('dark');
    expect(resolved.diagnostics).toEqual([]);
    expect(dims(resolved)).toEqual({
      'space.small': '2px', // the child's dark token
      'space.medium': '16px', // the child's plain token beats base's dark 10px
      'space.large': '32px', // base's dark token
      'space.huge': '64px',
    });
  });

  it('lists what every other mode changes', () => {
    const resolved = resolveText(SETS, 'child');
    expect([...resolved.modes.keys()]).toEqual(['dark']);
    expect(dims(resolved.modes.get('dark'))).toEqual({
      'space.small': '2px',
      'space.large': '32px',
    });
    expect(resolveText(SETS, 'child', { mode: 'dark' }).modes.size).toBe(0);
  });

  it('follows aliases into the mode', () => {
    const light = full();
    const dark = light.modes.get('dark');
    expect(light.get('color.action').value.r).toBe(0x67 / 255);
    expect(dark.get('color.action').value.r).toBe(0xd0 / 255);
    expect(dark.get('color.action').alias).toBe('color.primary');
    expect([...dark.keys()].sort()).toEqual([
      'color.action',
      'color.on-primary',
      'color.primary',
      'color.surface',
    ]);
  });

  it('warns about an unknown mode', () => {
    const resolved = resolveText(SETS, 'child', { mode: 'sepia' });
    expect(codes(resolved.diagnostics)).toEqual(['unknown-mode']);
    expect(dims(resolved)['space.large']).toBe('24px');
  });
});

describe('resolveTokens: aliases', () => {
  it('resolves a chain and keeps the alias and the raw value', () => {
    const resolved = resolveText(
      `(t: theme (token a 4px) (token b (token a)) (token c (token b) (description 'Gap')))`,
      't'
    );
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.get('c')).toEqual({
      path: 'c',
      type: 'dimension',
      value: { type: 'dimension', value: 4, unit: 'px' },
      raw: { type: 'token-ref', path: 'b' },
      alias: 'b',
      description: 'Gap',
      set: 't',
    });
  });

  it('resolves the aliases inside composites and flattens shadow layers', () => {
    const resolved = full();
    expect(resolved.diagnostics).toEqual([]);
    const body = resolved.get('type.body').value.value;
    expect(body.fontFamily).toEqual({
      type: 'fontFamily',
      value: ['Roboto', 'Noto Sans', 'sans-serif'],
    });
    expect(body.fontWeight).toEqual({ type: 'fontWeight', value: 'bold' });
    const low = resolved.get('elevation.low');
    expect(low.value.value.color.a).toBe(0x80 / 255);
    expect(low.raw.value.color).toEqual({
      type: 'token-ref',
      path: 'color.scrim',
    });
    const high = resolved.get('elevation.high').value.value;
    expect(high.length).toBe(2);
    expect(high[0]).toEqual(low.value.value);
    expect(high[1].inset).toBe(true);
  });

  it('reports the cycle a -> b -> a without throwing', () => {
    const resolved = resolveText(
      '(t: theme (token a (token b)) (token b (token a)) (token c 1px))',
      't'
    );
    expect(codes(resolved.diagnostics)).toEqual(['alias-cycle']);
    expect(resolved.diagnostics[0].at.cycle).toEqual(['b', 'a', 'b']);
    expect(resolved.diagnostics[0].at.token).toBe('b');
    expect([...resolved.keys()]).toEqual(['c']);
  });

  it('reports a token that refers to itself', () => {
    const resolved = resolveText('(t: theme (token a (token a)))', 't');
    expect(codes(resolved.diagnostics)).toEqual(['alias-cycle']);
    expect(resolved.diagnostics[0].at.cycle).toEqual(['a', 'a']);
    expect(resolved.size).toBe(0);
  });

  it('reports a cycle through a composite field', () => {
    const resolved = resolveText(
      `(t: theme (token s (shadow (color (token c)) (offset-x 0px) (offset-y 0px) (blur 0px) (spread 0px)))
  (token c (token s) (type color)))`,
      't'
    );
    expect(codes(resolved.diagnostics)).toContain('alias-cycle');
    expect(resolved.size).toBe(0);
  });

  it('reports unknown aliases and type mismatches', () => {
    const resolved = resolveText(
      `(t: theme
  (token gap 8px)
  (token a (token nowhere))
  (token b (token gap) (type color))
  (token t (typography (font-family Roboto) (font-size (token gap)) (font-weight (token gap)) (letter-spacing 0px) (line-height 1.2))))`,
      't'
    );
    expect(
      resolved.diagnostics.map((d) => [d.code, d.at.token, d.at.target])
    ).toEqual([
      ['unknown-alias', 'a', 'nowhere'],
      ['type-mismatch', 'b', 'gap'],
      ['type-mismatch', 't', 'gap'],
    ]);
    expect(resolved.diagnostics[1].message).toBe(
      'The token "b" of the set "t" must be a color but "gap" is a dimension'
    );
    expect([...resolved.keys()]).toEqual(['gap']);
  });
});
