// Debug: the focus and z-index of windows opened from the store.
import { mountLayout } from '../packages/ui-components/tests/layout/helpers.js';
import { createLayerManager } from '@link-foundation/ui-components';
const layers = createLayerManager();
layers.register('modal', 'modal');
const page = await mountLayout(
  `(inspector: window (title Inspector) (open false)
  (ok: button 'OK'))
(other: window (title Other) (x 10) (y 10) (b: button 'B'))`,
  { layout: { layers } }
);
page.document.getElementById('opener').focus();
page.store.setProp('inspector', 'open', ['true']);
page.handle.flush();
const i = page.node('inspector');
console.log(
  page.node('ok').outerHTML,
  page.document.activeElement.outerHTML.slice(0, 120)
);
console.log(i.style.zIndex, page.node('other').style.zIndex, layers.order());
