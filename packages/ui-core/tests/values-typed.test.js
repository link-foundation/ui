/**
 * Schema-driven typing of parsed documents: the vocabulary property type
 * decides how each raw value is read (#15).
 */

import { describe, it, expect } from 'test-anywhere';
import { defaultVocabulary, parse, values } from '@link-foundation/ui-core';
import {
  read,
  SAMPLES_DIR,
  samples,
  sortedDiagnostics,
  specFixtures,
} from './helpers.js';

const typedProperties = (root) =>
  root.properties.map((property) => [property.name, property.typed]);

const typeText = (text) => values.typeDocument(parse(text, { checks: false }));

describe('values: typing', () => {
  it('types 16px, 1.5rem, 50%, 150ms and 0.2s by the declared type', () => {
    const cases = [
      ['16px', 'dimension', { type: 'dimension', value: 16, unit: 'px' }],
      ['1.5rem', 'dimension', { type: 'dimension', value: 1.5, unit: 'rem' }],
      ['50%', 'dimension', { type: 'dimension', value: 50, unit: '%' }],
      ['150ms', 'duration', { type: 'duration', value: 150, unit: 'ms' }],
      ['0.2s', 'duration', { type: 'duration', value: 0.2, unit: 's' }],
    ];
    for (const [raw, type, expected] of cases) {
      expect(values.typeValue(raw, { type })).toEqual({
        value: expected,
        diagnostics: [],
      });
    }
  });

  it('types the values of samples/tokens.lino', () => {
    const { roots, diagnostics } = values.typeDocument(
      parse(read(`${SAMPLES_DIR}/tokens.lino`))
    );
    expect(diagnostics).toEqual([]);
    const tokens = new Map(
      roots[0].properties
        .filter((property) => property.name === 'token')
        .map((property) => [property.values[0], property.typed[1]])
    );
    expect(tokens.get('color.primary')).toEqual(values.parseColor('#6750A4'));
    expect(values.toHex(tokens.get('color.primary'))).toBe('#6750A4');
    expect(tokens.get('space.medium')).toEqual({
      type: 'dimension',
      value: 16,
      unit: 'px',
    });
    expect(tokens.get('motion.duration.short')).toEqual({
      type: 'duration',
      value: 150,
      unit: 'ms',
    });
  });

  it('reports gap abc and variant huge as invalid-value without throwing', () => {
    const { roots, diagnostics } = typeText(
      "(box: stack (gap abc))\n(ok: button 'OK' (variant huge))"
    );
    expect(typedProperties(roots[0])).toEqual([['gap', [null]]]);
    expect(typedProperties(roots[1])).toEqual([['variant', [null]]]);
    expect(diagnostics).toEqual([
      {
        code: 'invalid-value',
        severity: 'error',
        message: diagnostics[0].message,
        at: { element: 'box', property: 'gap' },
        expected: 'dimension',
      },
      {
        code: 'invalid-value',
        severity: 'error',
        message: diagnostics[1].message,
        at: { element: 'ok', property: 'variant' },
        expected: '(enum filled tonal outlined text elevated)',
      },
    ]);
    expect(diagnostics[0].message).toContain('gap');
  });

  it('never throws on any raw value or type', () => {
    const raws = ['', 'x', '#', '@', [], [[]], { id: 'a', values: [] }];
    const types = ['any', 'color', 'action', 'nope', ['enum'], ['x', 'y']];
    for (const raw of raws) {
      for (const type of types) {
        const { diagnostics } = values.typeValue(raw, { type });
        expect(Array.isArray(diagnostics)).toBe(true);
      }
    }
  });

  it('types (enum true false mixed) and boolean values', () => {
    const { roots, diagnostics } = typeText(
      "(b: button 'B' (disabled true))\n(c: checkbox 'C' (checked mixed))"
    );
    expect(diagnostics).toEqual([]);
    expect(typedProperties(roots[0])).toEqual([
      ['disabled', [{ type: 'boolean', value: true }]],
    ]);
    expect(typedProperties(roots[1])).toEqual([
      ['checked', [{ type: 'enum', value: 'mixed' }]],
    ]);
    expect(values.typeValue('false', { type: 'boolean' }).value).toEqual({
      type: 'boolean',
      value: false,
    });
    expect(values.typeValue('no', { type: 'boolean' }).value).toBe(null);
  });

  it('types positional values, actions and any properties', () => {
    const { roots, diagnostics } = typeText(
      [
        "(nav: button 'Next' (on press (navigate hello)))",
        "(hero: image 'hero.png')",
        "(logo: image 'logo.svg' (aspect 16 9px))",
      ].join('\n')
    );
    expect(diagnostics).toEqual([]);
    expect(roots[0].typedPositional).toEqual([
      { type: 'string', value: 'Next' },
    ]);
    expect(typedProperties(roots[0])).toEqual([
      [
        'on',
        [
          { type: 'string', value: 'press' },
          {
            type: 'action',
            name: 'navigate',
            args: [{ type: 'element-ref', id: 'hello' }],
          },
        ],
      ],
    ]);
    expect(roots[1].typedPositional).toEqual([
      { type: 'url', value: 'hero.png' },
    ]);
    expect(typedProperties(roots[2])).toEqual([
      [
        'aspect',
        [
          { type: 'number', value: 16 },
          { type: 'dimension', value: 9, unit: 'px' },
        ],
      ],
    ]);
  });
});

describe('values: typing spec fixtures and samples', () => {
  it('types every values/ and references/ fixture as the spec expects', () => {
    const fixtures = specFixtures().filter(
      ({ name }) => name.startsWith('values/') || name.startsWith('references/')
    );
    expect(fixtures.length).toBeGreaterThan(10);
    for (const { name, text, tree } of fixtures) {
      const typed = typeText(text);
      expect([name, sortedDiagnostics(typed.diagnostics)]).toEqual([
        name,
        sortedDiagnostics(tree.diagnostics),
      ]);
      const invalid = typed.diagnostics.filter(
        (d) => d.code === 'invalid-value'
      ).length;
      const nulls = typed.roots
        .flatMap((root) => [
          ...root.typedPositional,
          ...root.properties.flatMap((property) => property.typed),
        ])
        .filter((value) => value === null).length;
      expect([name, nulls]).toEqual([name, invalid]);
    }
  });

  it('types every sample without invalid values', () => {
    const vocabulary = defaultVocabulary();
    for (const { name, text } of samples()) {
      const { diagnostics } = values.typeDocument(parse(text), vocabulary);
      const codes = diagnostics.map((d) => d.code);
      expect([name, codes.includes('invalid-value')]).toEqual([name, false]);
    }
  });

  it('keeps valueMatches consistent with typeValue', () => {
    expect(values.valueMatches('dimension', '16px')).toBe(true);
    expect(values.valueMatches('dimension', 'abc')).toBe(false);
    expect(values.valueMatches(['enum', 'a', 'b'], 'b')).toBe(true);
    expect(values.valueMatches('color', ['oklch', '0.6', '0.2', '300'])).toBe(
      true
    );
  });
});
