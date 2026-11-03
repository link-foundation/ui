// Render every chart fixture to SVG files in experiments/out/ for a look.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';
import { chartsFromLinks } from '../packages/ui-components/src/charts/chart-model.js';
import { parseLino } from '../packages/ui-components/src/charts/lino.js';
import { renderChartSvg } from '../packages/ui-components/src/charts/svg-renderer.js';
import { CHART_TOKENS } from '../packages/ui-components/src/charts/tokens.js';

const dir = new URL(
  '../packages/ui-components/tests/charts/fixtures/',
  import.meta.url
);
const out = new URL('./out/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const file of readdirSync(dir).filter(
  (f) => f.endsWith('.lino') && !f.startsWith('bad')
)) {
  for (const spec of chartsFromLinks(
    parseLino(readFileSync(new URL(file, dir), 'utf8'))
  )) {
    for (const mode of ['light', 'dark']) {
      const svg = renderChartSvg(spec, { tokens: CHART_TOKENS[mode] });
      const bg = CHART_TOKENS[mode]['color.chart.background'];
      writeFileSync(
        new URL(`${spec.id}-${mode}.svg`, out),
        svg.replace('>', ` style="background:${bg}">`)
      );
    }
  }
}
console.log(readdirSync(out).join('\n'));
