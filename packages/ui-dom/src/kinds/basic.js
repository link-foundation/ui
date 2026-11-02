/**
 * The basic kinds of the vocabulary: document, stack, text, button and
 * image, plus `ui-unknown`, the fallback of a kind without a renderer.
 *
 * Every value reaches the DOM as text (`Text.data`, `setAttribute`) or as a
 * CSS value typed by ui-style: never as markup, and never as an `on*`
 * attribute.
 */

import {
  PROPERTIES,
  declarationCss,
  typeDeclaration,
} from '@link-foundation/ui-style';
import { cssVariable } from '@link-foundation/ui-tokens';
import { isUnsafeUrl } from '../diagnostics.js';
import { defineKind } from '../kinds.js';
import { atom } from '../model.js';

/** A custom element holding an empty Text node (its label or value). */
function withText(tag, ctx) {
  const node = ctx.document.createElement(tag);
  node.appendChild(ctx.document.createTextNode(''));
  return node;
}

/** Write the text of a property into a Text node (not into markup). */
function setText(textNode, element, name) {
  const value = atom(element, name) ?? '';
  if (textNode.data !== value) {
    textNode.data = value;
  }
}

/** The CSS context of ui-style `declarationCss`: tokens → `var(--…)`. */
function cssContext(prefix = '') {
  const refToVar = (ref, fallback) =>
    `var(${cssVariable(ref.path, prefix)}${fallback === undefined ? '' : `, ${fallback}`})`;
  return {
    refToVar,
    variable: (path) => refToVar({ type: 'token-ref', path }),
  };
}

/**
 * Set one style property of the node from a property of the element,
 * typed by ui-style; an invalid value is reported and left out.
 */
function setStyle(node, element, name, ctx) {
  const css = PROPERTIES[name].css;
  const raws = element.props.get(name);
  if (raws === undefined) {
    node.style.removeProperty(css);
    return;
  }
  const problems = [];
  const decl = typeDeclaration(name, [...raws], {}, problems);
  if (decl === null) {
    node.style.removeProperty(css);
    ctx.diagnostic('invalid-value', 'error', { property: name });
    return;
  }
  node.style.setProperty(
    css,
    declarationCss(decl, cssContext(ctx.options.prefix))
  );
}

defineKind('document', {
  tag: 'ui-document',
  attributes: { theme: 'string', lang: 'string' },
  create: (el, ctx) => ctx.document.createElement('ui-document'),
  update(node, el, changed, ctx) {
    const title = atom(el, 'title');
    if (
      changed.includes('title') &&
      ctx.options.setTitle === true &&
      title !== undefined
    ) {
      ctx.document.title = title;
    }
  },
});

const STACK_STYLES = ['direction', 'gap', 'padding'];

defineKind('stack', {
  tag: 'ui-stack',
  attributes: { direction: 'string', align: 'string' },
  create: (el, ctx) => ctx.document.createElement('ui-stack'),
  update(node, el, changed, ctx) {
    for (const name of STACK_STYLES) {
      if (changed.includes(name)) {
        setStyle(node, el, name, ctx);
      }
    }
  },
});

defineKind('text', {
  tag: 'ui-text',
  childrenSlot: null,
  create: (el, ctx) => withText('ui-text', ctx),
  update(node, el, changed) {
    if (changed.includes('value')) {
      setText(node.firstChild, el, 'value');
    }
  },
});

defineKind('button', {
  tag: 'ui-button',
  childrenSlot: null,
  attributes: { variant: 'string', disabled: 'boolean' },
  // A native button: keyboard activation, focus and the button role for free.
  create(el, ctx) {
    const node = ctx.document.createElement('ui-button');
    const button = withText('button', ctx);
    button.setAttribute('type', 'button');
    node.appendChild(button);
    return node;
  },
  eventTarget: (node) => node.firstChild,
  update(node, el, changed) {
    const button = node.firstChild;
    if (changed.includes('label')) {
      setText(button.firstChild, el, 'label');
    }
    if (changed.includes('disabled')) {
      button.toggleAttribute('disabled', atom(el, 'disabled') === 'true');
    }
  },
});

defineKind('image', {
  tag: 'ui-image',
  childrenSlot: null,
  create(el, ctx) {
    const node = ctx.document.createElement('ui-image');
    node.appendChild(ctx.document.createElement('img'));
    return node;
  },
  update(node, el, changed, ctx) {
    const img = node.firstChild;
    if (changed.includes('source')) {
      const source = atom(el, 'source');
      if (source !== undefined && isUnsafeUrl(source)) {
        ctx.diagnostic('unsafe-url', 'error', { property: 'source' });
        img.removeAttribute('src');
      } else if (source === undefined) {
        img.removeAttribute('src');
      } else {
        img.setAttribute('src', source);
      }
    }
    // An image without alt text is announced by its file name: alt=""
    // marks it decorative instead, and the author gets a diagnostic.
    if (changed.includes('alt') || img.getAttribute('alt') === null) {
      const alt = atom(el, 'alt');
      if (alt === undefined) {
        ctx.diagnostic('missing-alt', 'warning', { property: 'alt' });
      }
      img.setAttribute('alt', alt ?? '');
    }
    for (const name of ['width', 'height']) {
      if (changed.includes(name)) {
        const value = atom(el, name);
        if (value === undefined) {
          img.removeAttribute(name);
        } else {
          img.setAttribute(name, value);
        }
      }
    }
  },
});

/**
 * The fallback of a kind without a renderer (`ui-unknown data-kind="…"`).
 * Not registered under a kind name: the renderer picks it.
 */
export const UNKNOWN_KIND = Object.freeze({
  tag: 'ui-unknown',
  create(el, ctx) {
    const node = ctx.document.createElement('ui-unknown');
    node.setAttribute('data-kind', el.kind ?? '');
    return node;
  },
});
