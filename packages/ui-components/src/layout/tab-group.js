/**
 * `tab-group`: panels shown one at a time behind a tab strip (WAI-ARIA APG
 * tabs pattern, automatic activation).
 *
 *   (inspector: tab-group (label Inspector) (active styles)
 *     (styles: panel (title Styles) ...)
 *     (events: panel (title Events) (closable true) ...))
 *
 * The strip is described in `tab-strip.js`. Selecting, closing and
 * reordering tabs change the rendered group and send the events
 * `tab-change` (`detail.active`), `tab-close` (`detail.panel`) and
 * `tab-reorder` (`detail.order`); the application may write them back to
 * its store.
 */

import { defineKind } from '@link-foundation/ui-dom';
import {
  atomOf,
  controllerOf,
  dropController,
  emit,
  findController,
  idOf,
  isLive,
  linkId,
  renderedChildren,
  titleOf,
  watchChildren,
} from './dom.js';
import { createTabStrip } from './tab-strip.js';

/** Mark a panel as the tab panel of a tab. */
export function showPanel(panel, tabId, shown) {
  panel.setAttribute('role', 'tabpanel');
  if (tabId !== null) {
    panel.setAttribute('aria-labelledby', tabId);
  }
  panel.tabIndex = 0;
  panel.toggleAttribute('hidden', !shown);
}

/** The tab of a rendered panel. */
export const tabOf = (panel) => ({
  id: linkId(panel),
  title: titleOf(panel),
  panel: idOf(panel, 'ui-tab-panel'),
  closable: panel.getAttribute('data-closable') === 'true',
});

function createTabGroup(node, ctx, el) {
  const state = { el, active: null, order: [], closed: new Set() };

  const panels = () =>
    renderedChildren(node).filter((p) => !state.closed.has(linkId(p)));

  const sorted = () => {
    const all = panels();
    const rank = (p) => {
      const i = state.order.indexOf(linkId(p));
      return i < 0 ? state.order.length + all.indexOf(p) : i;
    };
    return [...all].sort((a, b) => rank(a) - rank(b));
  };

  const refresh = () => {
    const list = sorted();
    const ids = list.map(linkId);
    if (!ids.includes(state.active)) {
      const wanted = atomOf(state.el, 'active');
      state.active = ids.includes(wanted) ? wanted : (ids[0] ?? null);
    }
    strip.render(list.map(tabOf), state.active);
    for (const panel of renderedChildren(node)) {
      const id = linkId(panel);
      showPanel(panel, strip.tabId(id), id === state.active);
    }
  };

  const strip = createTabStrip(ctx.document, {
    get label() {
      return atomOf(state.el, 'label') ?? 'Tabs';
    },
    get reorderable() {
      return atomOf(state.el, 'reorderable') !== 'false';
    },
    select(id) {
      if (id !== state.active) {
        state.active = id;
        refresh();
        emit(node, 'tab-change', { active: id });
      }
    },
    close(id) {
      const ids = sorted().map(linkId);
      const at = ids.indexOf(id);
      state.closed.add(id);
      if (state.active === id) {
        state.active = ids[at + 1] ?? ids[at - 1] ?? null;
      }
      refresh();
      if (state.active !== null) {
        strip.focusTab(state.active);
      }
      emit(node, 'tab-close', { panel: id });
    },
    reorder(order) {
      state.order = order;
      refresh();
      emit(node, 'tab-reorder', { order: [...order] });
    },
  });
  node.prepend(strip.element);

  const observer = watchChildren(node, refresh, [
    'data-title',
    'data-closable',
  ]);
  return {
    state,
    strip,
    update(el, changed) {
      state.el = el;
      if (changed.includes('active')) {
        state.active = atomOf(el, 'active') ?? state.active;
      }
      refresh();
      observer.takeRecords();
    },
    disconnect() {
      observer.disconnect();
      strip.disconnect();
    },
  };
}

defineKind('tab-group', {
  tag: 'ui-tab-group',
  create: (el, ctx) => ctx.document.createElement('ui-tab-group'),
  update(node, el, changed, ctx) {
    if (isLive(ctx)) {
      controllerOf(node, () => createTabGroup(node, ctx, el)).update(
        el,
        changed
      );
    }
  },
  destroy: (node) => dropController(node),
});

/** The selected panel id of a rendered tab group (for tests and tools). */
export const activeTab = (node) => findController(node)?.state.active ?? null;
