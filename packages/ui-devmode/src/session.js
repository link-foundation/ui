/**
 * An open dev mode: the overlay, the inspector and the wiring between them,
 * the page and the configuration. `index.js` loads this module with a
 * dynamic `import()` only when dev mode opens, so a page whose policy
 * disables dev mode never downloads it (nor the inspector, the overlay and
 * the model it imports).
 */

import { defaultVocabulary, parse } from '@link-foundation/ui-core';
import { readStyles } from '@link-foundation/ui-style';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import {
  ancestorsOf,
  animationsOf,
  matchingStyles,
  sourceOf,
  tokensUsed,
} from './details.js';
import { createInspector, loadLayout } from './inspector.js';
import {
  applyEdit,
  buildOutline,
  DevModeError,
  discardSession,
  isLocked,
  propertyRows,
  resetProperty,
  saveSession,
  topWritableLayer,
} from './model.js';
import { createOverlay } from './overlay.js';
import {
  renderAnimations,
  renderEmpty,
  renderOutline,
  renderProperties,
  renderSource,
  renderStyles,
  renderTokens,
} from './views.js';

/** The events pick mode takes from the page (the app never sees them). */
const PICK_EVENTS = [
  'pointerdown',
  'mousedown',
  'pointerup',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
];

/**
 * The tree of the document read from the effective configuration, for a
 * page that passes no ui-store store. Same shape as a store.
 */
export function documentTree(config) {
  let doc = null;
  const parents = new Map();
  const load = () => {
    if (doc === null) {
      doc = config.effective();
      parents.clear();
      const walk = (node, parent) => {
        parents.set(node.id, parent);
        (node.children ?? []).forEach((child) => walk(child, node.id));
      };
      doc.roots.forEach((node) => walk(node, null));
    }
    return doc;
  };
  return {
    get: (id) => load().byId.get(id),
    roots: () => load().roots.map((node) => node.id),
    children: (id) =>
      (load().byId.get(id)?.children ?? []).map((node) => node.id),
    parentOf: (id) => (load(), parents.get(id) ?? null),
    toDocument: load,
    subscribe: (listener) =>
      config.subscribe((...args) => {
        doc = null;
        listener(...args);
      }),
  };
}

/** The `theme` atom of the first root element, if any. */
function themeOf(tree) {
  const [first] = tree.roots();
  const property = tree.get(first)?.properties?.find((p) => p.name === 'theme');
  const value = property?.values?.[0];
  return typeof value === 'string' ? value : undefined;
}

/** The resolved tokens: a ui-tokens map, or tokens.lino text. */
function readTokenMap(tokens, theme) {
  if (tokens instanceof Map) {
    return tokens;
  }
  if (typeof tokens !== 'string') {
    return new Map();
  }
  const { sets } = readTokens(tokens);
  const setId = [theme].find((id) => sets.has(id)) ?? [...sets.keys()][0];
  return setId === undefined ? new Map() : resolveTokens(sets, setId);
}

/** The animation nodes: of the document and of the `animations` option. */
function animationNodes(tree, animations) {
  const extra =
    typeof animations === 'string'
      ? parse(animations).roots
      : (animations ?? []);
  const own = [];
  const walk = (node) => {
    if (node.kind === 'animation') {
      own.push(node);
    }
    (node.children ?? []).forEach(walk);
  };
  tree.toDocument().roots.forEach(walk);
  return [...own, ...extra];
}

/** The source nodes of the read-only tabs (styles, tokens, animations). */
function readSources(options, tree) {
  const theme = options.theme ?? themeOf(tree);
  return {
    rules:
      typeof options.styles === 'string'
        ? readStyles(options.styles).rules
        : (options.styles ?? []),
    tokens: readTokenMap(options.tokens, theme),
    animations: () => animationNodes(tree, options.animations),
  };
}

