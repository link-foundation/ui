/**
 * The drawing of a dock (see `dock.js`): one box with a tab strip per
 * region, one window frame per floating panel, and the closed panels kept
 * hidden. Every function takes the dock context `dock`:
 *
 *   { node, document, layers, holder, floatLayer, restore, state, change }
 *
 * where `state.layout` is the dock layout and `state.panels` maps panel ids
 * to their rendered nodes.
 */

import {
  activatePanel,
  closePanel,
  findPanel,
  floatPanel,
  movePanel,
  SIDES,
  updateRegion,
} from './dock-model.js';
import { idOf, make, titleOf } from './dom.js';
import { isTrackAtom } from './grid.js';
import { showPanel } from './tab-group.js';
import { createTabStrip } from './tab-strip.js';
import { createWindowFrame } from './window-frame.js';

const SIDE_NAMES = {
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom',
  center: 'Center',
};

/** Whether a dock panel may be closed (all but `(closable false)`). */
export const isClosable = (panel) =>
  panel?.getAttribute('data-closable') !== 'false';

const panelNode = (dock, id) => dock.state.panels.get(id);

/** The id of the region on a side; the side itself when there is none. */
const regionOn = (layout, side) =>
  layout.regions.find((r) => r.side === side)?.id ?? side;

/** Focus the tab or the floating window of a panel, else "Restore". */
export function focusPanel(dock, id) {
  const found = findPanel(dock.state.layout, id);
  if (found?.place === 'region') {
    dock.state.regions.get(found.region.id)?.strip.focusTab(id);
  } else if (found?.place === 'floating') {
    dock.state.floats.get(id)?.frame.root.focus();
  } else {
    dock.restore.focus();
  }
}

/** Close a panel of a region; the focus goes to the tab shown after it. */
function closeInRegion(dock, id, regionId) {
  const layout = closePanel(dock.state.layout, id);
  const next = layout.regions.find((r) => r.id === regionId)?.active;
  dock.change(layout, next ?? id);
}

/** The "Panel actions" menu items of the shown panel of a region. */
function regionActions(dock, regionId, id) {
  const layout = dock.state.layout;
  const region = layout.regions.find((r) => r.id === regionId);
  if (region === undefined) {
    return [];
  }
  const moves = SIDES.filter((side) => side !== region.side).map((side) => ({
    label: `Move to ${SIDE_NAMES[side].toLowerCase()}`,
    run: () =>
      dock.change(
        movePanel(dock.state.layout, id, {
          region: regionOn(dock.state.layout, side),
          activate: true,
        }),
        id
      ),
  }));
  return [
    ...moves,
    {
      label: 'Float',
      run: () => dock.change(floatPanel(dock.state.layout, id), id),
    },
    {
      label: 'Close',
      disabled: !isClosable(panelNode(dock, id)),
      run: () => closeInRegion(dock, id, regionId),
    },
    {
      label: region.collapsed ? 'Expand region' : 'Collapse region',
      run: () =>
        dock.change(
          updateRegion(dock.state.layout, regionId, {
            collapsed: !region.collapsed,
          }),
          id
        ),
    },
  ];
}

/** The layout with the panels of a region in a new order. */
function reordered(layout, regionId, order) {
  return {
    ...layout,
    regions: layout.regions.map((r) =>
      r.id === regionId
        ? {
            ...r,
            panels: [...order, ...r.panels.filter((p) => !order.includes(p))],
          }
        : r
    ),
  };
}

function makeRegion(dock, region) {
  const label = `${SIDE_NAMES[region.side]} panels`;
  const box = make(dock.document, 'div', {
    class: 'ui-dock-region',
    role: 'group',
    'data-side': region.side,
    'aria-label': label,
  });
  const strip = createTabStrip(dock.document, {
    label,
    select: (id) => dock.change(activatePanel(dock.state.layout, id)),
    close: (id) => closeInRegion(dock, id, region.id),
    reorder: (order) =>
      dock.change(reordered(dock.state.layout, region.id, order)),
    receive: (id, index) =>
      dock.change(
        movePanel(dock.state.layout, id, {
          region: region.id,
          index,
          activate: true,
        }),
        id
      ),
    actions: (id) => regionActions(dock, region.id, id),
  });
  box.append(strip.element);
  dock.node.insertBefore(box, dock.floatLayer);
  return { box, strip, side: region.side };
}

