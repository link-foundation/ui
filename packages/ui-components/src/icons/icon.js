/**
 * The `ui-icon` element and the `icon` kind of the ui-dom renderer.
 *
 *   <ui-icon name="close"></ui-icon>                     decorative
 *   <ui-icon set="lucide" name="check" label="Done"></ui-icon>
 *
 *   (icon close)                                         Links Notation
 *   (ok: icon (set lucide) (name check) (label 'Done'))
 *
 * Without a label the icon is decorative (`aria-hidden="true"`); with a
 * label it is an image with that accessible name (`role="img"`). It draws
 * in `currentColor`, so it follows the text colour, and it is 1.5em square
 * unless `--ui-icon-size` says otherwise. Icons that point in the reading
 * direction (or any icon with `mirror="true"`) flip in right-to-left text.
 */

import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';
import { defineKind } from '@link-foundation/ui-dom';
import {
  onIconSetsChange,
  parseIconRef,
  resolveIcon,
} from './icon-registry.js';
import { iconToSvg } from './svg.js';
import { applyPresentation } from './presentation.js';

export const ICON_TAG = 'ui-icon';

/** The attributes of `ui-icon`, which are also the properties of `icon`. */
export const ICON_ATTRIBUTES = Object.freeze([
  'name',
  'set',
  'label',
  'mirror',
  'fill',
  'stroke-width',
  'size',
]);

export const ICON_CSS = `${ICON_TAG} {
  display: inline-block;
  flex: none;
  inline-size: var(--ui-icon-size, 1.5em);
  block-size: var(--ui-icon-size, 1.5em);
  line-height: 0;
  vertical-align: -0.25em;
  color: inherit;
}
${ICON_TAG} > svg {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  overflow: visible;
}
${ICON_TAG}[data-mirror]:dir(rtl) > svg {
  transform: scaleX(-1);
}
[dir='rtl'] ${ICON_TAG}[data-mirror] > svg {
  transform: scaleX(-1);
}
[dir='ltr'] ${ICON_TAG}[data-mirror] > svg {
  transform: none;
}
`;

/**
 * The `icon` kind for the ui-core vocabulary. `ui-dialect/0` has no icon
 * kind yet (docs/spec/open-questions.md, "Icon element kind"): parse with
 * `iconVocabulary()` to read `(icon close)`.
 */
export const ICON_KIND_TEXT = `icon: kind
  description 'An icon of a registered icon set; decorative unless it has a label.'
  positional name
  property name string
  property set string
  property label string
  property mirror
    enum true false
  property fill string
  property stroke-width string
  property size string
  property note string multi
  children none`;

let vocabulary;

/**
 * The ui-dialect/0 vocabulary plus the `icon` kind, for ui-core `parse`
 * and ui-dom `mountDocument` (`parseOptions: {vocabulary}`).
 * @returns {import('@link-foundation/ui-core').Vocabulary}
 */
export function iconVocabulary() {
  if (vocabulary === undefined) {
    const base = defaultVocabulary();
    const icon = loadVocabulary(ICON_KIND_TEXT);
    vocabulary = Object.freeze({
      ...base,
      kinds: new Map([...base.kinds, ...icon.kinds]),
    });
  }
  return vocabulary;
}

/** Roots (documents, shadow roots) that already have the icon CSS. */
const styled = new WeakSet();

/** Add ICON_CSS to the root of a node, once per root. */
function styleRoot(node) {
  const root = node.getRootNode();
  if (styled.has(root) || (root.nodeType !== 9 && root.nodeType !== 11)) {
    return;
  }
  styled.add(root);
  const win = node.ownerDocument.defaultView;
  if (
    Array.isArray(root.adoptedStyleSheets) &&
    typeof win?.CSSStyleSheet?.prototype?.replaceSync === 'function'
  ) {
    const sheet = new win.CSSStyleSheet();
    sheet.replaceSync(ICON_CSS);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return;
  }
  const style = node.ownerDocument.createElement('style');
  style.setAttribute('data-ui-icon', '');
  style.textContent = ICON_CSS;
  const parent =
    root.nodeType === 9 ? (root.head ?? root.documentElement) : root;
  parent.insertBefore(style, parent.firstChild);
}

/** Drop scripts, foreign content and event handlers from icon markup. */
function sanitize(svg) {
  for (const node of svg.querySelectorAll('script, foreignObject')) {
    node.remove();
  }
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const { name, value } of [...node.attributes]) {
      if (
        name.startsWith('on') ||
        (name.endsWith('href') && !value.trim().startsWith('#'))
      ) {
        node.removeAttribute(name);
      }
    }
  }
  return svg;
}

/** Parse icon data into an `<svg>` element of the document. */
function svgElement(document, icon) {
  const template = document.createElement('template');
  template.innerHTML = iconToSvg(icon, {
    'aria-hidden': 'true',
    focusable: 'false',
  });
  return sanitize(template.content.firstElementChild);
}

/** Whether the icon flips in right-to-left text. */
function mirrors(element, icon) {
  const mirror = element.getAttribute('mirror');
  if (mirror === null) {
    return icon.mirrorInRtl === true;
  }
  return mirror !== 'false';
}

/**
 * The `ui-icon` class of a window.
 * @param {Window} win
 */
