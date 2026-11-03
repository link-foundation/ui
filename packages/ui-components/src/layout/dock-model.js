/**
 * The pure model of a dock: regions (left, right, top, bottom, center) that
 * show panels as tabs, floating panels and closed panels. A layout is read
 * from Links Notation (`dockLayoutFromLinks`) and written back
 * (`dockLayoutToLino`), so it is saved and restored as LiNo:
 *
 *   designer-shell: dock
 *     persist designer.layout
 *     left: region
 *       size 16rem
 *       panels toolbox outline
 *     right: region
 *       size 20rem
 *       panels properties
 *     center: region
 *       panels canvas
 *     bottom: region
 *       size 12rem
 *       collapsed true
 *       panels problems
 *     float search
 *       x 40
 *       y 60
 *       width 320
 *       height 240
 *       region left
 *     closed history right
 *
 * Reading goes through `links-notation` and the ui-core projection (no
 * regular expressions), so any form of the text reads; writing builds
 * `links-notation` `Link` objects and writes them in the nested form with
 * ui-core `formatLinks`, so quoting follows the parser. Every change returns a new
 * layout and leaves its input alone.
 */

import {
  elementLink,
  formatLinks,
  parse as parseUi,
  projectLinks,
} from '@link-foundation/ui-core';
import { Link } from 'links-notation';
import { layoutVocabulary } from './vocabulary.js';

/**
 * @typedef {'left'|'right'|'top'|'bottom'|'center'} Side
 *
 * @typedef {object} DockRegion
 * @property {string} id
 * @property {Side} side
 * @property {string|null} size  a CSS length such as `16rem`
 * @property {boolean} collapsed
 * @property {string[]} panels  panel ids in tab order
 * @property {string|null} active  the panel shown (default the first)
 *
 * @typedef {object} FloatingPanel
 * @property {string} panel
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {string|null} region  the region it was floated from
 *
 * @typedef {object} ClosedPanel
 * @property {string} panel
 * @property {string|null} region  the region it was closed in
 *
 * @typedef {object} DockLayout
 * @property {string|null} id
 * @property {string|null} persist  the storage key of the layout
 * @property {DockRegion[]} regions
 * @property {FloatingPanel[]} floating
 * @property {ClosedPanel[]} closed
 */

/** The sides of a dock, in the order regions are written. */
export const SIDES = Object.freeze([
  'left',
  'right',
  'top',
  'bottom',
  'center',
]);

/** The default size of a floating panel. */
export const FLOAT_DEFAULTS = Object.freeze({
  x: 48,
  y: 48,
  width: 320,
  height: 240,
});

const isSide = (value) => SIDES.includes(value);
const sideOf = (value) => (value === 'centre' ? 'center' : value);

/** The values of the last property `name` of a ui-core node. */
function propertyValues(node, name) {
  const found = node.properties.filter((p) => p.name === name);
  return found.length === 0 ? undefined : found[found.length - 1].values;
}

const atomOf = (node, name) => {
  const values = propertyValues(node, name);
  return typeof values?.[0] === 'string' ? values[0] : null;
};

const textValues = (values) =>
  (values ?? []).filter((value) => typeof value === 'string');

/** `(x 40)` sublinks of a `float` property as an object of strings. */
function fields(values) {
  const out = {};
  for (const value of values) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      out[value[0]] = value[1];
    }
  }
  return out;
}

