import { defineKind } from '@link-foundation/ui-dom';
import { createAnimator } from './animator.js';
import { createZoomPan } from './zoom-pan.js';
import { buildNetwork, networkIds, networkInput } from './network-model.js';
import { circle } from './layouts/circle.js';
import { NETWORK_LAYOUTS } from './layouts/index.js';
import { createLayoutRunner } from './create-layout-runner.js';
import { drawNetwork, networkStyle } from './network-renderer.js';
import {
  connectNetworkInteraction,
  selectNetwork,
} from './network-interaction.js';
import {
  storeNetworkLink,
  storeNetworkLinks,
  readNetworkSource,
  readNetworkRaw,
  networkRaw,
} from './network-source.js';
import { networkToSvg, networkToPng } from './export.js';

export const LINKS_NETWORK_TAG = 'links-network';

const CSS = `:host { display:block; position:relative; width:640px; height:400px; overflow:hidden; touch-action:none; contain:content; }
:host(:focus-visible) { outline:2px solid var(--color-link-focus, currentColor); outline-offset:2px; }
.surface, svg, canvas { width:100%; height:100%; display:block; }
.status { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
:host([hidden]) { display:none; }`;

function makeState(node, win, options) {
  const root = node.attachShadow({ mode: 'open' });
  const style = win.document.createElement('style');
  style.textContent = CSS;
  const surface = win.document.createElement('div');
  surface.className = 'surface';
  const status = win.document.createElement('div');
  status.className = 'status';
  status.setAttribute('role', 'status');
  root.append(style, surface, status);
  return {
    win,
    options,
    surface,
    status,
    network: buildNetwork([]),
    positions: new Map(),
    pins: new Map(),
    selected: new Set(),
    focused: null,
    hovered: null,
    drag: null,
    shapes: new Map(),
    shapesDirty: true,
    resetSurface: true,
    colors: new Map(),
    config: { layout: 'circle', style: 'glyph', minZoom: 0.6 },
    cleanup: [],
    store: null,
    unsubscribe: null,
    animator: null,
    runner: null,
    zoom: null,
    drawn: null,
    diagnostics: [],
    ready: Promise.resolve(),
  };
}

function updateNetwork(node, state, links, preserve = false) {
  state.network = buildNetwork(links);
  const ids = new Set(networkIds(state.network));
  if (!preserve) {
    state.positions.clear();
  }
  for (const id of state.positions.keys()) {
    if (!ids.has(id)) {
      state.positions.delete(id);
      state.pins.delete(id);
      state.selected.delete(id);
    }
  }
  // New vertices are placed without moving existing ones, then an explicit
  // layout change can rearrange the complete network in a worker.
  const initial = circle(state.network, {
    width: node.clientWidth || 640,
    height: node.clientHeight || 400,
  });
  for (const id of ids) {
    if (!state.positions.has(id)) {
      state.positions.set(id, initial.get(id));
    }
  }
  for (const collection of [state.pins, state.selected]) {
    for (const id of collection.keys()) {
      if (!ids.has(id)) {
        collection.delete(id);
      }
    }
  }
  if (!ids.has(state.focused)) {
    state.focused = null;
  }
  state.shapesDirty = true;
  node.requestDraw();
}

function subscribeNetwork(node, state) {
  state.unsubscribe?.();
  state.unsubscribe = null;
  if (!node.isConnected || !state.store) {
    return;
  }
  state.unsubscribe = state.store.subscribe((events) => {
    const links = new Map(state.network.links);
    for (const event of events) {
      if (event.type === 'rename') {
        links.delete(event.before);
      }
      const link = storeNetworkLink(state.store, event.id);
      if (link) {
        links.set(event.id, link);
      } else {
        links.delete(event.id);
      }
    }
    state.runner?.cancel('layout');
    updateNetwork(node, state, links.values(), true);
  });
}

