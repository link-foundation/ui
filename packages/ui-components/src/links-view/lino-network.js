import { defineLinksNetwork } from './links-network.js';
import { linoToNetwork } from './lino-to-network.js';
import { sourceReferences } from './lino-network-source.js';

export const LINO_NETWORK_TAG = 'lino-network';
const CSS = `:host { display:block; color-scheme:light dark; }
links-network { width:100%; height:400px; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; padding:12px; border:1px solid currentColor; }
mark { background:#ffe066; color:#171717; }
ul { padding-inline-start:24px; }
[hidden] { display:none; }`;

function showDiagnostics(state, diagnostics) {
  state.diagnostics = diagnostics;
  state.list.replaceChildren();
  state.list.hidden = diagnostics.length === 0;
  for (const diagnostic of diagnostics) {
    const item = state.win.document.createElement('li');
    item.textContent = `${diagnostic.severity}: ${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`;
    state.list.append(item);
  }
}

function highlightSource(state, position) {
  const text = state.text;
  let start = 0;
  let line = 1;
  while (line < position.line && start < text.length) {
    if (text[start] === '\r') {
      line++;
      if (text[start + 1] === '\n') {
        start++;
      }
    } else if (text[start] === '\n') {
      line++;
    }
    start++;
  }
  start += position.column - 1;
  const token = sourceReferences(text).find((token) => token.start === start);
  const end = token?.end ?? start + 1;
  const mark = state.win.document.createElement('mark');
  mark.textContent = text.slice(start, end);
  state.source.replaceChildren(text.slice(0, start), mark, text.slice(end));
}

function selectSource(node, state, event) {
  const id = event.detail.ids.at(-1);
  const position = state.sourceMap.get(id);
  if (!position) {
    state.source.textContent = state.text;
    return;
  }
  highlightSource(state, position);
  node.dispatchEvent(
    new state.win.CustomEvent('select', {
      detail: { id, ...position },
      bubbles: true,
      composed: true,
    })
  );
}

async function loadSource(node, state) {
  state.controller?.abort();
  const controller = new state.win.AbortController();
  state.controller = controller;
  try {
    let text = node.getAttribute('lino') ?? node.textContent;
    if (node.hasAttribute('src')) {
      const response = await (
        state.options.fetch ?? state.win.fetch.bind(state.win)
      )(node.getAttribute('src'), { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Unable to load LiNo (${response.status})`);
      }
      text = await response.text();
    }
    if (controller.signal.aborted) {
      return;
    }
    state.text = text;
    state.source.textContent = text;
    const converted = linoToNetwork(text, state.options);
    state.sourceMap = converted.sourceMap;
    showDiagnostics(state, converted.diagnostics);
    state.view.items = converted.links;
    await state.view.ready;
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    state.text = '';
    state.source.textContent = '';
    state.sourceMap = new Map();
    state.view.items = [];
    showDiagnostics(state, [
      {
        code: 'load-error',
        severity: 'error',
        line: 1,
        column: 1,
        message: error.message,
      },
    ]);
  }
}

/** Explicit registration; safe to import in Node without a DOM. */
export function defineLinoNetwork(win = globalThis.window, options = {}) {
  const tag = options.tag ?? LINO_NETWORK_TAG;
  if (win.customElements.get(tag)) {
    return win.customElements.get(tag);
  }
  defineLinksNetwork(win, { createWorker: options.createWorker });
  class LinoNetwork extends win.HTMLElement {
    #state;
    static get observedAttributes() {
      return ['src', 'lino', 'layout', 'style-mode', 'theme', 'label'];
    }
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      const style = win.document.createElement('style');
      style.textContent = CSS;
      const view = win.document.createElement('links-network');
      const list = win.document.createElement('ul');
      list.setAttribute('aria-label', 'Diagnostics');
      list.setAttribute('aria-live', 'polite');
      list.hidden = true;
      const source = win.document.createElement('pre');
      source.setAttribute('aria-label', 'Links Notation source');
      root.append(style, view, list, source);
      this.#state = {
        win,
        options,
        view,
        list,
        source,
        text: '',
        sourceMap: new Map(),
        diagnostics: [],
        ready: Promise.resolve(),
      };
      view.addEventListener('selectionchange', (event) =>
        selectSource(this, this.#state, event)
      );
    }
    connectedCallback() {
      for (const name of ['layout', 'style-mode', 'theme', 'label']) {
        this.#forward(name);
      }
      this.#state.observer = new win.MutationObserver(() => this.#load());
      this.#state.observer.observe(this, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      this.#load();
    }
    disconnectedCallback() {
      this.#state.controller?.abort();
      this.#state.observer?.disconnect();
    }
    attributeChangedCallback(name) {
      if (!this.isConnected) {
        return;
      }
      if (name === 'src' || name === 'lino') {
        this.#load();
      } else {
        this.#forward(name);
      }
    }
    #forward(name) {
      const value = this.getAttribute(name);
      if (value === null) {
        this.#state.view.removeAttribute(name);
      } else {
        this.#state.view.setAttribute(name, value);
      }
    }
    #load() {
      this.#state.ready = loadSource(this, this.#state);
    }
    get ready() {
      return this.#state.ready;
    }
    get diagnostics() {
      return [...this.#state.diagnostics];
    }
    get sourceMap() {
      return new Map(this.#state.sourceMap);
    }
    get network() {
      return this.#state.view.network;
    }
    get networkView() {
      return this.#state.view;
    }
    get lino() {
      return this.#state.text;
    }
    set lino(text) {
      this.setAttribute('lino', text);
    }
    select(id) {
      this.#state.view.select(id);
    }
    toSvg() {
      return this.#state.view.toSvg();
    }
    toPng(scale = 1) {
      return this.#state.view.toPng(scale);
    }
  }
  win.customElements.define(tag, LinoNetwork);
  return LinoNetwork;
}
