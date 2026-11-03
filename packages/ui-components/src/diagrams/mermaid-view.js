/**
 * The Mermaid adapter: `<ui-mermaid-view>` renders Mermaid text with Mermaid,
 * imported on the first render only (`import('mermaid')`) and initialised
 * with `securityLevel: 'strict'`. While Mermaid loads, and whenever the
 * import or the render fails, the source text is shown in a `pre` with an
 * error message, so a diagram never disappears (link-assistant/formal-ai
 * issue 1190).
 *
 * Mermaid (MIT) is an optional peer dependency: an app that never shows a
 * Mermaid diagram never downloads it.
 */

/** @typedef {{initialize(config: object): void, render(id: string, text: string): Promise<{svg: string}>}} MermaidApi */
/** @typedef {() => Promise<any>} MermaidImporter  resolves to the module */

export const MERMAID_CONFIG = Object.freeze({
  startOnLoad: false,
  securityLevel: 'strict',
});

/** @type {MermaidImporter} */
const importMermaid = () => import('mermaid');

let importer = importMermaid;
/** @type {Promise<MermaidApi>|null} */
let loading = null;
let renderCount = 0;

/**
 * Replace how Mermaid is imported (a CDN URL, a bundled copy, a stub in
 * tests). Resets the cached module.
 * @param {MermaidImporter|null} next  `null`: back to `import('mermaid')`
 */
export function setMermaidImporter(next) {
  if (next !== null && typeof next !== 'function') {
    throw new TypeError('setMermaidImporter: expected a function or null');
  }
  importer = next ?? importMermaid;
  loading = null;
}

/**
 * Import and initialise Mermaid on the first call; a failed import is tried
 * again by the next call.
 * @returns {Promise<MermaidApi>}
 */
export function loadMermaid() {
  if (loading === null) {
    loading = Promise.resolve()
      .then(() => importer())
      .then((module) => {
        const mermaid = module?.default ?? module;
        if (typeof mermaid?.render !== 'function') {
          throw new TypeError('the mermaid module has no render function');
        }
        mermaid.initialize({ ...MERMAID_CONFIG });
        return mermaid;
      });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/**
 * Render Mermaid text to an SVG string with the lazily loaded Mermaid.
 * @param {string} source
 * @returns {Promise<string>}
 */
export async function renderMermaid(source) {
  const mermaid = await loadMermaid();
  renderCount += 1;
  const { svg } = await mermaid.render(`ui-mermaid-${renderCount}`, source);
  return svg;
}

const VISUALLY_HIDDEN =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0';

/** Inline style of content kept for screen readers only. */
export const visuallyHiddenStyle = () => VISUALLY_HIDDEN;

/**
 * Show the source text of a diagram in a `pre`, with an optional error
 * message (`role="alert"`) before it. Text only, never markup.
 * @param {HTMLElement} host
 * @param {string} source
 * @param {string|null} message
 */
export function showSource(host, source, message) {
  const doc = host.ownerDocument;
  host.replaceChildren();
  if (message !== null) {
    const error = doc.createElement('p');
    error.className = 'ui-diagram-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;
    host.appendChild(error);
  }
  const pre = doc.createElement('pre');
  pre.className = 'ui-diagram-source';
  pre.tabIndex = 0;
  const code = doc.createElement('code');
  code.textContent = source;
  pre.appendChild(code);
  host.appendChild(pre);
}

/**
 * Set `data-state` and announce it with a `ui-diagram-state` event.
 * @param {HTMLElement} host
 * @param {'loading'|'ready'|'error'} state
 * @param {object} [detail]
 */
export function setState(host, state, detail = {}) {
  host.dataset.state = state;
  host.dispatchEvent(
    new host.ownerDocument.defaultView.CustomEvent('ui-diagram-state', {
      bubbles: true,
      detail: { state, ...detail },
    })
  );
}

const errorText = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * The `<ui-mermaid-view>` class for a window.
 * @param {typeof HTMLElement} Base
 */
function mermaidViewClass(Base) {
  return class MermaidView extends Base {
    static get observedAttributes() {
      return ['label'];
    }

    constructor() {
      super();
      /** @type {string|null} */
      this._source = null;
      this._run = 0;
    }

    /** The Mermaid text (defaults to the text content at first connect). */
    get source() {
      return this._source ?? '';
    }

    set source(value) {
      this._source = String(value);
      if (this.isConnected) {
        this.refresh();
      }
    }

    connectedCallback() {
      if (this._source === null) {
        this._source = (this.textContent ?? '').trim();
      }
      this.refresh();
    }

    attributeChangedCallback() {
      const svg = this.querySelector('svg');
      if (svg) {
        svg.setAttribute('aria-label', this.label);
      }
    }

    get label() {
      return this.getAttribute('label') ?? 'Mermaid diagram';
    }

    /** Render again; resolves to the state reached. */
    async refresh() {
      const run = ++this._run;
      const source = this.source;
      showSource(this, source, null);
      this.setAttribute('aria-busy', 'true');
      setState(this, 'loading');
      let svg;
      let failure = null;
      try {
        svg = await renderMermaid(source);
      } catch (error) {
        failure = error;
      }
      if (run !== this._run) {
        return this.dataset.state;
      }
      this.removeAttribute('aria-busy');
      if (failure !== null) {
        showSource(
          this,
          source,
          `The diagram could not be drawn with Mermaid (${errorText(failure)}). Its source is shown instead.`
        );
        setState(this, 'error', { error: failure });
        return 'error';
      }
      // Mermaid output, sanitised by Mermaid itself (securityLevel strict).
      this.innerHTML = svg;
      const drawn = this.querySelector('svg');
      if (drawn) {
        drawn.setAttribute('role', 'img');
        drawn.setAttribute('aria-label', this.label);
      }
      setState(this, 'ready');
      return 'ready';
    }
  };
}

/**
 * Define `<ui-mermaid-view>` in a window (once).
 * @param {Window & typeof globalThis} [win]
 * @returns {CustomElementConstructor}
 */
export function defineMermaidView(win = globalThis) {
  const existing = win.customElements.get('ui-mermaid-view');
  if (existing) {
    return existing;
  }
  const MermaidView = mermaidViewClass(win.HTMLElement);
  win.customElements.define('ui-mermaid-view', MermaidView);
  return MermaidView;
}
