/* eslint local/no-changelog-comments: ["warn", {"allowDatesInStrings": true}] -- The example has fixed dates. */
import {
  attachChartInteraction,
  configureChartDocument,
  createChartTable,
  defineChartElements,
  layoutChart,
  parseChart,
} from '@link-foundation/ui-components/charts';
import { attachScrollNavigation } from '@link-foundation/ui-components/layout';

const date = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const number = new Intl.NumberFormat('en-US');
const overlayRoot = document.querySelector('#chart-overlays');
configureChartDocument(document, {
  overlayRoot,
  className: 'site-tooltip',
  theme: () => 'light',
  label({ datum }, spec) {
    if (spec.kind === 'stat-tile') {
      return `${number.format(datum.value)} contributions`;
    }
    if (spec.mark.type === 'calendar') {
      return `${date.format(new Date(datum.day))} · ${datum.count} contributions`;
    }
    if (spec.mark.type === 'range') {
      return `${datum.project} · through ${date.format(new Date(spec.ongoingEnd))}`;
    }
    return `${datum.sample} · ${datum.count} contributions`;
  },
  renderTooltip({ text, spec }) {
    const body = document.createDocumentFragment();
    const name = document.createElement('strong');
    name.textContent = spec.title ?? spec.label;
    body.append(name, text);
    return body;
  },
});

const samples = parseChart(`latest: chart
  title 'Sample counts'
  mark bar
  data
    row
      sample Weekday
      count 4
    row
      sample Weekend
      count 12
  encoding
    x
      field sample
      type nominal
    y
      field count
      type quantitative
`);
const host = document.querySelector('#host-chart');
const layout = layoutChart(samples);
for (const { points } of layout.series) {
  for (const point of points) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.chartRow = point.row;
    button.textContent = point.datum.sample;
    button.style.height = `${22 + point.datum.count * 4}px`;
    host.append(button);
  }
}
const table = createChartTable(document, samples);
table.classList.add('ui-visually-hidden');
host.after(table);
attachChartInteraction(host, samples, { layout });

const calendar = `contributions: chart
  title 'Contribution calendar'
  mark calendar
  data
    row
      day 2025-01-02
      count 3
    row
      day 2025-01-03
      count 4
    row
      day 2025-01-09
      count 8
  encoding
    x
      field day
      type temporal
    y
      field count
      type quantitative
`;
const timeline = `project: chart
  title 'Project history'
  mark range
  ongoing-end 2025-06-01
  data
    row
      project Documentation
      start 2025-01-01
      end ongoing
  encoding
    x
      field start
      type temporal
    x2
      field end
      type temporal
    y
      field project
      type nominal
`;
defineChartElements();
document.querySelector('#contributions').lino = calendar;
document.querySelector('#timeline').lino = timeline;

const sections = document.querySelector('#sections');
const navigation = attachScrollNavigation(sections, { kind: 'section' });
sections.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (link) {
    navigation.setActive(link.getAttribute('href'));
  }
});
