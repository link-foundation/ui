import { describe, it, expect } from 'test-anywhere';

import { readSchema } from '../src/index.js';
import { codes, fixture } from './helpers.js';

describe('readSchema', () => {
  it('reads the schema of the issue without diagnostics', () => {
    const { schema, diagnostics } = readSchema(fixture('demo.schema.lino'));
    expect(diagnostics).toEqual([]);
    expect(schema.version).toBe(2);
    expect(schema.fields.size).toBe(4);
    expect(schema.sections.length).toBe(1);
    expect(schema.presets.size).toBe(1);
    expect(schema.migrations.length).toBe(1);
  });

  it('reads every part of a field', () => {
    const { schema } = readSchema(fixture('demo.schema.lino'));
    expect(schema.fields.get('liquid.blur')).toEqual({
      key: 'liquid.blur',
      type: 'range',
      default: 18,
      comfort: false,
      apply: [{ cssVar: '--liquid-blur' }],
      props: {},
      min: 0,
      max: 40,
      step: 1,
      unit: 'px',
      section: 'appearance',
      label: 'Blur',
    });
    expect(schema.fields.get('theme.mode').options).toEqual([
      'auto',
      'light',
      'dark',
    ]);
    expect(schema.fields.get('theme.mode').apply).toEqual([
      { dataAttr: 'theme-mode' },
    ]);
    expect(schema.fields.get('motion.reduce').comfort).toBe(true);
    expect(schema.fields.get('accent').default).toBe('#3390EC');
  });

  it('reads sections, presets and migrations', () => {
    const { schema } = readSchema(fixture('demo.schema.lino'));
    expect(schema.sections).toEqual([
      { id: 'appearance', label: 'Appearance' },
    ]);
    expect(schema.presets.get('calm')).toEqual({
      id: 'calm',
      label: 'Calm',
      values: { 'liquid.blur': 24, 'theme.mode': 'dark' },
    });
    expect(schema.migrations).toEqual([
      {
        from: 1,
        to: 2,
        renames: [{ from: 'blur', to: 'liquid.blur' }],
        oldDefaults: [{ key: 'liquid.blur', raw: '12' }],
      },
    ]);
  });

  it('reads the indented form like the parenthesised one', () => {
    const { schema, diagnostics } = readSchema(`(s: schema (version 3))
liquid.blur:
  type range
  default 18
  min 0
  max 40
  apply
    css-var --liquid-blur
preset calm
  set liquid.blur 24`);
    expect(diagnostics).toEqual([]);
    expect(schema.version).toBe(3);
    expect(schema.fields.get('liquid.blur').apply).toEqual([
      { cssVar: '--liquid-blur' },
    ]);
    expect(schema.presets.get('calm').values).toEqual({ 'liquid.blur': 24 });
  });

  it('reports unknown types, bad defaults and duplicate keys', () => {
    const { schema, diagnostics } = readSchema(`(s: schema (version 1))
(a: (type vector9) (default 1))
(b: (type range) (default 99) (min 0) (max 40))
(c: (type choice) (default sepia) (options auto dark))
(d: (type color) (default red))
(e: (type toggle) (default false))
(e: (type toggle) (default true))`);
    expect(codes(diagnostics)).toEqual([
      'unknown-type',
      'bad-default',
      'bad-default',
      'bad-default',
      'duplicate-key',
    ]);
    expect([...schema.fields.keys()]).toEqual(['e']);
    expect(schema.fields.get('e').default).toBe(false);
  });

  it('reports incomplete fields', () => {
    const { diagnostics } = readSchema(`(s: schema (version 1))
(a: (default 1))
(b: (type range) (default 1))
(c: (type choice) (default x))
(d: (type text))
(e: (type range) (default 1) (min 0) (max 9) (step 0))
(f: (type text) (default x) (apply (css-var accent)))
(__proto__: (type text) (default x))`);
    expect(codes(diagnostics)).toEqual([
      'missing-type',
      'missing-range',
      'missing-options',
      'missing-default',
      'bad-number',
      'bad-apply',
      'bad-key',
    ]);
  });

  it('reports bad presets, migrations and references', () => {
    const { schema, diagnostics } = readSchema(`(s: schema (version 2))
(a: (type range) (default 1) (min 0) (max 9) (section nowhere))
(z: (type toggle) (default false) (comfort))
(preset p (set nope 1) (set a x) (set z true))
(preset p (set a 2))
(migration (from 2) (to 1))
(something else)`);
    expect(codes(diagnostics)).toEqual([
      'unknown-link',
      'unknown-key',
      'bad-value',
      'preset-sets-comfort',
      'duplicate-key',
      'bad-migration',
      'unknown-section',
    ]);
    expect(schema.presets.get('p').values).toEqual({ z: true });
  });

  it('warns when there is no schema version', () => {
    const { schema, diagnostics } = readSchema('(a: (type text) (default x))');
    expect(codes(diagnostics)).toEqual(['missing-schema-version']);
    expect(schema.version).toBe(1);
  });

  it('never throws on text that is not a schema', () => {
    expect(readSchema('(a: (type').diagnostics[0].severity).toBe('error');
    expect(codes(readSchema(42).diagnostics)).toEqual(['not-text']);
  });
});
