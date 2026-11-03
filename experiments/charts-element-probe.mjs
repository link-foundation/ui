import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const { defineChartElements } =
  await import('/tmp/gh-issue-solver-1793684369862/packages/ui-components/src/index.js');
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const w = dom.window;
defineChartElements(w);
const lino = readFileSync(
  '/tmp/gh-issue-solver-1793684369862/packages/ui-components/tests/charts/fixtures/sales-line.lino',
  'utf8'
);
w.document.body.innerHTML = `<ui-chart><script type="text/lino">${lino}</script></ui-chart><ui-sparkline label="Visits" values="1 4 2 6"></ui-sparkline><ui-gauge value="40" label="Disk"></ui-gauge>`;
const c = w.document.querySelector('ui-chart');
const canvas = c.querySelector('.ui-chart-canvas');
for (const key of ['ArrowRight', 'ArrowRight', 'End', 'ArrowUp']) {
  canvas.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
}
console.log(c.querySelector('.ui-chart-live').textContent);
c.querySelector('button').click();
console.log(
  c.querySelector('button').outerHTML,
  c.querySelector('table').className
);
console.log(w.document.querySelector('ui-sparkline').innerHTML.slice(0, 300));
console.log(
  w.document.querySelector('ui-gauge svg').getAttribute('aria-label')
);