/** Draw a region: its tabs and its panels; `shown` gets it when it has any. */
function renderRegion(dock, region, shown) {
  const { state } = dock;
  let entry = state.regions.get(region.id);
  if (entry === undefined || entry.side !== region.side) {
    dropRegion(dock, region.id);
    entry = makeRegion(dock, region);
    state.regions.set(region.id, entry);
  }
  const ids = region.panels.filter((id) => panelNode(dock, id) !== undefined);
  const active = ids.includes(region.active) ? region.active : ids[0];
  entry.strip.render(
    ids.map((id) => ({
      id,
      title: titleOf(panelNode(dock, id)),
      panel: idOf(panelNode(dock, id), 'ui-dock-panel'),
      closable: isClosable(panelNode(dock, id)),
    })),
    active ?? null
  );
  for (const id of ids) {
    const panel = panelNode(dock, id);
    if (panel.parentNode !== entry.box) {
      entry.box.append(panel);
    }
    showPanel(panel, entry.strip.tabId(id), id === active && !region.collapsed);
  }
  entry.box.hidden = ids.length === 0;
  entry.box.style.setProperty('grid-area', region.side);
  entry.box.toggleAttribute('data-collapsed', region.collapsed);
  if (ids.length > 0) {
    shown.add(region.id);
  }
}

function dropRegion(dock, id) {
  const entry = dock.state.regions.get(id);
  entry?.box.remove();
  entry?.strip.disconnect();
  dock.state.regions.delete(id);
}

/** Put a floating panel back in the region it came from (or the center). */
function dockBack(dock, id) {
  const layout = dock.state.layout;
  const from = layout.floating.find((f) => f.panel === id)?.region;
  dock.change(
    movePanel(layout, id, {
      region: from ?? regionOn(layout, 'center'),
      activate: true,
    }),
    id
  );
}

function makeFloat(dock, id) {
  const root = make(dock.document, 'div', { class: 'ui-dock-float' });
  dock.floatLayer.append(root);
  const dockButton = make(
    dock.document,
    'button',
    { type: 'button', class: 'ui-window-tool' },
    '⇲'
  );
  dockButton.addEventListener('click', () => dockBack(dock, id));
  const frame = createWindowFrame(root, {
    title: '',
    layers: dock.layers,
    onClose: () => dock.change(closePanel(dock.state.layout, id), id),
    onChange: (rect) => dock.change(floatPanel(dock.state.layout, id, rect)),
    tools: [dockButton],
  });
  frame.raise();
  return { root, frame, dockButton };
}

function renderFloat(dock, f) {
  let entry = dock.state.floats.get(f.panel);
  if (entry === undefined) {
    entry = makeFloat(dock, f.panel);
    dock.state.floats.set(f.panel, entry);
  }
  const panel = panelNode(dock, f.panel);
  const title = titleOf(panel);
  entry.frame.setTitle(title);
  entry.frame.setClosable(isClosable(panel));
  entry.dockButton.setAttribute('aria-label', `Dock ${title}`);
  entry.frame.setRect(
    { x: f.x, y: f.y, width: f.width, height: f.height },
    false
  );
  if (panel.parentNode !== entry.frame.body) {
    entry.frame.body.append(panel);
  }
  panel.hidden = false;
  panel.removeAttribute('role');
  panel.removeAttribute('aria-labelledby');
  panel.removeAttribute('tabindex');
}

/** The size track of a side of the dock. */
function track(layout, side, shown) {
  const region = layout.regions.find((r) => r.side === side && shown.has(r.id));
  if (region === undefined || region.collapsed || region.size === null) {
    return 'auto';
  }
  return isTrackAtom(region.size) ? region.size : 'auto';
}

/** Draw the layout: regions, floating panels, closed panels, the grid. */
export function renderDock(dock) {
  const { state, node } = dock;
  const layout = state.layout;
  const shown = new Set();
  layout.regions.forEach((region) => renderRegion(dock, region, shown));
  const floating = layout.floating.filter((f) => panelNode(dock, f.panel));
  floating.forEach((f) => renderFloat(dock, f));
  for (const c of layout.closed) {
    const panel = panelNode(dock, c.panel);
    if (panel !== undefined) {
      panel.hidden = true;
      dock.holder.append(panel);
    }
  }
  for (const id of state.regions.keys()) {
    if (!layout.regions.some((r) => r.id === id)) {
      dropRegion(dock, id);
    }
  }
  for (const [id, entry] of state.floats) {
    if (!floating.some((f) => f.panel === id)) {
      entry.frame.disconnect();
      entry.root.remove();
      state.floats.delete(id);
    }
  }
  dock.restore.hidden = !layout.closed.some((c) => panelNode(dock, c.panel));
  node.style.setProperty(
    'grid-template-columns',
    `${track(layout, 'left', shown)} minmax(0, 1fr) ${track(layout, 'right', shown)}`
  );
  node.style.setProperty(
    'grid-template-rows',
    `auto ${track(layout, 'top', shown)} minmax(0, 1fr) ${track(layout, 'bottom', shown)}`
  );
}

/** Disconnect the strips and the frames of a dock. */
export function disconnectDock(dock) {
  for (const entry of dock.state.regions.values()) {
    entry.strip.disconnect();
  }
  for (const entry of dock.state.floats.values()) {
    entry.frame.disconnect();
  }
}
