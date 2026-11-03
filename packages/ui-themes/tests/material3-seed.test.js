/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Hct,
  argbFromHex,
  hexFromArgb,
  SchemeTonalSpot,
} from '@material/material-color-utilities';
import { values } from '@link-foundation/ui-core';
import { loadThemes } from '@link-foundation/ui-tokens/themes';
import { materialThemeFromSeed } from '../src/index.js';

it('matches MCU baseline primary and supplies three complete schemes', () => {
  const result = loadThemes(materialThemeFromSeed('#6750A4'));
  assert.deepEqual(result.diagnostics, []);
  const theme = result.themes[0];
  const scheme = new SchemeTonalSpot(
    Hct.fromInt(argbFromHex('#6750A4')),
    false,
    0
  );
  assert.equal(
    values.toCss(theme.tokens.get('color.primary')).toLowerCase(),
    hexFromArgb(scheme.primary)
  );
  assert.ok(theme.modes.dark.size >= 40);
  assert.ok(theme.modes['high-contrast'].size >= 40);
});

it('generates byte-identical baseline colors twice, matching the committed artifact', async () => {
  const { material3Colors } = await import('../scripts/generate-material3.mjs');
  const { readFile } = await import('node:fs/promises');
  const first = material3Colors(),
    second = material3Colors();
  assert.equal(first, second);
  assert.equal(
    first,
    await readFile(
      new URL('../themes/material3/colors.lino', import.meta.url),
      'utf8'
    )
  );
});
it('supports seed variants, contrast and rejects invalid input', () => {
  assert.notEqual(
    materialThemeFromSeed('#123456'),
    materialThemeFromSeed('#123456', { variant: 'vibrant' })
  );
  assert.notEqual(
    materialThemeFromSeed('#123456'),
    materialThemeFromSeed('#123456', { variant: 'neutral', contrast: 0.5 })
  );
  assert.equal(materialThemeFromSeed('#abc'), materialThemeFromSeed('#aabbcc'));
  assert.throws(() => materialThemeFromSeed('red'), TypeError);
  assert.throws(
    () => materialThemeFromSeed('#123456', { contrast: 2 }),
    RangeError
  );
  assert.throws(
    () => materialThemeFromSeed('#123456', { variant: '__proto__' }),
    RangeError
  );
});