/** The token value of the configuration: a `(token path …)` of a theme. */
function tokenOverride(config, tree) {
  const themes = [];
  const walk = (id) => {
    if (tree.get(id)?.kind === 'theme') {
      themes.push(id);
    }
    tree.children(id).forEach(walk);
  };
  tree.roots().forEach(walk);
  return (path) => {
    for (const id of themes) {
      const found = config.resolve(id, 'token', path);
      if (found?.value !== undefined) {
        return found;
      }
    }
    return undefined;
  };
}

/** The `[data-link-id]` element of an event inside the root, if any. */
function pickedNode(event, root) {
  const path = event.composedPath?.() ?? [event.target];
  for (const node of path) {
    if (
      node?.nodeType === 1 &&
      node.hasAttribute('data-link-id') &&
      root.contains(node)
    ) {
      return node;
    }
  }
  return null;
}

/** The views of the selection: the property grid and the read-only tabs. */
function renderDetails(ctx, id) {
  const { tree, inspector, t, sources } = ctx;
  const rows = ctx.renderGrid(id);
  const styles = matchingStyles(
    tree.get(id),
    ancestorsOf(id, tree),
    sources.rules
  );
  const animations = animationsOf(id, sources.animations());
  const tokens = tokensUsed(
    { rows, styles, animations },
    sources.tokens,
    sources.overrideOf
  );
  renderStyles(inspector.panel('styles'), { id, styles }, { t });
  renderTokens(inspector.panel('tokens'), { id, tokens }, { t });
  renderAnimations(inspector.panel('animations'), { id, animations }, { t });
  const node = tree.toDocument().byId.get(id);
  const source = node ? sourceOf(node) : '';
  renderSource(inspector.panel('source'), { id, source }, { t });
}

const DETAIL_VIEWS = ['properties', 'styles', 'tokens', 'animations', 'source'];

/** The property grid, rebuilt only when its rows change. */
function gridRenderer(ctx) {
  let grid = null;
  let gridKey = '';
  const { config, policy, inspector, t } = ctx;
  const edit = (row, value) => {
    try {
      ctx.applyRow(ctx.state.selected, row, value);
      return null;
    } catch (error) {
      if (error instanceof DevModeError) {
        inspector.announce(t('status.error', { message: error.message }));
        return error.message;
      }
      throw error;
    }
  };
  const reset = (row) => {
    const { name, key, label } = row;
    const layer = resetProperty(
      config,
      { id: ctx.state.selected, name, key },
      { policy }
    );
    inspector.announce(
      layer
        ? t('status.reset', { name: label, layer })
        : t('status.nothing', { name: label })
    );
  };
  return {
    clear() {
      grid = null;
      gridKey = '';
    },
    render(id) {
      const rows = ctx.rowsOf(id);
      const key = `${id} ${rows.map((r) => `${r.name}/${r.key ?? ''}`).join(' ')}`;
      if (grid && gridKey === key) {
        grid.update(rows);
        return rows;
      }
      gridKey = key;
      grid = renderProperties(
        inspector.panel('properties'),
        {
          id,
          rows,
          locked: isLocked(policy, id, ctx.parentOf),
          writable: policy.writeLayers.length > 0,
          tokenPaths: [...ctx.sources.tokens.keys()],
        },
        { t, onEdit: edit, onReset: reset }
      );
      return rows;
    },
  };
}

/** The outline, the selection and the refresh after a change. */
function selectionController(ctx) {
  const { tree, inspector, overlay, t, state } = ctx;
  let outlineKey = '';
  let outline = null;
  const grid = gridRenderer(ctx);
  ctx.renderGrid = grid.render;
  const renderViews = () => {
    const id = state.selected;
    if (id === null) {
      grid.clear();
      DETAIL_VIEWS.forEach((view) => renderEmpty(inspector.panel(view), { t }));
    } else {
      renderDetails(ctx, id);
    }
  };
  const renderTree = () => {
    const next = buildOutline(tree);
    const key = JSON.stringify(next);
    if (key !== outlineKey) {
      outlineKey = key;
      outline = renderOutline(inspector.panel('outline'), next, {
        t,
        onSelect: (id) => select(id),
      });
    }
    outline.select(state.selected);
  };
  const showSelection = () => {
    const id = state.selected;
    overlay.show('selected', ctx.target(id));
    inspector.setSelection(
      id === null
        ? t('selection.none')
        : t('selection.current', { id, type: ctx.typeOf(id) })
    );
  };
  function select(id) {
    state.selected =
      id !== null && id !== undefined && tree.get(id) ? id : null;
    outline.select(state.selected);
    showSelection();
    renderViews();
    return state.selected;
  }
  const refresh = () => {
    renderTree();
    if (state.selected !== null && !tree.get(state.selected)) {
      select(null);
      return;
    }
    if (state.selected !== null) {
      renderDetails(ctx, state.selected);
    }
    showSelection();
    overlay.update();
  };
  return { renderTree, select, refresh };
}

