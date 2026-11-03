/* global URL */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { formatLinks, parseNested } from '@link-foundation/ui-core';
import { materialThemeFromSeed } from '../src/material3/seed.js';

/** Baseline package colours, with no dependency on the theme they compose. */
export function material3Colors() {
  const [colors] = parseNested(
    materialThemeFromSeed('#6750A4', { id: 'material3-colors' })
  );
  colors.values = colors.values.filter(
    (link) => link.values?.[0]?.id !== 'extends'
  );
  return formatLinks([colors]);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(
    new URL('../themes/material3/colors.lino', import.meta.url),
    material3Colors()
  );
}
