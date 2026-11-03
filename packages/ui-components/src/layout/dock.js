/**
 * `dock`: panels docked in the regions left, right, top, bottom and center,
 * each region showing its panels as tabs.
 *
 *   designer-shell: dock
 *     label Designer
 *     persist designer.layout
 *     left: region
 *       size 16rem
 *       panels toolbox outline
 *     right: region
 *       size 20rem
 *       panels properties
 *     center: region
 *       panels canvas
 *     toolbox: panel
 *       title Toolbox
 *       ...
 *     outline: panel
 *       title Outline
 *       ...
 *     properties: panel
 *       title Properties
 *       ...
 *     canvas: panel
 *       title Canvas
 *       closable false
 *       ...
 *
 * The layout is the model of `dock-model.js`, read from the `region`
 * children and the `float` and `closed` properties. A panel that no region
 * lists goes to the center.
 *
 * - The tab strip of a region selects, reorders and closes its panels
 *   (`tab-strip.js`); a tab dragged to another region moves its panel.
 * - The "Panel actions" menu of a region moves the shown panel to another
 *   region, floats it, closes it, and collapses or expands the region.
 * - A floating panel is a window (`window-frame.js`); its "Dock" button
 *   puts it back in its region.
 * - "Restore panel" lists the closed panels.
 * - Ctrl+F6 and Ctrl+Shift+F6 move to the next and the previous open panel.
 *
 * Every change sends `dock-change` with `detail.layout` and `detail.lino`
 * (`dockLayoutToLino`), and is saved under the `persist` key of the
 * render's storage (`options.layout.storage`); a saved layout is used when
 * the dock is rendered again.
 */

import { defineKind } from '@link-foundation/ui-dom';
import { bindKeys } from '../a11y/keys.js';
import {
  activatePanel,
  dockLayoutFromLinks,
  dockLayoutFromNode,
  dockLayoutToLino,
  findPanel,
  movePanel,
  openPanelIds,
  restorePanel,
} from './dock-model.js';
import { disconnectDock, focusPanel, renderDock } from './dock-view.js';
import {
  controllerOf,
  dropController,
  emit,
  findController,
  isLive,
  labelGroup,
  layersOf,
  linkId,
  make,
  readStored,
  renderedChildren,
  storageOf,
  titleOf,
  writeStored,
} from './dom.js';
import { menuButton } from './menu.js';

const holders = new WeakMap();
const regionEls = new WeakMap();

/** The layout with every rendered panel in it (new ones in the center). */
function withPanels(layout, ids) {
  let next = layout;
  for (const id of ids) {
    if (findPanel(next, id) === null) {
      const center =
        next.regions.find((r) => r.side === 'center')?.id ?? 'center';
      next = movePanel(
        { ...next, closed: [...next.closed, { panel: id, region: null }] },
        id,
        center
      );
    }
  }
  return next;
}

/** A saved layout, or `null` when there is none or it does not parse. */
function storedLayout(storage, key) {
  const text = key === null ? null : readStored(storage, key);
  if (text === null) {
    return null;
  }
  try {
    return dockLayoutFromLinks(text);
  } catch {
    return null;
  }
}

/** Apply a new layout: draw it, save it, focus a panel, tell the app. */
function change(dock, layout, focusId) {
  dock.state.layout = layout;
  render(dock);
  const lino = dockLayoutToLino(layout);
  if (layout.persist !== null) {
    writeStored(dock.storage, layout.persist, lino);
  }
  if (focusId !== undefined) {
    focusPanel(dock, focusId);
  }
  emit(dock.node, 'dock-change', { layout, lino });
}

function render(dock) {
  renderDock(dock);
  dock.observer.takeRecords();
}

/** The panels of the dock: its rendered children that are not regions. */
function collectPanels(dock) {
  const panels = new Map();
  for (const panel of dock.state.panels.values()) {
    if (dock.node.contains(panel) && linkId(panel) !== null) {
      panels.set(linkId(panel), panel);
    }
  }
  for (const child of renderedChildren(dock.holder)) {
    if (child.localName !== 'ui-region') {
      panels.set(linkId(child), child);
    }
  }
  dock.state.panels = panels;
}

/** The layout written in the store: the dock and its regions. */
function sourceLayout(dock) {
  const regions = renderedChildren(dock.holder)
    .filter((child) => regionEls.has(child))
    .map((child) => regionEls.get(child));
  return dockLayoutFromNode({
    id: dock.state.el.name ?? null,
    properties: dock.state.el.properties,
    children: regions.map((r) => ({
      id: r.name,
      kind: 'region',
      properties: r.properties,
    })),
  });
}

/** Read the layout again; a saved one wins on the first read. */
function reload(dock) {
  const { state } = dock;
  state.scheduled = false;
  collectPanels(dock);
  const source = sourceLayout(dock);
  const text = dockLayoutToLino(source);
  if (text !== state.sourceText) {
    const first = state.sourceText === null;
    state.sourceText = text;
    state.layout =
      (first ? storedLayout(dock.storage, source.persist) : null) ?? source;
  }
  state.layout = withPanels(state.layout, [...state.panels.keys()]);
  render(dock);
}