/**
 * Pick mode: hovering the page highlights the element under the pointer,
 * a click selects it; the pointer events of a pick never reach the app.
 */
function installPicking(ctx, listen, select) {
  const { window, root, inspector, overlay, state } = ctx;
  const own = (event) =>
    inspector.contains(event) ||
    (event.composedPath?.() ?? []).includes(overlay.host);
  listen(
    window,
    'pointermove',
    (event) => {
      if (state.picking && !own(event)) {
        const node = pickedNode(event, root);
        const id = node?.getAttribute('data-link-id') ?? null;
        overlay.show('hover', ctx.target(id));
      }
    },
    true
  );
  for (const type of PICK_EVENTS) {
    listen(
      window,
      type,
      (event) => {
        const node =
          state.picking && !own(event) ? pickedNode(event, root) : null;
        if (node === null) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (type === 'click') {
          select(node.getAttribute('data-link-id'));
        }
      },
      true
    );
  }
}

/** The shared state and helpers of an open dev mode. */
async function createContext(options) {
  const { window, root, config, policy } = options;
  const tree = options.store ?? documentTree(config);
  const vocabulary = options.vocabulary ?? defaultVocabulary();
  const parentOf = (id) => tree.parentOf(id);
  const modelOptions = {
    policy,
    vocabulary,
    parentOf,
    getElement: (id) => tree.get(id),
  };
  const editLayer = policy.writeLayers.includes('session')
    ? 'session'
    : topWritableLayer(policy);
  const typeOf = (id) => tree.get(id)?.kind ?? '';
  const nodeFor = (id) =>
    options.handle?.nodeFor?.(id) ??
    [...root.querySelectorAll('[data-link-id]')].find(
      (node) => node.getAttribute('data-link-id') === id
    ) ??
    null;
  const rowsOf = (id) =>
    tree.get(id) ? propertyRows(tree.get(id), config, modelOptions) : [];
  return {
    ...options,
    layout: options.layout ?? (await loadLayout()),
    tree,
    parentOf,
    typeOf,
    rowsOf,
    sources: {
      ...readSources(options, tree),
      overrideOf: tokenOverride(config, tree),
    },
    state: { selected: null, picking: false, closed: false },
    target(id) {
      const node = id === null ? null : nodeFor(id);
      return node ? { node, id, type: typeOf(id) } : null;
    },
    /** Write a property of the grid (a row, or a name) to the session. */
    applyRow(id, row, value) {
      return applyEdit(
        config,
        { id, name: row.name, key: row.key ?? null, value, layer: editLayer },
        modelOptions
      );
    },
    nameRow: (id, name) =>
      rowsOf(id).find((r) => r.label === name || r.name === name) ?? {
        name,
        key: null,
      },
    restoreFocus: window.document.activeElement,
  };
}

/** The toolbar commands. */
function commandsOf(ctx, close) {
  const { config, policy, inspector, t } = ctx;
  return {
    pick: () => ctx.setPicking(!ctx.state.picking),
    save() {
      const count = saveSession(config, { policy });
      inspector.announce(t('status.saved', { count }));
    },
    discard() {
      const count = discardSession(config);
      inspector.announce(t('status.discarded', { count }));
    },
    close,
  };
}

