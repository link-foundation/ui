import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';
import { defineKind } from '@link-foundation/ui-dom';
import { createEmbed } from './controller.js';

const attributes = [
  'provider',
  'id',
  'hash',
  'theme',
  'locale',
  'timeout',
  'script-timeout',
  'root-margin',
  'enabled',
  'toggle',
  'debug',
];
const camel = (name) =>
  name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function optionsOf(node, names = attributes) {
  return Object.fromEntries(
    names.map((name) => {
      const value = node.getAttribute(name);
      return [
        camel(name),
        ['enabled', 'toggle', 'debug'].includes(name)
          ? value === null
            ? name === 'enabled'
              ? true
              : false
            : value !== 'false'
          : (value ?? undefined),
      ];
    })
  );
}

/** Define in an explicit window (jsdom/iframes), or the current browser. */
export function defineEmbedElement(win = globalThis.window) {
  if (!win?.customElements || win.customElements.get('ui-embed')) {
    return win?.customElements?.get('ui-embed');
  }
  class UiEmbed extends win.HTMLElement {
    static observedAttributes = attributes;
    connectedCallback() {
      this.embed?.destroy();
      this.pendingUpdate = undefined;
      this.embed = createEmbed(this, optionsOf(this));
    }
    disconnectedCallback() {
      this.embed?.destroy();
      this.embed = undefined;
      this.pendingUpdate = undefined;
    }
    attributeChangedCallback(name) {
      if (!this.embed) {
        return;
      }
      if (this.pendingUpdate?.controller === this.embed) {
        this.pendingUpdate.names.add(name);
        return;
      }
      const controller = this.embed;
      const pending = { controller, names: new Set([name]) };
      this.pendingUpdate = pending;
      win.queueMicrotask(() => {
        if (this.pendingUpdate !== pending) {
          return;
        }
        this.pendingUpdate = undefined;
        if (this.embed === controller) {
          controller.update(optionsOf(this, [...pending.names]));
        }
      });
    }
  }
  win.customElements.define('ui-embed', UiEmbed);
  return UiEmbed;
}

export const EMBED_KIND_TEXT = `embed: kind
  description 'An allow-listed deferred provider post, with archived children.'
  property provider string
  property id string
  property hash string
  property theme
    enum light dark system
  property locale string
  property timeout number
  property script-timeout number
  property root-margin string
  property enabled
    enum true false
  property toggle
    enum true false
  property debug
    enum true false
  children any`;

/** Opt-in extension; the core dialect and HTML import security remain unchanged. */
export function embedVocabulary(base = defaultVocabulary()) {
  const extension = loadVocabulary(EMBED_KIND_TEXT);
  return Object.freeze({
    ...base,
    kinds: new Map([...base.kinds, ...extension.kinds]),
  });
}

const archives = new WeakMap();

defineKind('embed', {
  tag: 'ui-embed',
  create(el, ctx) {
    // Static rendering produces only archive content, without a controller.
    if (ctx.options.interactive !== false) {
      defineEmbedElement(ctx.document.defaultView ?? undefined);
    }
    const node = ctx.document.createElement('ui-embed');
    const archive = ctx.document.createElement('div');
    archive.setAttribute('slot', 'fallback');
    node.appendChild(archive);
    archives.set(node, archive);
    return node;
  },
  childrenSlot: (node) => archives.get(node),
  update(node, el) {
    for (const name of attributes) {
      const value = el.props.get(name)?.[0];
      if (value === undefined) {
        node.removeAttribute(name);
      } else if (node.getAttribute(name) !== String(value)) {
        node.setAttribute(name, String(value));
      }
    }
  },
  destroy(node) {
    node.embed?.destroy();
  },
});

defineEmbedElement();