/** Reload once, after the current task (a render inserts many nodes). */
function schedule(dock) {
  if (!dock.state.scheduled) {
    dock.state.scheduled = true;
    dock.document.defaultView.queueMicrotask(() => reload(dock));
  }
}

/** The index in `ids` of the panel holding the focus, else -1. */
function focusedIndex(dock, ids) {
  const active = dock.document.activeElement;
  const inside = ids.findIndex((id) =>
    [dock.state.panels.get(id), dock.state.floats.get(id)?.root].some((n) =>
      n?.contains(active)
    )
  );
  if (inside >= 0) {
    return inside;
  }
  const tab = active?.closest?.('[role=tab]');
  return ids.findIndex((id) => tab?.dataset.panel === id);
}

/**
 * Focus the next (`step` 1) or the previous (-1) open panel; false when
 * there is none, so the key is left alone.
 */
function cyclePanels(dock, step) {
  const { state } = dock;
  if (state.layout === null) {
    return false;
  }
  const ids = openPanelIds(state.layout).filter((id) => state.panels.get(id));
  if (ids.length === 0) {
    return false;
  }
  const at = focusedIndex(dock, ids);
  const next = ids[(at + step + ids.length) % ids.length] ?? ids[0];
  if (findPanel(state.layout, next).place === 'region') {
    change(dock, activatePanel(state.layout, next), next);
  } else {
    focusPanel(dock, next);
  }
}

/** The "Restore panel" button: a menu of the closed panels. */
function restoreButton(dock) {
  return menuButton(dock.document, {
    label: 'Restore panel',
    text: 'Restore panel',
    className: 'ui-dock-restore',
    items: () =>
      dock.state.layout.closed
        .filter((c) => dock.state.panels.get(c.panel) !== undefined)
        .map((c) => ({
          label: titleOf(dock.state.panels.get(c.panel)),
          run: () =>
            dock.change(restorePanel(dock.state.layout, c.panel), c.panel),
        })),
  });
}

function observe(dock) {
  const { holder, node, state } = dock;
  const observer = new dock.document.defaultView.MutationObserver((records) => {
    const relevant = records.some((r) =>
      r.type === 'childList'
        ? r.target === holder
        : state.panels.get(linkId(r.target)) === r.target
    );
    if (relevant) {
      schedule(dock);
    }
  });
  observer.observe(holder, { childList: true });
  observer.observe(node, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-title', 'data-closable'],
  });
  return observer;
}

function createDock(node, ctx) {
  const document = ctx.document;
  const dock = {
    node,
    document,
    storage: storageOf(ctx),
    layers: layersOf(ctx),
    holder: holders.get(node),
    state: {
      el: null,
      layout: null,
      sourceText: null,
      panels: new Map(),
      regions: new Map(),
      floats: new Map(),
      scheduled: false,
    },
  };
  dock.change = (layout, focusId) => change(dock, layout, focusId);
  dock.restore = restoreButton(dock);
  const tools = make(document, 'div', { class: 'ui-dock-tools' });
  tools.append(dock.restore);
  dock.floatLayer = make(document, 'div', { class: 'ui-dock-floating' });
  node.prepend(tools);
  node.append(dock.floatLayer);
  dock.observer = observe(dock);
  // Ctrl+F6 and Ctrl+Shift+F6: the next and the previous open panel.
  bindKeys(node, {
    'Ctrl+F6': () => cyclePanels(dock, 1),
    'Ctrl+Shift+F6': () => cyclePanels(dock, -1),
  });
  return {
    state: dock.state,
    schedule: () => schedule(dock),
    update(el) {
      dock.state.el = el;
      schedule(dock);
    },
    disconnect() {
      dock.observer.disconnect();
      disconnectDock(dock);
    },
  };
}

defineKind('dock', {
  tag: 'ui-dock',
  childrenSlot: (node) => holders.get(node) ?? node,
  create(el, ctx) {
    const node = ctx.document.createElement('ui-dock');
    if (isLive(ctx)) {
      const holder = ctx.document.createElement('div');
      holder.className = 'ui-dock-holder';
      holder.hidden = true;
      node.appendChild(holder);
      holders.set(node, holder);
    }
    return node;
  },
  update(node, el, changed, ctx) {
    if (changed.includes('label')) {
      labelGroup(node, el);
    }
    if (isLive(ctx)) {
      controllerOf(node, () => createDock(node, ctx)).update(el);
    }
  },
  destroy: (node) => dropController(node),
});

defineKind('region', {
  tag: 'ui-region',
  childrenSlot: null,
  create(el, ctx) {
    const node = ctx.document.createElement('ui-region');
    node.setAttribute('hidden', '');
    return node;
  },
  update(node, el) {
    regionEls.set(node, el);
    const dock = node.parentNode?.parentNode;
    if (dock) {
      findController(dock)?.schedule?.();
    }
  },
});

/** The current layout of a rendered dock (for tests and tools). */
export const dockLayout = (node) => findController(node)?.state.layout ?? null;
