import { chartsFromLinks, defineChartElements } from '../src/charts/index.js';
import { parseNested } from '@link-foundation/ui-core';

defineChartElements(window);
const specs = chartsFromLinks(
  parseNested(await (await fetch('./activity-charts.lino')).text())
);
const gallery = document.querySelector('#gallery');
for (const spec of specs) {
  if (spec.id === 'calendar') {
    spec.data.values = Array.from({ length: 365 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
      count: (i * 7 + (i % 3)) % 16,
    }));
  }
  if (spec.tooltip) {
    spec.tooltip.content = (datum) => ({
      title: datum.name ?? datum.date ?? datum.day,
      value: datum.count ?? datum.start,
      rows: [
        ['Context', 'Activity snapshot'],
        ['Status', datum.end ?? 'Available'],
      ],
    });
  }
  const section = document.createElement('section');
  section.id = spec.id === 'log' ? 'clipped' : `section-${spec.id}`;
  const heading = document.createElement('h2');
  heading.textContent = spec.title ?? spec.label;
  const chart = document.createElement('ui-chart');
  chart.id = `activity-${spec.id}`;
  chart.className = 'ui-chart';
  chart.spec = spec;
  section.append(heading, chart);
  gallery.append(section);
}
document.querySelector('#theme').addEventListener('click', () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
});
