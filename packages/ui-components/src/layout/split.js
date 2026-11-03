/**
 * `split`: two or more panes with draggable dividers, after the WAI-ARIA
 * APG window splitter pattern.
 *
 *   (chat: split (direction row) (sizes 30 70) (min 20 40)
 *     (collapsible true false) (remember-size chat.split)
 *     (chat-list: stack ...) (chat-view: stack ...))
 *
 * Each divider is a focusable `role="separator"` whose `aria-valuenow` is
 * the size of the pane before it, in percent. The arrow keys move it by
 * 1 (10 with Shift), Home gives the pane its smallest size (it collapses
 * when it is collapsible), End its largest, and Enter collapses the pane
 * or restores it. A pointer drag moves it too (`setPointerCapture`).
 *
 * `sizes`, `min` and `max` are percentages, one value for every pane or one
 * per pane; `collapsible` likewise; `collapsed` names the panes that start
 * collapsed. With `remember-size KEY`, the sizes are kept as
 * `(sizes 30 70)` under KEY in the storage of the render options
 * (`options.layout.storage`, an object with `getItem` and `setItem`, such
 * as `localStorage`) and read back on the next render. Every change sends a
 * `split-resize` event with `detail.sizes`.
 */

import { defineKind } from '@link-foundation/ui-dom';
import { parseNested } from '@link-foundation/ui-core';
import { Link } from 'links-notation';
import { bindKeys } from '../a11y/keys.js';
import {
  atomOf,
  controllerOf,
  dropController,
  emit,
  findController,
  idOf,
  isLive,
  labelGroup,
  linkId,
  listOf,
  make,
  readStored,
  renderedChildren,
  storageOf,
  titleOf,
  valuesOf,
  watchChildren,
  writeStored,
} from './dom.js';
import {
  collapsePane,
  normalizeSizes,
  paneLimits,
  resizeSplit,
  restorePane,
} from './split-model.js';

const TOTAL = 100;
const STEP = 1;
const BIG_STEP = 10;

/** `row` (side by side, the default) or `column` (one above the other). */
const axisOf = (el) =>
  ['column', 'vertical'].includes(atomOf(el, 'direction')) ? 'column' : 'row';

/** The limits of the split model from the element. */
function limitsOf(el) {
  const number = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    min: listOf(el, 'min', number),
    max: listOf(el, 'max', number),
    collapsible: listOf(el, 'collapsible', (v) => v === 'true'),
  };
}

/** The `(sizes ...)` text of remembered sizes. */
export function sizesToLino(sizes) {
  const values = sizes.map((s) => new Link(String(Math.round(s * 100) / 100)));
  return new Link(null, [new Link('sizes'), ...values]).format();
}

/** The sizes of a `(sizes ...)` text; `null` when it is not one. */
export function sizesFromLino(text) {
  if (typeof text !== 'string' || text === '') {
    return null;
  }
  let links;
  try {
    links = parseNested(text);
  } catch {
    return null;
  }
  const values = links[0]?.values ?? [];
  if (values[0]?.id !== 'sizes') {
    return null;
  }
  const sizes = values.slice(1).map((v) => Number(v.id));
  return sizes.length > 0 && sizes.every(Number.isFinite) ? sizes : null;
}

/** The panes in the order of `(children ...)`, else in document order. */
function panesOf(node, el) {
  const panes = renderedChildren(node);
  const order = valuesOf(el, 'children');
  if (order.length === 0) {
    return panes;
  }
  const rank = (pane) => {
    const i = order.indexOf(linkId(pane));
    return i < 0 ? order.length : i;
  };
  return [...panes].sort((a, b) => rank(a) - rank(b));
}

/** The CSS track list of the panes and dividers. */
function templateOf(sizes) {
  return sizes
    .map((size) => `minmax(0, ${size}fr)`)
    .join(' var(--ui-split-divider-size, 8px) ');
}

/** The first sizes: remembered, else `sizes`, else equal; then collapsed. */
function initialSizes(state, count) {
  const remembered = sizesFromLino(readStored(state.storage, state.key));
  const given = valuesOf(state.el, 'sizes').map(Number);
  let sizes = normalizeSizes(
    remembered?.length === count ? remembered : given,
    count,
    TOTAL
  );
  if (remembered?.length !== count) {
    const collapsed = valuesOf(state.el, 'collapsed');
    state.panes.forEach((pane, i) => {
      if (collapsed.includes(linkId(pane)) || collapsed.includes(String(i))) {
        state.open[i] = sizes[i];
        sizes = collapsePane(sizes, i, state.limits);
      }
    });
  }
  return sizes;
}

