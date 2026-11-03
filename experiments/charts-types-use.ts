import {
  parseChart,
  defineChartElements,
  chartToLino,
  ChartSpecError,
  type UiChartElement,
} from '@link-foundation/ui-components';
import { toEChartsOption } from '@link-foundation/ui-components/charts/echarts';
const spec = parseChart('(a: gauge (value 3))');
const text: string = chartToLino(spec);
defineChartElements(window);
const el = document.querySelector('ui-chart') as UiChartElement;
el.ready.then(() => el.activePoint?.text);
if (spec.kind === 'chart') toEChartsOption(spec, { theme: 'dark' });
try {
  parseChart('x');
} catch (e) {
  if (e instanceof ChartSpecError) console.log(e.path, text);
}
