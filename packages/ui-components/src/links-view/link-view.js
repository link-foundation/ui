/**
 * The `link-view` custom element: one link drawn from Links Notation, as SVG
 * (default) or on a canvas, with its own zoom and pan, keyboard zoom
 * (`+`, `-`, `0` to reset, arrows to pan) and an accessible name such as
 * "Link 1 from 1 to 2".
 *
 * ```html
 * <link-view>(simple: link-view (link (id 1) (source 1) (target 2))
 *   (markers (source bar) (target arrow)) (blueprint true) (grid true))</link-view>
 * ```
 *
 * The class is made inside `defineLinkView(win)`, because `HTMLElement`
 * only exists in a window; the module itself holds no state. A redraw is
 * requested through the animator, so changes in one frame draw once, and
 * nothing runs while nothing changes.
 */

import { defineKind } from '@link-foundation/ui-dom';
import { createAnimator } from './animator.js';
import { linkGeometry } from './geometry.js';
import { accessibleName, parseLinkView, readLinkView } from './model.js';
import { drawLinkCanvas } from './render-canvas.js';
import { drawnMarkers, renderLinkSvg } from './render-svg.js';
import { GRID_SPACING, buildScene, fitView, sceneBounds } from './scene.js';
import { colorVariables, linkColors } from './tokens.js';
import { createZoomPan } from './zoom-pan.js';

/** The default tag name. */
export const LINK_VIEW_TAG = 'link-view';

/** The zoom factor of one `+` or `-` key press. */
export const KEY_ZOOM_STEP = 1.25;

/** The pan step of one arrow key press, in CSS pixels. */
export const KEY_PAN_STEP = 20;

/** The size drawn when the element has no layout size (no CSS, jsdom). */
export const FALLBACK_SIZE = Object.freeze({ width: 320, height: 200 });

/** The attributes that change what is drawn. */
export const LINK_VIEW_ATTRIBUTES = Object.freeze([
  'lino',
  'renderer',
  'theme',
  'blueprint',
  'grid',
  'bend',
  'label',
]);

const STYLE = `:host {
  display: inline-block;
  position: relative;
  width: 320px;
  height: 200px;
  overflow: hidden;
  touch-action: none;
  border-radius: 4px;
  outline: none;
  contain: content;
}
:host([hidden]) { display: none; }
:host(:focus-visible) {
  outline: 2px solid var(${colorVariables().focus}, currentColor);
  outline-offset: 2px;
}
.surface { position: absolute; inset: 0; }
.surface > svg, .surface > canvas { display: block; width: 100%; height: 100%; }`;

/**
 * The world geometry of a link view: the source and target eight half
 * steps apart around the origin (links-visuals), or a self-loop.
 * @param {import('./model.js').LinkViewModel} model
 * @param {{gridSpacing?: number}} [options]
 */
export function linkViewGeometry(model, { gridSpacing = GRID_SPACING } = {}) {
  const half = 4 * gridSpacing;
  if (model.selfLoop) {
    const radius = 2 * gridSpacing;
    return linkGeometry({
      source: { x: 0, y: 1.3 * radius },
      selfLoop: true,
      loopRadius: radius,
    });
  }
  return linkGeometry({
    source: { x: -half, y: 0 },
    target: { x: half, y: 0 },
    bend: model.bend,
  });
}

/** A boolean attribute: absent → `fallback`, `false` → false, else true. */
function booleanAttribute(node, name, fallback) {
  const value = node.getAttribute(name);
  if (value === null) {
    return fallback;
  }
  return value !== 'false';
}

/**
 * The model with the attribute overrides (`blueprint`, `grid`, `bend`,
 * `label`) applied.
 */
function withAttributes(node, model) {
  const bend = Number(node.getAttribute('bend'));
  return {
    ...model,
    blueprint: booleanAttribute(node, 'blueprint', model.blueprint),
    grid: booleanAttribute(node, 'grid', model.grid),
    bend:
      node.getAttribute('bend') !== null && Number.isFinite(bend)
        ? bend
        : model.bend,
    label: node.getAttribute('label') ?? model.label,
  };
}

/**
 * The colours of an element: the `link-view` tokens in its colour scheme,
 * then any `--color-link-*` custom property set on the page.
 * @param {HTMLElement} node
 * @param {Window} win
 * @param {(mode: 'light'|'dark') => Readonly<Record<string, string>>}
 *   tokenColors  the token colours of a mode
 */
function elementColors(node, win, tokenColors) {
  const theme = node.getAttribute('theme');
  const dark =
    theme === 'dark' ||
    (theme !== 'light' &&
      win.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true);
  const colors = { ...tokenColors(dark ? 'dark' : 'light') };
  const computed = win.getComputedStyle?.(node);
  for (const [role, name] of Object.entries(colorVariables())) {
    const value = computed?.getPropertyValue(name)?.trim();
    if (value) {
      colors[role] = value;
    }
  }
  return colors;
}

/** The token colours of a mode, read once per element. */
function colorsOf(state, mode) {
  if (!state.tokenColors.has(mode)) {
    state.tokenColors.set(
      mode,
      linkColors({ mode: mode === 'dark' ? 'dark' : null })
    );
  }
  return state.tokenColors.get(mode);
}

