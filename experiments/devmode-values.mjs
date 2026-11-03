// ui-core value helpers the dev mode editors use (#54).
import { values, formatLinks } from '@link-foundation/ui-core';
console.log(values.DIMENSION_UNITS, values.DURATION_UNITS);
console.log(
  values.splitQuantity('16px', values.DIMENSION_UNITS),
  values.splitQuantity('1.5rem', values.DIMENSION_UNITS),
  values.splitQuantity('0', values.DIMENSION_UNITS),
  values.parseDimension('0')
);
console.log(
  values.formatValue({ type: 'dimension', value: 16, unit: 'px' }),
  values.formatValue({ type: 'token-ref', path: 'a.b' }),
  values.formatValue({ type: 'number', value: 2 })
);
console.log(values.toHex(values.parseColor('#6750A4')));
console.log(
  formatLinks(['Hello, links']),
  '|',
  formatLinks([['token', 'space.medium']]),
  '|',
  formatLinks(['OK']),
  '|',
  formatLinks(['press', ['navigate', 'home']])
);
