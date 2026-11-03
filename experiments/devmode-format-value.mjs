// Issue #54: how ui-core formatLinks writes raw property values for display.
import { formatLinks } from '@link-foundation/ui-core';
const show = (values) => formatLinks([values]).trim().slice(1, -1);
for (const v of [['Hello, links'], ['OK'], [['token', 'space.medium']], ['16px'], [['navigate', 'home']], ["it's"], ['a:b'], ['x', 'y'], ['scale', ['0', '1']]]) {
  console.log(JSON.stringify(v), '=>', JSON.stringify(show(v)));
}