/** The key bindings: zoom with `+`/`-`, reset with `0`, pan with arrows. */
function keyAction(zoom, key) {
  const actions = {
    '+': () => zoom.zoomBy(KEY_ZOOM_STEP),
    '=': () => zoom.zoomBy(KEY_ZOOM_STEP),
    '-': () => zoom.zoomBy(1 / KEY_ZOOM_STEP),
    _: () => zoom.zoomBy(1 / KEY_ZOOM_STEP),
    0: () => zoom.reset(),
    ArrowLeft: () => zoom.panBy(KEY_PAN_STEP, 0),
    ArrowRight: () => zoom.panBy(-KEY_PAN_STEP, 0),
    ArrowUp: () => zoom.panBy(0, KEY_PAN_STEP),
    ArrowDown: () => zoom.panBy(0, -KEY_PAN_STEP),
  };
  return Object.hasOwn(actions, key) ? actions[key] : null;
}

/** Start the zoom, the animator and the listeners of a connected element. */
function connect(node, state) {
  const { win, options } = state;
  const defaults = {
    role: 'img',
    tabindex: '0',
    'aria-keyshortcuts': '+ - 0 ArrowUp ArrowDown ArrowLeft ArrowRight',
  };
  for (const [name, value] of Object.entries(defaults)) {
    if (!node.hasAttribute(name)) {
      node.setAttribute(name, value);
    }
  }
  state.animator = createAnimator({
    reducedMotion: () =>
      win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true,
    raf: (cb) => win.requestAnimationFrame(cb),
    caf: (h) => win.cancelAnimationFrame(h),
    ...options.animator,
  });
  state.zoom = createZoomPan(node, {
    ...state.zoomLimits,
    onChange: () => node.requestDraw(),
  });
  const listen = (target, type, fn) => {
    target.addEventListener(type, fn);
    state.cleanup.push(() => target.removeEventListener(type, fn));
  };
  listen(node, 'keydown', (event) => {
    const action =
      event.ctrlKey || event.metaKey || event.altKey
        ? null
        : keyAction(state.zoom, event.key);
    if (action !== null) {
      event.preventDefault();
      action();
    }
  });
  // Redraw on a colour scheme change and on resize.
  const scheme = win.matchMedia?.('(prefers-color-scheme: dark)');
  if (typeof scheme?.addEventListener === 'function') {
    listen(scheme, 'change', () => node.requestDraw());
  }
  if (typeof win.ResizeObserver === 'function') {
    const observer = new win.ResizeObserver(() => node.requestDraw());
    observer.observe(node);
    state.cleanup.push(() => observer.disconnect());
  }
}

/** Stop everything `connect` started. */
function disconnect(state) {
  state.zoom?.destroy();
  state.animator?.destroy();
  state.cleanup.forEach((fn) => fn());
  state.cleanup = [];
  state.zoom = null;
  state.animator = null;
}

/** Read the model again (from raw links, `lino` or the text content). */
function readModel(node, state) {
  if (state.links !== null) {
    state.read = readLinkView(state.links.raw, { name: state.links.name });
  } else {
    const lino = node.getAttribute('lino');
    state.read = parseLinkView(lino ?? node.textContent ?? '');
  }
  node.setAttribute('aria-label', accessibleName(node.model));
}