function requestLayout(node, state) {
  if (!state.animator) {
    return Promise.resolve();
  }
  const layout = node.getAttribute('layout') ?? state.config.layout;
  const job = {
    layout,
    links: networkInput(state.network),
    options: {
      width: node.clientWidth || 640,
      height: node.clientHeight || 400,
      pins: [...state.pins],
    },
  };
  const apply = (result) => {
    state.diagnostics = state.diagnostics.filter((d) => d.code);
    state.positions = result.positions;
    for (const [id, point] of state.pins) {
      if (state.positions.has(id)) {
        state.positions.set(id, point);
      }
    }
    state.shapesDirty = true;
    node.requestDraw();
    node.dispatchEvent(
      new state.win.CustomEvent('layoutend', { detail: { layout } })
    );
  };
  const task = !Object.hasOwn(NETWORK_LAYOUTS, layout)
    ? Promise.reject(new TypeError(`Unknown layout: ${layout}`))
    : state.runner
      ? state.runner.run('layout', job)
      : Promise.resolve().then(() => ({
          positions: NETWORK_LAYOUTS[layout](state.network, job.options),
        }));
  state.ready = task.then(apply).catch((error) => {
    if (error.name === 'AbortError') {
      return;
    }
    state.diagnostics = [{ severity: 'error', message: error.message }];
    node.dispatchEvent(
      new state.win.CustomEvent('layouterror', { detail: error })
    );
    throw error;
  });
  // Attribute changes also start jobs; report failures via layouterror and
  // diagnostics even if the caller does not await `ready`.
  state.ready.catch(() => {});
  return state.ready;
}

function connectNetwork(node, state) {
  if (state.animator) {
    return;
  }
  node.setAttribute('role', 'application');
  node.setAttribute('tabindex', '0');
  node.setAttribute(
    'aria-label',
    node.getAttribute('label') ?? 'Links network'
  );
  node.setAttribute(
    'aria-keyshortcuts',
    'ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape Home + - 0 Shift+F10 Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'
  );
  const listen = (target, type, fn) => {
    target.addEventListener(type, fn);
    state.cleanup.push(() => target.removeEventListener(type, fn));
  };
  state.animator = createAnimator({
    raf: (fn) => state.win.requestAnimationFrame(fn),
    caf: (id) => state.win.cancelAnimationFrame(id),
    reducedMotion: () =>
      state.win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ===
      true,
    ...state.options.animator,
  });
  connectNetworkInteraction(node, state, listen);
  state.zoom = createZoomPan(node, { onChange: () => node.requestDraw() });
  if (state.options.createWorker || state.win.Worker) {
    state.runner = createLayoutRunner({
      createWorker:
        state.options.createWorker ??
        (() =>
          new state.win.Worker(
            new globalThis.URL(
              '../../dist/network-layout.worker.mjs',
              import.meta.url
            ),
            { type: 'module' }
          )),
    });
  }
  if (state.win.ResizeObserver) {
    const observer = new state.win.ResizeObserver(() => node.requestDraw());
    observer.observe(node);
    state.cleanup.push(() => observer.disconnect());
  }
  const scheme = state.win.matchMedia?.('(prefers-color-scheme: dark)');
  if (scheme?.addEventListener) {
    listen(scheme, 'change', () => {
      state.resetSurface = true;
      node.requestDraw();
    });
  }
  if (state.store) {
    updateNetwork(node, state, storeNetworkLinks(state.store));
    subscribeNetwork(node, state);
  } else if (node.hasAttribute('lino') || node.textContent.trim()) {
    readSource(node, state);
  }
  requestLayout(node, state);
}

function readSource(node, state) {
  const read = readNetworkSource(node.getAttribute('lino') ?? node.textContent);
  state.config = read;
  state.diagnostics = read.diagnostics;
  updateNetwork(node, state, read.links);
}

