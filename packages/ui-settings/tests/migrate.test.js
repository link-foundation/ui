import { describe, it, expect } from 'test-anywhere';

import { defaults, migrate } from '../src/index.js';
import { codes, demoSchema, immortalitySchema } from './helpers.js';

const schema = demoSchema();

describe('migrate', () => {
  it('drops a v1 value equal to the old default', () => {
    const out = migrate(schema, { version: 1, values: { blur: 12 } });
    expect(out.values['liquid.blur']).toBe(18);
    expect(out.version).toBe(2);
    expect(out.diagnostics).toEqual([]);
  });

  it('renames a v1 value that was changed', () => {
    const out = migrate(schema, { version: 1, values: { blur: 30 } });
    expect(out.values).toEqual({ ...defaults(schema), 'liquid.blur': 30 });
  });

  it('reads current values as they are', () => {
    const out = migrate(schema, { values: { 'liquid.blur': 12 } });
    expect(out.values['liquid.blur']).toBe(12);
  });

  it('keeps a shared look of an old version as it was shared', () => {
    const imm = immortalitySchema();
    const out = migrate(
      imm,
      { version: 1, values: { cornerSize: 20 } },
      { look: true }
    );
    expect(out.values.palette).toBe('mission');
    expect(out.values.glow).toBe('light');
    expect(out.values.statusBar).toBe(false);
    expect(out.values.cornerSize).toBe(20);
  });

  it('follows the new defaults for stored values', () => {
    const imm = immortalitySchema();
    const out = migrate(imm, {
      version: 1,
      values: { palette: 'mission', glow: 'strong', statusBar: false },
    });
    expect(out.values.palette).toBe('poseidon');
    expect(out.values.glow).toBe('strong');
    expect(out.values.statusBar).toBe(true);
  });

  it('reports versions it cannot migrate and never throws', () => {
    expect(
      codes(migrate(schema, { version: 0, values: {} }).diagnostics)
    ).toEqual(['no-migration']);
    expect(
      codes(migrate(schema, { version: 9, values: {} }).diagnostics)
    ).toEqual(['newer-version']);
    expect(migrate(schema, null).values).toEqual(defaults(schema));
    expect(migrate(schema, { values: 'x' }).values).toEqual(defaults(schema));
  });
});