/**
 * Open dev mode over a rendered page.
 * @param {{ window: Window & typeof globalThis, root: Element,
 *   config: object, policy: import('./policy.js').DevModePolicy,
 *   store?: object, handle?: { nodeFor?: (id: string) => Element|null },
 *   styles?: string|object[], tokens?: string|Map<string, object>,
 *   theme?: string, animations?: string|object[], vocabulary?: object,
 *   layout?: string, t: (key: string, params?: object) => string,
 *   onClose?: () => void }} options
 * @returns {Promise<DevModeSession>}
 *
 * @typedef {object} DevModeSession
 * @property {(id: string|null) => string|null} select
 * @property {() => { id: string, type: string }|null} getSelection
 * @property {(id: string, name: string, value: unknown) => object} setProperty
 * @property {(picking: boolean) => void} setPicking
 * @property {() => boolean} isPicking
 * @property {() => void} close
 */
export async function openSession(options) {
  const ctx = await createContext(options);
  const { window, config, policy, t, state } = ctx;
  const cleanups = [];
  const listen = (target, type, listener, capture = false) => {
    target.addEventListener(type, listener, capture);
    cleanups.push(() => target.removeEventListener(type, listener, capture));
  };
  let commands = {};
  ctx.overlay = createOverlay({
    document: window.document,
    label: (id, type) => t('overlay.label', { id, type }),
  });
  ctx.inspector = createInspector({
    window,
    layout: ctx.layout,
    t,
    onCommand: (command) => commands[command]?.(),
  });
  const { inspector, overlay } = ctx;
  const view = selectionController(ctx);
  ctx.setPicking = (picking) => {
    state.picking = Boolean(picking);
    inspector.setPressed('pick', state.picking);
    if (!state.picking) {
      overlay.show('hover', null);
    }
    inspector.announce(state.picking ? t('selection.picking') : '');
  };

  // Changes of the store or the configuration, scrolling and resizing are
  // coalesced to one update per frame.
  let frame = null;
  const raf =
    window.requestAnimationFrame?.bind(window) ??
    ((callback) => window.setTimeout(callback, 16));
  const schedule = () => {
    frame ??= raf(() => {
      frame = null;
      if (!state.closed) {
        view.refresh();
      }
    });
  };
  const reposition = () => overlay.update();

  const close = () => {
    if (state.closed) {
      return;
    }
    state.closed = true;
    cleanups.splice(0).forEach((cleanup) => cleanup());
    inspector.destroy();
    overlay.destroy();
    if (ctx.restoreFocus?.isConnected) {
      ctx.restoreFocus.focus?.();
    }
    options.onClose?.();
  };
  commands = commandsOf(ctx, close);
  if (!policy.writeLayers.includes('user')) {
    inspector.setDisabled('save', true);
  }
  if (!policy.writeLayers.includes('session')) {
    inspector.setDisabled('discard', true);
  }

  installPicking(ctx, listen, view.select);
  listen(
    window,
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        if (state.picking) {
          ctx.setPicking(false);
        } else {
          close();
        }
      }
    },
    true
  );
  listen(window, 'scroll', reposition, true);
  listen(window, 'resize', reposition);
  cleanups.push(config.subscribe(schedule));
  if (options.store?.subscribe) {
    cleanups.push(options.store.subscribe(schedule));
  }
  if (window.ResizeObserver) {
    const observer = new window.ResizeObserver(reposition);
    observer.observe(ctx.root);
    cleanups.push(() => observer.disconnect());
  }
  cleanups.push(() => frame !== null && window.cancelAnimationFrame?.(frame));

  view.renderTree();
  inspector.showView('outline');
  view.select(null);
  ctx.setPicking(true);

  return {
    select: (id) => view.select(id ?? null),
    getSelection: () =>
      state.selected === null
        ? null
        : { id: state.selected, type: ctx.typeOf(state.selected) },
    setProperty: (id, name, value) =>
      ctx.applyRow(id, ctx.nameRow(id, name), value),
    setPicking: ctx.setPicking,
    isPicking: () => state.picking,
    close,
  };
}
