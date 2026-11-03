import { mountDocument } from '@link-foundation/ui-dom';
import '../../src/overlays/index.js';
import { createDom, microtasks, press } from '../support/dom.js';
export { microtasks, press };
export async function mount(text, render = {}) {
  const dom = createDom(
    '<button id="trigger">Open</button><div id="app"></div>'
  );
  const mounted = mountDocument(dom.container, text, render);
  await microtasks();
  return {
    ...dom,
    ...mounted,
    node: (id) => mounted.handle.nodeFor(id),
    dispose() {
      mounted.handle.destroy();
      dom.window.close();
    },
  };
}
