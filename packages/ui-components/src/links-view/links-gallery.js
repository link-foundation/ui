import { defineLinksNetwork } from './links-network.js';
import { circle } from './layouts/circle.js';
import { networkGeometry } from './network-scene.js';
import { pathBounds } from './geometry.js';
import { fitView } from './scene.js';
import {
  count,
  codeAt,
  decode,
  encode,
  indexOf,
  representatives,
  classCount,
} from './configurations.js';

export const LINKS_GALLERY_TAG = 'links-gallery';
export const GALLERY_PAGE_SIZE = 243;
const THUMBNAIL_TAG = 'links-gallery-network';
const CSS = `:host { display:block; color-scheme:light dark; font:inherit; }
[role=tablist], .filters { display:flex; flex-wrap:wrap; gap:12px; margin-block:12px; }
button { font:inherit; padding:8px; color:inherit; background:Canvas; border:1px solid GrayText; border-radius:4px; cursor:pointer; }
[aria-selected=true] { font-weight:bold; border:2px solid currentColor; }
a { color:LinkText; text-align:center; text-decoration:none; }
a:focus-visible, button:focus-visible, input:focus-visible { outline:2px solid Highlight; outline-offset:3px; }
.cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(80px,1fr)); gap:12px; }
links-gallery-network { width:64px; height:64px; margin:auto; pointer-events:none; }
code { display:block; font-size:11px; }
[hidden] { display:none; }`;
const words = Object.freeze({
  en: Object.freeze({
    title: 'Network size',
    classes: 'Classes only',
    real: 'Real-only',
    more: 'Show more',
    first: 'first',
    last: 'last',
    links: Object.freeze({ one: 'link', other: 'links' }),
    networks: Object.freeze({ one: 'network', other: 'networks' }),
    classNames: Object.freeze({ one: 'class', other: 'classes' }),
  }),
  ru: Object.freeze({
    title: 'Размер сети',
    classes: 'Только классы',
    real: 'Только реальные',
    more: 'Показать ещё',
    first: 'первая',
    last: 'последняя',
    networks: Object.freeze({
      one: 'сеть',
      few: 'сети',
      many: 'сетей',
      other: 'сети',
    }),
    classNames: Object.freeze({
      one: 'класс',
      few: 'класса',
      many: 'классов',
      other: 'класса',
    }),
    links: Object.freeze({
      one: 'связь',
      few: 'связи',
      many: 'связей',
      other: 'связи',
    }),
  }),
});