/** Draw on the canvas of the surface (made on first use). */
function drawCanvas(state, geometry, style) {
  const { win, surface } = state;
  let canvas = surface.firstElementChild;
  if (canvas === null || canvas.localName !== 'canvas') {
    canvas = win.document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    surface.replaceChildren(canvas);
  }
  const ratio = win.devicePixelRatio || 1;
  const w = Math.round(style.width * ratio);
  const h = Math.round(style.height * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext?.('2d') ?? null;
  if (ctx === null) {
    return drawnMarkers(buildScene(geometry, style));
  }
  const options = { ...style, pixelRatio: ratio, Path2D: win.Path2D };
  return drawLinkCanvas(ctx, geometry, options).markers;
}

/** Draw an element now; returns what was drawn. */
function draw(node, state) {
  const model = node.model;
  const width = node.clientWidth || FALLBACK_SIZE.width;
  const height = node.clientHeight || FALLBACK_SIZE.height;
  const geometry = linkViewGeometry(model);
  const fit = fitView(sceneBounds(geometry), width, height, state.zoomLimits);
  const user = node.view;
  const style = {
    width,
    height,
    view: {
      x: user.k * fit.x + user.x,
      y: user.k * fit.y + user.y,
      k: user.k * fit.k,
    },
    colors: elementColors(node, state.win, (mode) => colorsOf(state, mode)),
    ends: model.ends,
    blueprint: model.blueprint,
    grid: model.grid,
  };
  const renderer =
    node.getAttribute('renderer') === 'canvas' ? 'canvas' : 'svg';
  let markers;
  if (renderer === 'canvas') {
    markers = drawCanvas(state, geometry, style);
  } else {
    state.surface.innerHTML = renderLinkSvg(geometry, style);
    markers = drawnMarkers(buildScene(geometry, style));
  }
  node.setAttribute('data-markers', markers.join(' '));
  return Object.freeze({ renderer, markers, view: style.view });
}

/** The shadow root content: a style sheet and the drawing surface. */
function makeSurface(node, win) {
  const root = node.attachShadow({ mode: 'open' });
  const style = win.document.createElement('style');
  style.textContent = STYLE;
  const surface = win.document.createElement('div');
  surface.className = 'surface';
  surface.setAttribute('part', 'surface');
  root.append(style, surface);
  return surface;
}

/**
 * Define the `link-view` element in a window. When the tag is already
 * defined there, the class defined for it is returned.
 * @param {Window & typeof globalThis} [win]
 * @param {{tag?: string, animator?: import('./animator.js').AnimatorOptions,
 *   zoom?: {min?: number, max?: number}}} [options]  `animator` options
 *   (clock, frame scheduler) for every element of the tag
 * @returns {CustomElementConstructor}
 */
export function defineLinkView(win = globalThis.window, options = {}) {
  const tag = options.tag ?? LINK_VIEW_TAG;
  const existing = win.customElements.get(tag);
  if (existing !== undefined) {
    return existing;
  }
  const zoomLimits = { min: 0.1, max: 20, ...options.zoom };

  class LinkView extends win.HTMLElement {
    static get observedAttributes() {
      return [...LINK_VIEW_ATTRIBUTES];
    }

    #state;

    constructor() {
      super();
      this.#state = {
        win,
        options,
        zoomLimits,
        surface: makeSurface(this, win),
        links: null,
        read: null,
        zoom: null,
        animator: null,
        cleanup: [],
        drawn: null,
        tokenColors: new Map(),
      };
    }

    connectedCallback() {
      connect(this, this.#state);
      readModel(this, this.#state);
      this.requestDraw();
    }

    disconnectedCallback() {
      disconnect(this.#state);
    }

    attributeChangedCallback() {
      if (this.isConnected) {
        readModel(this, this.#state);
        this.requestDraw();
      }
    }

    /** The model drawn, with the attribute overrides. */
    get model() {
      return withAttributes(
        this,
        this.#state.read?.model ?? readLinkView([]).model
      );
    }

    /** The problems found reading the Links Notation. */
    get diagnostics() {
      return [...(this.#state.read?.diagnostics ?? [])];
    }

    /** The Links Notation text drawn (the `lino` attribute). */
    get lino() {
      return this.getAttribute('lino');
    }

    set lino(text) {
      this.#state.links = null;
      this.setAttribute('lino', String(text));
    }

    /**
     * The sub-links of a `link-view` as raw values (what ui-dom gives a
     * kind); when set, they are drawn and the text is not read.
     * @param {{raw: readonly unknown[], name?: string|null}|null} value
     */
    set links(value) {
      const next =
        value === null ? null : { raw: value.raw, name: value.name ?? null };
      if (JSON.stringify(next) !== JSON.stringify(this.#state.links)) {
        this.#state.links = next;
        if (this.isConnected) {
          readModel(this, this.#state);
          this.requestDraw();
        }
      }
    }

    get links() {
      return this.#state.links;
    }

    /** The zoom and pan of this element (`{x, y, k}`, relative to fit). */
    get view() {
      return this.#state.zoom?.get() ?? { x: 0, y: 0, k: 1 };
    }

    set view(next) {
      this.#state.zoom?.set(next);
    }

    /** What the last draw drew: renderer, marker ids and view. */
    get drawn() {
      return this.#state.drawn;
    }

    zoomBy(factor, pivot) {
      return this.#state.zoom?.zoomBy(factor, pivot);
    }

    resetView() {
      return this.#state.zoom?.reset();
    }

    /** Ask for a redraw on the next frame (several asks draw once). */
    requestDraw() {
      this.#state.animator?.start('draw', () => {
        this.draw();
        return false;
      });
    }

    /** Draw now. */
    draw() {
      this.#state.drawn = draw(this, this.#state);
    }
  }

  win.customElements.define(tag, LinkView);
  return LinkView;
}

/**
 * The ui-dom kind of `link-view`: a ui-dom document with a `link-view`
 * element renders it as this element, drawing the element's sub-links.
 * @param {{tag?: string}} [options]
 * @returns {import('@link-foundation/ui-dom').KindSpec}
 */
export function linkViewKind({ tag = LINK_VIEW_TAG } = {}) {
  const setLinks = (node, el) => {
    node.links = { raw: el.unknown, name: el.name };
  };
  return {
    tag,
    childrenSlot: null,
    create(el, ctx) {
      const node = ctx.document.createElement(tag);
      setLinks(node, el);
      return node;
    },
    update: (node, el) => setLinks(node, el),
  };
}

/**
 * Define the element in a window and register it as the ui-dom renderer of
 * the `link-view` kind.
 * @param {Window & typeof globalThis} [win]
 * @param {Parameters<typeof defineLinkView>[1]} [options]
 */
export function registerLinkViewKind(win = globalThis.window, options = {}) {
  defineLinkView(win, options);
  return defineKind('link-view', linkViewKind(options));
}