/** Write the sizes to the grid, the panes and the dividers. */
function apply(node, state) {
  const { sizes, panes, dividers, limits } = state;
  // A row split puts its panes side by side: they are the grid columns.
  const tracks = state.axis === 'row' ? 'column' : 'row';
  const cross = state.axis === 'row' ? 'row' : 'column';
  node.style.setProperty(`grid-template-${tracks}s`, templateOf(sizes));
  node.style.setProperty(`grid-template-${cross}s`, 'minmax(0, 1fr)');
  node.setAttribute('data-direction', state.axis);
  panes.forEach((pane, i) => {
    pane.style.setProperty(`grid-${tracks}`, String(2 * i + 1));
    pane.style.setProperty(`grid-${cross}`, '1');
    pane.toggleAttribute('data-collapsed', sizes[i] === 0);
    pane.toggleAttribute('hidden', sizes[i] === 0);
  });
  dividers.forEach((divider, i) => {
    // The range of the divider: as far as the limits of both panes allow.
    const low = resizeSplit(sizes, i, -TOTAL, limits)[i];
    const high = resizeSplit(sizes, i, TOTAL, limits)[i];
    divider.style.setProperty(`grid-${tracks}`, String(2 * i + 2));
    divider.style.setProperty(`grid-${cross}`, '1');
    divider.setAttribute(
      'aria-orientation',
      state.axis === 'row' ? 'vertical' : 'horizontal'
    );
    divider.setAttribute('aria-valuenow', String(Math.round(sizes[i])));
    divider.setAttribute('aria-valuemin', String(Math.round(low)));
    divider.setAttribute('aria-valuemax', String(Math.round(high)));
    divider.setAttribute('aria-controls', idOf(panes[i], 'ui-split-pane'));
    divider.setAttribute('aria-label', `Resize ${titleOf(panes[i])}`);
  });
}

/** Set the sizes; `persist` saves them under the `remember-size` key. */
function setSizes(split, next, persist = true) {
  const { state, node } = split;
  if (next.every((s, i) => s === state.sizes[i])) {
    return;
  }
  next.forEach((size, i) => {
    if (state.sizes[i] > 0 && size === 0) {
      state.open[i] = state.sizes[i];
    }
  });
  state.sizes = next;
  apply(node, state);
  if (persist) {
    remember(state);
  }
  emit(node, 'split-resize', { sizes: [...next] });
}

function remember(state) {
  if (state.key !== undefined) {
    writeStored(state.storage, state.key, sizesToLino(state.sizes));
  }
}

/** Collapse pane `i`, or restore it when it is collapsed. */
function toggle(split, i) {
  const { sizes, limits, open } = split.state;
  if (sizes[i] === 0) {
    const size = open[i] ?? paneLimits(sizes, i, limits).min;
    setSizes(split, restorePane(sizes, i, size, limits));
  } else if (paneLimits(sizes, i, limits).collapsible) {
    setSizes(split, collapsePane(sizes, i, limits));
  }
}

/** Move divider `i` by `delta` percent. */
function moveBy(split, i, delta) {
  const { sizes, limits } = split.state;
  setSizes(split, resizeSplit(sizes, i, delta, limits));
}

/** Give pane `i` its smallest size; a collapsible pane collapses. */
function shrink(split, i) {
  const { sizes, limits } = split.state;
  const own = paneLimits(sizes, i, limits);
  setSizes(
    split,
    own.collapsible
      ? collapsePane(sizes, i, limits)
      : resizeSplit(sizes, i, own.min - sizes[i], limits)
  );
}

/** The keys of a divider (WAI-ARIA window splitter); `index()` is its index. */
function dividerKeys(split, index) {
  const keys = {
    Home: () => shrink(split, index()),
    End: () => moveBy(split, index(), TOTAL),
    Enter: () => toggle(split, index()),
  };
  for (const [key, sign] of [
    ['ArrowLeft', -1],
    ['ArrowUp', -1],
    ['ArrowRight', 1],
    ['ArrowDown', 1],
  ]) {
    keys[key] = () => moveBy(split, index(), sign * STEP);
    keys[`Shift+${key}`] = () => moveBy(split, index(), sign * BIG_STEP);
  }
  return keys;
}

function onPointerDown(split, event, i) {
  const { state, node } = split;
  if (event.button !== 0 || state.sizes.length < 2) {
    return;
  }
  const row = state.axis === 'row';
  const divider = state.dividers[i];
  divider.setPointerCapture?.(event.pointerId);
  const box = node.getBoundingClientRect();
  const dividers = state.dividers.reduce(
    (total, d) => total + d.getBoundingClientRect()[row ? 'width' : 'height'],
    0
  );
  state.drag = {
    index: i,
    pointer: event.pointerId,
    from: row ? event.clientX : event.clientY,
    sizes: [...state.sizes],
    length: Math.max(1, (row ? box.width : box.height) - dividers),
  };
  divider.focus();
  event.preventDefault();
}