function createIconClass(win) {
  return class UiIcon extends win.HTMLElement {
    static get observedAttributes() {
      return ICON_ATTRIBUTES;
    }

    #token = 0;
    #unlisten = undefined;
    #ready = Promise.resolve(undefined);
    #icon = undefined;
    #sizeBefore = undefined;

    /** The icon data shown now (after `ready`). */
    get icon() {
      return this.#icon;
    }

    /** Settles with the icon data when the drawing is up to date. */
    get ready() {
      return this.#ready;
    }

    connectedCallback() {
      styleRoot(this);
      this.#applyLabel();
      this.#unlisten ??= onIconSetsChange((set) => {
        const wanted = parseIconRef({
          set: this.getAttribute('set') ?? undefined,
          name: '',
        }).set;
        if (set === wanted || set === this.#icon?.set) {
          this.#render();
        }
      });
      this.#render();
    }

    disconnectedCallback() {
      this.#unlisten?.();
      this.#unlisten = undefined;
    }

    attributeChangedCallback(name, before, after) {
      if (!this.isConnected || before === after) {
        return;
      }
      if (name === 'label') {
        this.#applyLabel();
      } else if (name === 'mirror' && this.#icon !== undefined) {
        this.toggleAttribute('data-mirror', mirrors(this, this.#icon));
      } else {
        this.#render();
      }
    }

    /** Decorative without a label, an image named by the label with one. */
    #applyLabel() {
      const value = this.getAttribute('label')?.trim();
      const label =
        value === 'true'
          ? (this.#icon?.title ?? this.#icon?.name)
          : value === 'false'
            ? ''
            : value;
      if (label) {
        this.setAttribute('role', 'img');
        this.setAttribute('aria-label', label);
        this.removeAttribute('aria-hidden');
      } else {
        this.setAttribute('aria-hidden', 'true');
        this.removeAttribute('role');
        this.removeAttribute('aria-label');
      }
    }

    #render() {
      const token = (this.#token += 1);
      const ref = {
        set: this.getAttribute('set') ?? undefined,
        name: this.getAttribute('name') ?? '',
      };
      this.#ready = resolveIcon(ref).then((icon) => {
        if (token !== this.#token) {
          return this.#icon;
        }
        this.#icon = icon;
        const svg = svgElement(this.ownerDocument, icon);
        const size = applyPresentation(this, svg);
        if (this.#sizeBefore !== undefined) {
          const { value, priority } = this.#sizeBefore;
          if (value) {
            this.style.setProperty('--ui-icon-size', value, priority);
          } else {
            this.style.removeProperty('--ui-icon-size');
          }
          this.#sizeBefore = undefined;
        }
        if (size !== undefined) {
          this.#sizeBefore = {
            value: this.style.getPropertyValue('--ui-icon-size'),
            priority: this.style.getPropertyPriority('--ui-icon-size'),
          };
          this.style.setProperty('--ui-icon-size', size);
        }
        this.replaceChildren(svg);
        this.#applyLabel();
        this.setAttribute('data-icon-set', icon.set);
        this.toggleAttribute('data-placeholder', icon.placeholder === true);
        this.toggleAttribute('data-mirror', mirrors(this, icon));
        return icon;
      });
      return this.#ready;
    }
  };
}

/**
 * Define `ui-icon` in a window (once). In a browser this happens on
 * import; call it for another window (jsdom) before rendering there.
 * @param {Window|undefined} [win]
 * @returns {CustomElementConstructor|undefined} the class, or undefined
 *   without custom elements
 */
export function defineIconElement(win = globalThis.window) {
  const registry = win?.customElements;
  if (registry === undefined) {
    return undefined;
  }
  const existing = registry.get(ICON_TAG);
  if (existing !== undefined) {
    return existing;
  }
  const UiIcon = createIconClass(win);
  registry.define(ICON_TAG, UiIcon);
  return UiIcon;
}

/** The single text value of a property of a ui-dom element model. */
function atom(el, name) {
  const values = el.props.get(name);
  return values?.length === 1 && typeof values[0] === 'string'
    ? values[0]
    : undefined;
}

/** The attribute values of an `icon` element model. */
export function iconAttributes(el) {
  const positional = el.positional?.[0];
  return {
    name:
      atom(el, 'name') ??
      (typeof positional === 'string' ? positional : undefined),
    set: atom(el, 'set'),
    label: atom(el, 'label'),
    mirror: atom(el, 'mirror'),
    fill: atom(el, 'fill'),
    'stroke-width': atom(el, 'stroke-width'),
    size: atom(el, 'size'),
  };
}

defineKind('icon', {
  tag: ICON_TAG,
  childrenSlot: null,
  create(el, ctx) {
    defineIconElement(ctx.document.defaultView ?? undefined);
    return ctx.document.createElement(ICON_TAG);
  },
  update(node, el, changed, ctx) {
    const attributes = iconAttributes(el);
    if (attributes.name === undefined) {
      ctx.diagnostic('missing-icon-name', 'warning', { property: 'name' });
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === undefined) {
        node.removeAttribute(name);
      } else if (node.getAttribute(name) !== value) {
        node.setAttribute(name, value);
      }
    }
  },
});

defineIconElement();
