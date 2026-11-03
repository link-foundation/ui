// Parse the inline charts of the gallery with jsdom and the chart model.
import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parseChart } from '../packages/ui-components/src/charts/chart-model.js';

const html = readFileSync(
  new URL('../packages/ui-components/examples/charts.html', import.meta.url),
  'utf8'
);
const { document } = new JSDOM(html).window;
for (const script of document.querySelectorAll('script[type="text/lino"]')) {
  const spec = parseChart(script.textContent);
  console.log(spec.id, spec.mark.type, spec.data.values.length);
}