/** Explicit definition; importing the package is safe without a DOM. */
export function defineLinksNetwork(win = globalThis.window, options = {}) {
  const tag = options.tag ?? LINKS_NETWORK_TAG;
  if (win.customElements.get(tag)) {
    return win.customElements.get(tag);
  }
  class LinksNetwork extends win.HTMLElement {
    #state;
    static get observedAttributes() {
      return ['lino', 'layout', 'style-mode', 'theme', 'label'];
    }
    constructor() {
      super();
      this.#state = makeState(this, win, options);
    }
    connectedCallback() {
      connectNetwork(this, this.#state);
    }
    disconnectedCallback() {
      const s = this.#state;
      s.unsubscribe?.();
      s.unsubscribe = null;
      s.runner?.dispose();
      s.runner = null;
      s.zoom?.destroy();
      s.zoom = null;
      s.animator?.destroy();
      s.animator = null;
      s.cleanup.forEach((fn) => fn());
      s.cleanup = [];
    }
    attributeChangedCallback(name) {
      const s = this.#state;
      if (!this.isConnected) {
        return;
      }
      if (name === 'lino') {
        readSource(this, s);
      }
      s.resetSurface = true;
      s.shapesDirty = true;
      if (name === 'layout' || name === 'lino') {
        requestLayout(this, s);
      } else {
        this.requestDraw();
      }
    }
    get items() {
      return [...this.#state.network.links.values()];
    }
    set items(links) {
      updateNetwork(this, this.#state, links);
      requestLayout(this, this.#state);
    }
    get store() {
      return this.#state.store;
    }
    set store(store) {
      const s = this.#state;
      s.unsubscribe?.();
      s.store = store;
      updateNetwork(this, s, store ? storeNetworkLinks(store) : []);
      subscribeNetwork(this, s);
      requestLayout(this, s);
    }
    set links(value) {
      const s = this.#state;
      s.config = readNetworkRaw(value.raw);
      updateNetwork(this, s, s.config.links);
      requestLayout(this, s);
    }
    get network() {
      return this.#state.network;
    }
    get positions() {
      return new Map(this.#state.positions);
    }
    set positions(positions) {
      this.#state.positions = new Map(positions);
      this.#state.shapesDirty = true;
      this.requestDraw();
    }
    get pins() {
      return new Map(this.#state.pins);
    }
    get selection() {
      return [...this.#state.selected];
    }
    select(id, additive = false) {
      selectNetwork(this, this.#state, id, additive);
    }
    get ready() {
      return this.#state.ready;
    }
    get diagnostics() {
      return [...this.#state.diagnostics];
    }
    get view() {
      return this.#state.zoom?.get() ?? { x: 0, y: 0, k: 1 };
    }
    set view(view) {
      this.#state.zoom?.set(view);
    }
    get drawn() {
      return this.#state.drawn;
    }
    layout() {
      return requestLayout(this, this.#state);
    }
    requestDraw() {
      this.#state.animator?.start('draw', () => {
        drawNetwork(this, this.#state);
        return false;
      });
    }
    toSvg() {
      return networkToSvg(
        this.#state.network,
        this.#state.positions,
        networkStyle(this, this.#state)
      );
    }
    toPng(scale = 1) {
      return networkToPng(this.toSvg(), scale);
    }
  }
  win.customElements.define(tag, LinksNetwork);
  return LinksNetwork;
}

export function linksNetworkKind({ tag = LINKS_NETWORK_TAG } = {}) {
  const update = (node, el, ctx) => {
    node.links = { raw: networkRaw(el, ctx.children?.() ?? []) };
    const store = ctx.options?.networkStore;
    if (store?.subscribe) {
      node.store = store;
    }
  };
  return {
    tag,
    childrenSlot: null,
    create(el, ctx) {
      const node = ctx.document.createElement(tag);
      update(node, el, ctx);
      return node;
    },
    update: (node, el, changed, ctx) => update(node, el, ctx),
  };
}

export function registerLinksNetworkKind(
  win = globalThis.window,
  options = {}
) {
  defineLinksNetwork(win, options);
  return defineKind('links-network', linksNetworkKind(options));
}
