/** APG tabs: link-id ARIA pairs and automatic or manual activation. */
import { createRovingTabindex } from '../a11y/index.js';
import { interpret } from '../behavior/index.js';
import {
  atomOf,
  emit,
  idOf,
  listen,
  make,
  registerOverlay,
  watchChildren,
} from './dom.js';
import { TABS_MACHINE } from './machines/index.js';

export function createTabs(node, initial, ctx) {
  let el = initial;
  let wanted;
  const strip = make(ctx.document, 'div', { role: 'tablist' });
  node.prepend(strip);
  const tabs = () => [...strip.children];
  const panels = () =>
    [...node.children].filter(
      (child) => child.getAttribute('role') === 'tabpanel'
    );
  const service = interpret(TABS_MACHINE, {
    actions: { 'select-tab': (args, meta) => meta.assign({ active: wanted }) },
  });
  const select = (tab) => {
    if (!tab || tab.getAttribute('aria-disabled') === 'true') {
      return;
    }
    wanted = tab.dataset.linkId;
    const changed = service.context.active !== wanted;
    service.send('select');
    for (const item of tabs()) {
      item.setAttribute('aria-selected', String(item === tab));
    }
    for (const panel of panels()) {
      panel.hidden = panel.id !== tab.getAttribute('aria-controls');
    }
    if (changed) {
      emit(node, 'ui-select', { tab: wanted });
    }
  };
  const roving = createRovingTabindex(tabs, {
    onChange: (index, item) => {
      if (atomOf(el, 'activation') !== 'manual') {
        select(item);
      }
    },
  });
  const refresh = () => {
    for (const child of [...node.children]) {
      if (child.getAttribute('role') === 'tab') {
        strip.append(child);
      }
    }
    strip.setAttribute('aria-label', atomOf(el, 'label') ?? 'Tabs');
    for (const [index, tab] of tabs().entries()) {
      const panel =
        panels().find((p) => p.dataset.linkId === tab.dataset.panel) ??
        panels()[index];
      if (!panel) {
        continue;
      }
      tab.setAttribute('aria-controls', idOf(panel));
      panel.setAttribute('aria-labelledby', idOf(tab));
    }
    const current =
      tabs().find(
        (tab) =>
          tab.dataset.linkId === service.context.active ||
          tab.dataset.linkId === atomOf(el, 'active')
      ) ?? tabs().find((tab) => tab.getAttribute('aria-disabled') !== 'true');
    select(current);
    roving.update();
    observer.takeRecords();
  };
  const observer = watchChildren(node, refresh, ['role']);
  const detach = [
    roving.attach(strip),
    listen(strip, 'click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tabs().includes(tab)) {
        roving.focus(tabs().indexOf(tab));
        select(tab);
      }
    }),
    listen(strip, 'keydown', (event) => {
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        select(event.target);
      }
    }),
  ];
  return {
    service,
    update(next) {
      el = next;
      globalThis.queueMicrotask(refresh);
    },
    disconnect() {
      observer.disconnect();
      detach.forEach((fn) => fn());
      service.stop();
    },
  };
}
registerOverlay('tabs', (el, ctx) => make(ctx.document, 'div'), createTabs);
registerOverlay(
  'tab',
  (el, ctx) => make(ctx.document, 'button', { role: 'tab', type: 'button' }),
  (node) => ({
    update(el) {
      node.textContent = atomOf(el, 'label') ?? el.positional[0] ?? el.id;
      node.dataset.panel = atomOf(el, 'panel') ?? '';
      node.setAttribute('aria-disabled', atomOf(el, 'disabled') ?? 'false');
    },
  })
);
registerOverlay(
  'tab-panel',
  (el, ctx) => make(ctx.document, 'div', { role: 'tabpanel', tabindex: '0' }),
  () => ({})
);