/** The drag of the pointer of `event`, else `null`. */
const dragOf = (state, event) =>
  state.drag?.pointer === event.pointerId ? state.drag : null;

function onPointerMove(split, event) {
  const { state } = split;
  const drag = dragOf(state, event);
  if (drag === null) {
    return;
  }
  const at = state.axis === 'row' ? event.clientX : event.clientY;
  const delta = ((at - drag.from) / drag.length) * TOTAL;
  setSizes(
    split,
    resizeSplit(drag.sizes, drag.index, delta, state.limits),
    false
  );
}

function onPointerUp(split, event) {
  const { state } = split;
  const drag = dragOf(state, event);
  if (drag === null) {
    return;
  }
  state.dividers[drag.index].releasePointerCapture?.(event.pointerId);
  state.drag = null;
  remember(state);
}

function makeDivider(split) {
  const divider = make(split.document, 'div', {
    class: 'ui-split-divider',
    role: 'separator',
    tabindex: '0',
  });
  const index = () => split.state.dividers.indexOf(divider);
  const up = (e) => onPointerUp(split, e);
  bindKeys(divider, dividerKeys(split, index));
  divider.addEventListener('pointerdown', (e) =>
    onPointerDown(split, e, index())
  );
  divider.addEventListener('pointermove', (e) => onPointerMove(split, e));
  divider.addEventListener('pointerup', up);
  divider.addEventListener('pointercancel', up);
  divider.addEventListener('dblclick', () => toggle(split, index()));
  return divider;
}

/** Read the panes again: one divider between two, sizes when they change. */
function refresh(split) {
  const { state, node } = split;
  const panes = panesOf(node, state.el);
  const count = panes.length;
  const changed =
    count !== state.panes.length || panes.some((p, i) => p !== state.panes[i]);
  state.panes = panes;
  while (state.dividers.length < Math.max(0, count - 1)) {
    state.dividers.push(makeDivider(split));
  }
  while (state.dividers.length > Math.max(0, count - 1)) {
    state.dividers.pop().remove();
  }
  panes.forEach((pane, i) => {
    if (i < state.dividers.length) {
      node.insertBefore(state.dividers[i], pane.nextSibling);
    }
  });
  if (count === 0) {
    return;
  }
  if (changed && state.sizes.length !== count) {
    state.open = [];
    state.sizes = count === 1 ? [TOTAL] : initialSizes(state, count);
  }
  apply(node, state);
}

/** Make a split controller for a live node. */
function createSplit(node, ctx) {
  const state = {
    el: null,
    axis: 'row',
    limits: {},
    key: undefined,
    storage: storageOf(ctx),
    panes: [],
    dividers: [],
    sizes: [],
    open: [],
    drag: null,
  };
  const split = { node, document: ctx.document, state };
  const observer = watchChildren(node, () => refresh(split));
  return {
    state,
    refresh: () => refresh(split),
    setSizes: (next, persist) => setSizes(split, next, persist),
    update(el, changed) {
      state.el = el;
      state.axis = axisOf(el);
      state.limits = limitsOf(el);
      state.key = atomOf(el, 'remember-size');
      if (changed.includes('sizes') && state.panes.length > 1) {
        const given = valuesOf(el, 'sizes').map(Number);
        state.sizes = normalizeSizes(given, state.panes.length, TOTAL);
      }
      refresh(split);
      observer.takeRecords();
    },
    disconnect: () => observer.disconnect(),
  };
}

/** The static form (ui-dom `renderToHTML`): the grid of the given sizes. */
function updateStatic(node, el) {
  const sizes = valuesOf(el, 'sizes').map(Number);
  const axis = axisOf(el);
  node.setAttribute('data-direction', axis);
  if (sizes.length > 1) {
    const valid = normalizeSizes(sizes, sizes.length, TOTAL);
    node.style.setProperty(
      axis === 'row' ? 'grid-template-columns' : 'grid-template-rows',
      valid.map((s) => `minmax(0, ${s}fr)`).join(' ')
    );
  }
}

defineKind('split', {
  tag: 'ui-split',
  create: (el, ctx) => ctx.document.createElement('ui-split'),
  update(node, el, changed, ctx) {
    if (changed.includes('label')) {
      labelGroup(node, el);
    }
    if (!isLive(ctx)) {
      updateStatic(node, el);
      return;
    }
    controllerOf(node, () => createSplit(node, ctx)).update(el, changed);
  },
  destroy: (node) => dropController(node),
});

/** The current sizes of a rendered split (for tests and tools). */
export const splitSizes = (node) => [
  ...(findController(node)?.state.sizes ?? []),
];
