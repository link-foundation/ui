// Round-trip every chart fixture through chartToLino and the official parser.
import { readdirSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  chartsFromLinks,
  chartToLino,
} from '../packages/ui-components/src/charts/chart-model.js';
import { parseLino } from '../packages/ui-components/src/charts/lino.js';

const dir = new URL(
  '../packages/ui-components/tests/charts/fixtures/',
  import.meta.url
);
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith('.lino'))
  .sort()) {
  const text = readFileSync(new URL(file, dir), 'utf8');
  try {
    for (const spec of chartsFromLinks(parseLino(text))) {
      const lino = chartToLino(spec);
      const [back] = chartsFromLinks(parseLino(lino));
      console.log(
        file,
        spec.id,
        isDeepStrictEqual(back, spec) ? 'OK' : 'MISMATCH'
      );
      if (process.argv.includes('-v')) {
        console.log(lino, JSON.stringify(spec));
      }
    }
  } catch (error) {
    console.log(file, 'ERROR', error.code, error.message);
  }
}