const numberOr = (text, fallback) => {
  const n = typeof text === 'string' && text.trim() !== '' ? Number(text) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

function readRegion(node) {
  const side = sideOf(atomOf(node, 'side') ?? node.id);
  const panels = textValues(propertyValues(node, 'panels'));
  const active = atomOf(node, 'active');
  return {
    id: node.id,
    side: isSide(side) ? side : 'center',
    size: atomOf(node, 'size'),
    collapsed: atomOf(node, 'collapsed') === 'true',
    panels,
    active: panels.includes(active) ? active : (panels[0] ?? null),
  };
}

function readFloating(values) {
  const [panel, ...rest] = values;
  const f = fields(rest);
  return {
    panel,
    x: numberOr(f.x, FLOAT_DEFAULTS.x),
    y: numberOr(f.y, FLOAT_DEFAULTS.y),
    width: numberOr(f.width, FLOAT_DEFAULTS.width),
    height: numberOr(f.height, FLOAT_DEFAULTS.height),
    region: typeof f.region === 'string' ? f.region : null,
  };
}

/**
 * The layout of a ui-core `dock` node.
 * @param {import('@link-foundation/ui-core').UiNode} node
 * @returns {DockLayout}
 */
export function dockLayoutFromNode(node) {
  const regions = node.children
    .filter((child) => child.kind === 'region' && child.id !== null)
    .map(readRegion);
  const floating = node.properties
    .filter((p) => p.name === 'float' && typeof p.values[0] === 'string')
    .map((p) => readFloating(p.values));
  const closed = node.properties
    .filter((p) => p.name === 'closed' && typeof p.values[0] === 'string')
    .map((p) => ({
      panel: p.values[0],
      region: typeof p.values[1] === 'string' ? p.values[1] : null,
    }));
  return {
    id: node.id,
    persist: atomOf(node, 'persist'),
    regions,
    floating,
    closed,
  };
}

/** The first `dock` node (depth first), or the one with the id `id`. */
function findDock(nodes, id) {
  for (const node of nodes) {
    if (node.kind === 'dock' && (id === undefined || node.id === id)) {
      return node;
    }
    const inner = findDock(node.children ?? [], id);
    if (inner !== null) {
      return inner;
    }
  }
  return null;
}

/** ui-core nodes of LiNo text, links-notation links or ui-core nodes. */
function nodesOf(links) {
  const vocabulary = layoutVocabulary();
  if (typeof links === 'string') {
    return parseUi(links, { vocabulary }).roots;
  }
  if (!Array.isArray(links)) {
    return links?.roots ?? [links];
  }
  const isNode = links.every(
    (l) => l !== null && typeof l?.kind !== 'undefined'
  );
  return isNode ? links : projectLinks(links, vocabulary).roots;
}

/**
 * Read a dock layout.
 * @param {string|object[]|object} links  LiNo text, the links of the
 *   `links-notation` parser, a ui-core document or ui-core nodes
 * @param {{ id?: string }} [options]  the id of the dock, when there are
 *   several
 * @returns {DockLayout}
 * @throws {TypeError} when there is no dock
 */
export function dockLayoutFromLinks(links, options = {}) {
  const node = findDock(nodesOf(links), options.id);
  if (node === null) {
    throw new TypeError(
      options.id === undefined
        ? 'dockLayoutFromLinks: no dock element'
        : `dockLayoutFromLinks: no dock "${options.id}"`
    );
  }
  return dockLayoutFromNode(node);
}

const property = (name, values) => ({ name, values });

/** A region as a ui-core node (written on one line). */
function regionNode(region) {
  const properties = [];
  if (region.side !== region.id) {
    properties.push(property('side', [region.side]));
  }
  if (region.size !== null) {
    properties.push(property('size', [region.size]));
  }
  if (region.collapsed) {
    properties.push(property('collapsed', ['true']));
  }
  if (region.panels.length > 0) {
    properties.push(property('panels', region.panels));
  }
  if (region.active !== null && region.active !== region.panels[0]) {
    properties.push(property('active', [region.active]));
  }
  return {
    id: region.id,
    kind: 'region',
    positional: [],
    properties,
    unknown: [],
    children: [],
  };
}

const field = (name, value) =>
  new Link(null, [new Link(name), new Link(String(value))]);

function floatLink(f) {
  const values = [
    new Link('float'),
    new Link(f.panel),
    field('x', f.x),
    field('y', f.y),
    field('width', f.width),
    field('height', f.height),
  ];
  if (f.region !== null) {
    values.push(field('region', f.region));
  }
  return new Link(null, values);
}

const closedLink = (c) =>
  new Link(null, [
    new Link('closed'),
    new Link(c.panel),
    ...(c.region === null ? [] : [new Link(c.region)]),
  ]);

/**
 * Write a dock layout as Links Notation in the nested form: the dock line,
 * then one indented block per region, floating panel and closed panel.
 * @param {DockLayout} layout
 * @param {{ indent?: string }} [options]
 * @returns {string}
 */
export function dockLayoutToLino(layout, options = {}) {
  const dock = new Link(layout.id ?? null, [
    new Link('dock'),
    ...(layout.persist === null
      ? []
      : [new Link(null, [new Link('persist'), new Link(layout.persist)])]),
    ...layout.regions.map((region) => elementLink(regionNode(region))),
    ...layout.floating.map(floatLink),
    ...layout.closed.map(closedLink),
  ]);
  return formatLinks([dock], { indent: options.indent ?? '  ' });
}

/**
 * Where a panel is.
 * @param {DockLayout} layout
 * @param {string} panelId
 * @returns {{ place: 'region', region: DockRegion, index: number }
 *   | { place: 'floating', floating: FloatingPanel, index: number }
 *   | { place: 'closed', closed: ClosedPanel, index: number }
 *   | null}
 */
export function findPanel(layout, panelId) {
  for (const region of layout.regions) {
    const index = region.panels.indexOf(panelId);
    if (index >= 0) {
      return { place: 'region', region, index };
    }
  }
  const f = layout.floating.findIndex((x) => x.panel === panelId);
  if (f >= 0) {
    return { place: 'floating', floating: layout.floating[f], index: f };
  }
  const c = layout.closed.findIndex((x) => x.panel === panelId);
  if (c >= 0) {
    return { place: 'closed', closed: layout.closed[c], index: c };
  }
  return null;
}

/** Every panel of the layout: in regions, floating, then closed. */
export const panelIds = (layout) => [
  ...layout.regions.flatMap((r) => r.panels),
  ...layout.floating.map((f) => f.panel),
  ...layout.closed.map((c) => c.panel),
];

/** The panels that are open (in a region or floating). */
export const openPanelIds = (layout) => [
  ...layout.regions.flatMap((r) => r.panels),
  ...layout.floating.map((f) => f.panel),
];

function locate(layout, panelId, name) {
  const found = findPanel(layout, panelId);
  if (found === null) {
    throw new RangeError(`${name}: no panel "${panelId}"`);
  }
  return found;
}

/** The layout without the panel (a copy), and the region it left. */
function detach(layout, found) {
  if (found.place === 'region') {
    const regions = layout.regions.map((region) => {
      if (region !== found.region) {
        return region;
      }
      const panels = region.panels.filter((_, i) => i !== found.index);
      const active =
        region.active === region.panels[found.index]
          ? (panels[Math.min(found.index, panels.length - 1)] ?? null)
          : region.active;
      return { ...region, panels, active };
    });
    return { layout: { ...layout, regions }, from: found.region.id };
  }
  if (found.place === 'floating') {
    return {
      layout: {
        ...layout,
        floating: layout.floating.filter((_, i) => i !== found.index),
      },
      from: found.floating.region,
    };
  }
  return {
    layout: {
      ...layout,
      closed: layout.closed.filter((_, i) => i !== found.index),
    },
    from: found.closed.region,
  };
}

/** `{ region, index?, activate? }` of a move target. */
function targetOf(target) {
  if (typeof target === 'string') {
    return { region: target };
  }
  if (
    target === null ||
    typeof target !== 'object' ||
    typeof target.region !== 'string'
  ) {
    throw new TypeError(
      'movePanel: the target must be a region id or { region, index }'
    );
  }
  return target;
}

/** The layout with the panel inserted into a region (made when missing). */
function attach(layout, panelId, { region: regionId, index, activate }) {
  let regions = layout.regions;
  if (!regions.some((r) => r.id === regionId)) {
    const side = sideOf(regionId);
    if (!isSide(side)) {
      throw new RangeError(`movePanel: no region "${regionId}"`);
    }
    regions = [
      ...regions,
      {
        id: regionId,
        side,
        size: null,
        collapsed: false,
        panels: [],
        active: null,
      },
    ];
  }
  regions = regions.map((region) => {
    if (region.id !== regionId) {
      return region;
    }
    const panels = [...region.panels];
    const at =
      Number.isInteger(index) && index >= 0 && index <= panels.length
        ? index
        : panels.length;
    panels.splice(at, 0, panelId);
    const active =
      activate === true || region.active === null ? panelId : region.active;
    return { ...region, panels, active };
  });
  return { ...layout, regions };
}

/**
 * Move a panel to a region, as its last tab or at `index`. The panel may be
 * in another region, in the same one (a reorder), floating or closed. A
 * missing region named after a side (`top`) is made. The shown panel of
 * the target stays the same unless `activate` is true or it had none.
 * @param {DockLayout} layout
 * @param {string} panelId
 * @param {string|{ region: string, index?: number, activate?: boolean }} target
 * @returns {DockLayout}
 */
export function movePanel(layout, panelId, target) {
  const to = targetOf(target);
  const { layout: without } = detach(
    layout,
    locate(layout, panelId, 'movePanel')
  );
  return attach(without, panelId, to);
}

/**
 * Float a panel: it leaves its region (which it can return to) and gets a
 * position and size; a floating panel only gets the new rectangle.
 * @param {DockLayout} layout
 * @param {string} panelId
 * @param {{ x?: number, y?: number, width?: number, height?: number }} [rect]
 * @returns {DockLayout}
 */
export function floatPanel(layout, panelId, rect = {}) {
  const found = locate(layout, panelId, 'floatPanel');
  const { layout: without, from } = detach(layout, found);
  const previous = found.place === 'floating' ? found.floating : FLOAT_DEFAULTS;
  const pick = (name) =>
    Number.isFinite(rect[name]) ? rect[name] : previous[name];
  const entry = {
    panel: panelId,
    x: pick('x'),
    y: pick('y'),
    width: pick('width'),
    height: pick('height'),
    region: from ?? null,
  };
  const floating = [...without.floating];
  floating.splice(
    found.place === 'floating' ? found.index : floating.length,
    0,
    entry
  );
  return { ...without, floating };
}

/**
 * Close a panel; it remembers its region so `restorePanel` puts it back.
 * Closing a closed panel changes nothing.
 * @param {DockLayout} layout
 * @param {string} panelId
 * @returns {DockLayout}
 */
export function closePanel(layout, panelId) {
  const found = locate(layout, panelId, 'closePanel');
  if (found.place === 'closed') {
    return layout;
  }
  const { layout: without, from } = detach(layout, found);
  return {
    ...without,
    closed: [...without.closed, { panel: panelId, region: from ?? null }],
  };
}

/**
 * Restore a closed panel to the region it was closed in (or `target`), as
 * the shown tab. Without a known region it goes to the center.
 * @param {DockLayout} layout
 * @param {string} panelId
 * @param {string|{ region: string, index?: number }} [target]
 * @returns {DockLayout}
 */
export function restorePanel(layout, panelId, target) {
  const found = locate(layout, panelId, 'restorePanel');
  if (found.place !== 'closed') {
    return layout;
  }
  const fallback =
    found.closed.region ??
    layout.regions.find((r) => r.side === 'center')?.id ??
    'center';
  const to = target === undefined ? { region: fallback } : targetOf(target);
  return movePanel(layout, panelId, { ...to, activate: true });
}

/**
 * Show a panel of a region (its tab becomes the selected one).
 * @param {DockLayout} layout
 * @param {string} panelId
 * @returns {DockLayout}
 */
export function activatePanel(layout, panelId) {
  const found = locate(layout, panelId, 'activatePanel');
  if (found.place !== 'region' || found.region.active === panelId) {
    return layout;
  }
  return {
    ...layout,
    regions: layout.regions.map((r) =>
      r === found.region ? { ...r, active: panelId } : r
    ),
  };
}

/**
 * Change a region: its `size` (a CSS length) or `collapsed`.
 * @param {DockLayout} layout
 * @param {string} regionId
 * @param {{ size?: string|null, collapsed?: boolean }} change
 * @returns {DockLayout}
 */
export function updateRegion(layout, regionId, change) {
  if (!layout.regions.some((r) => r.id === regionId)) {
    throw new RangeError(`updateRegion: no region "${regionId}"`);
  }
  return {
    ...layout,
    regions: layout.regions.map((r) =>
      r.id === regionId
        ? {
            ...r,
            size: change.size === undefined ? r.size : change.size,
            collapsed:
              change.collapsed === undefined
                ? r.collapsed
                : change.collapsed === true,
          }
        : r
    ),
  };
}
