// Regenerate the expected .lino of the JSX and Vue fixtures (review the diff!).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importJsx, importVue } from '../packages/ui-convert/src/index.js';

const base = join(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/ui-convert/tests'
);
for (const [dir, importer] of [
  ['jsx', importJsx],
  ['vue', importVue],
]) {
  const fixtures = join(base, dir, 'fixtures');
  for (const file of readdirSync(fixtures)) {
    const match = /^(.*)\.(jsx|tsx|vue)$/.exec(file);
    if (!match) {
      continue;
    }
    const { text } = importer(readFileSync(join(fixtures, file), 'utf8'));
    writeFileSync(join(fixtures, `${match[1]}.lino`), text);
    console.log(file);
  }
}