function readLocale(host) {
  return (
    host.getAttribute('lang') ??
    host.closest('[lang]')?.getAttribute('lang') ??
    'en'
  );
}
function messages(host) {
  return words[readLocale(host).split('-')[0]] ?? words.en;
}
function tabLabel(host, n) {
  const locale = readLocale(host);
  const text = messages(host);
  const plural = new Intl.PluralRules(locale).select(n);
  const number = new Intl.NumberFormat(locale);
  const options = { real: host.hasAttribute('real') };
  const total = host.hasAttribute('classes')
    ? classCount(n, options)
    : count(n, options);
  const nouns = host.hasAttribute('classes') ? text.classNames : text.networks;
  const totalPlural = new Intl.PluralRules(locale).select(Number(total));
  return `${number.format(n)} ${text.links[plural] ?? text.links.other} · ${number.format(total)} ${nouns[totalPlural] ?? nouns.other}`;
}
function renderGallery(host, state) {
  const win = state.win;
  state.root.replaceChildren();
  state.tabs = [];
  const text = messages(host),
    n = host.size,
    real = host.hasAttribute('real');
  state.element('style', CSS);
  const tabs = state.element('div');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', text.title);
  for (let i = 1; i <= 4; i++) {
    const tab = state.element('button', tabLabel(host, i), tabs);
    tab.type = 'button';
    tab.id = `tab-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(n === i));
    tab.setAttribute('aria-controls', 'networks');
    tab.tabIndex = n === i ? 0 : -1;
    tab.addEventListener('click', () => {
      host.size = i;
      state.tabs[i - 1].focus();
    });
    tab.addEventListener('keydown', (event) => {
      const next =
        event.key === 'Home'
          ? 1
          : event.key === 'End'
            ? 4
            : event.key === 'ArrowRight'
              ? (i % 4) + 1
              : event.key === 'ArrowLeft'
                ? ((i + 2) % 4) + 1
                : null;
      if (next) {
        event.preventDefault();
        host.size = next;
        state.tabs[next - 1].focus();
      }
    });
    state.tabs.push(tab);
  }
  const filters = state.element('div');
  filters.className = 'filters';
  for (const name of ['classes', 'real']) {
    const label = state.element('label', null, filters);
    const input = state.element('input', null, label);
    input.type = 'checkbox';
    input.checked = host.hasAttribute(name);
    input.addEventListener('change', () => {
      host.toggleAttribute(name, input.checked);
      state.root.querySelector(`input[data-filter="${name}"]`).focus();
    });
    input.dataset.filter = name;
    label.append(win.document.createTextNode(` ${text[name]}`));
  }
  const base = real ? n : n + 1;
  const formula = `${text.first} ${codeAt(n, 0, { real })} … ${text.last} ${codeAt(n, count(n, { real }) - 1n, { real })}: ${base}^(${2 * n}) = ${new Intl.NumberFormat(readLocale(host)).format(count(n, { real }))}`;
  state.element('p', formula);
  const panel = state.element('div');
  panel.id = 'networks';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `tab-${n}`);
  state.cards = state.element('div', null, panel);
  state.cards.className = 'cards';
  state.codes = null;
  if (host.hasAttribute('classes')) {
    const key = `${n}:${real}`;
    if (!state.cache.has(key)) {
      state.cache.set(key, representatives(n, { real }).map(encode));
    }
    state.codes = state.cache.get(key);
  }
  state.total = state.codes?.length ?? Number(count(n, { real }));
  state.shown = 0;
  state.more = state.element('button', text.more);
  state.more.type = 'button';
  state.more.addEventListener('click', () => appendPage(host, state));
  appendPage(host, state);
}
function fitThumbnail(thumb) {
  const positions = circle(thumb.network, { width: 192, height: 192 });
  const bounds = [...thumb.network.links.values()].map((link) =>
    pathBounds(networkGeometry(link, positions).path)
  );
  thumb.positions = positions;
  thumb.view = fitView(
    {
      minX: Math.min(...bounds.map((b) => b.minX)) - 12,
      minY: Math.min(...bounds.map((b) => b.minY)) - 12,
      maxX: Math.max(...bounds.map((b) => b.maxX)) + 12,
      maxY: Math.max(...bounds.map((b) => b.maxY)) + 12,
    },
    64,
    64
  );
}

function appendPage(host, state) {
  const win = state.win;
  const n = host.size,
    real = host.hasAttribute('real'),
    theme = host.getAttribute('theme');
  const limit = Math.min(state.shown + GALLERY_PAGE_SIZE, state.total);
  const fragment = win.document.createDocumentFragment();
  for (; state.shown < limit; state.shown++) {
    const code = state.codes?.[state.shown] ?? codeAt(n, state.shown, { real });
    const links = decode(code);
    const context = {
      code,
      links,
      index: indexOf(links, { real }).toString(),
      size: n,
      real,
      theme,
    };
    const card = state.element(state.url ? 'a' : 'div', null, fragment);
    card.className = 'card';
    if (state.url) {
      const url = new win.URL(String(state.url(context)), win.document.baseURI);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new TypeError('Gallery URLs must use HTTP(S)');
      }
      card.href = url.href;
    }
    const thumb = state.element(THUMBNAIL_TAG, null, card);
    thumb.setAttribute('aria-hidden', 'true');
    thumb.addEventListener('layoutend', () => fitThumbnail(thumb));
    if (theme) {
      thumb.setAttribute('theme', theme);
    }
    thumb.items = links.map(([source, target], i) => ({
      id: i + 1,
      source,
      target,
    }));
    state.element('code', code, card);
  }
  state.cards.append(fragment);
  // connectedCallback makes networks focusable; thumbnails are decorative.
  for (const thumb of state.cards.querySelectorAll(THUMBNAIL_TAG)) {
    thumb.tabIndex = -1;
  }
  state.more.hidden = state.shown >= state.total;
}
/** Each host owns its URL callback, paging, locale and class enumeration cache. */
export function defineLinksGallery(
  win = globalThis.window,
  { tag = LINKS_GALLERY_TAG } = {}
) {
  if (win.customElements.get(tag)) {
    return win.customElements.get(tag);
  }
  defineLinksNetwork(win, { tag: THUMBNAIL_TAG, worker: false });
  class LinksGallery extends win.HTMLElement {
    #state;
    static get observedAttributes() {
      return ['size', 'classes', 'real', 'lang', 'theme'];
    }
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      this.#state = {
        win,
        root,
        url: null,
        cache: new Map(),
        shown: 0,
        total: 0,
        codes: null,
        tabs: [],
        element(tag, text, parent = root) {
          const node = win.document.createElement(tag);
          if (text) {
            node.textContent = text;
          }
          parent.append(node);
          return node;
        },
      };
    }
    connectedCallback() {
      renderGallery(this, this.#state);
    }
    attributeChangedCallback() {
      if (this.isConnected) {
        renderGallery(this, this.#state);
      }
    }
    set urlFor(value) {
      if (value !== null && typeof value !== 'function') {
        throw new TypeError('urlFor must be a function');
      }
      this.#state.url = value;
      if (this.isConnected) {
        renderGallery(this, this.#state);
      }
    }
    get urlFor() {
      return this.#state.url;
    }
    get size() {
      const value = Number(this.getAttribute('size') ?? 1);
      return Number.isInteger(value) && value >= 1 && value <= 4 ? value : 1;
    }
    set size(n) {
      this.setAttribute('size', String(n));
    }
    get count() {
      return BigInt(this.#state.total);
    }
  }
  win.customElements.define(tag, LinksGallery);
  return LinksGallery;
}
