/** Native page links share the controls' URL policy and ui-navigate event. */
import { defineKind } from '@link-foundation/ui-dom';
import { LINK_KIND } from '../controls/link.js';
import { atomOf, make, numberOf, setAttr, setText, uid } from './dom.js';

function isModified(event) {
  return (
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function focusAnchor(event) {
  if (event.defaultPrevented || isModified(event)) {
    return;
  }
  const a = event.currentTarget;
  const href = a.getAttribute('href');
  if (!a.closest('ui-section-nav') || !href?.startsWith('#')) {
    return;
  }
  let id;
  try {
    id = decodeURIComponent(href.slice(1));
  } catch {
    return;
  }
  const doc = a.ownerDocument;
  const target =
    doc.getElementById(id) ??
    [...doc.querySelectorAll('[data-link-id]')].find(
      (node) => node.getAttribute('data-link-id') === id
    );
  if (target) {
    event.preventDefault();
    const temporary = !target.hasAttribute('tabindex');
    if (temporary) {
      target.tabIndex = -1;
      target.addEventListener(
        'blur',
        () => target.removeAttribute('tabindex'),
        { once: true }
      );
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    if (doc.defaultView.location.protocol !== 'about:') {
      doc.defaultView.history?.replaceState(null, '', href);
    }
  }
}

function drawCard(a, el, ctx) {
  for (const child of [...a.childNodes]) {
    a.removeChild(child);
  }
  const glyph = make(
    ctx.document,
    'span',
    { 'data-part': 'glyph', 'aria-hidden': 'true' },
    atomOf(el, 'glyph') ?? atomOf(el, 'icon') ?? ''
  );
  const title = make(
    ctx.document,
    'span',
    { 'data-part': 'title' },
    atomOf(el, 'title') ??
      atomOf(el, 'label') ??
      el.positional?.[0] ??
      atomOf(el, 'href')
  );
  const summary = make(
    ctx.document,
    'span',
    { 'data-part': 'summary' },
    atomOf(el, 'summary') ?? ''
  );
  for (const part of [glyph, title, summary]) {
    a.appendChild(part);
  }
}

function linkSpec(card) {
  return {
    tag: card ? 'ui-link-card' : 'ui-nav-link',
    childrenSlot: null,
    eventTarget: (node) => node.firstChild,
    create(el, ctx) {
      const node = ctx.document.createElement(card ? 'ui-link-card' : 'li');
      const link = LINK_KIND.create(el, ctx);
      node.appendChild(link.firstChild);
      if (ctx.document.defaultView) {
        node.firstChild.addEventListener('click', focusAnchor);
      }
      return node;
    },
    update(node, el, changed, ctx) {
      const label = atomOf(el, card ? 'title' : 'label') ?? el.positional?.[0];
      const props = new Map(el.props);
      if (!props.has('label') && label !== undefined) {
        props.set('label', [label]);
      }
      LINK_KIND.update(node, { ...el, props }, changed, ctx);
      if (card) {
        drawCard(node.firstChild, el, ctx);
      }
    },
  };
}

defineKind('nav-link', linkSpec(false));
defineKind('link-card', linkSpec(true));

defineKind('link-cards', {
  tag: 'ui-link-cards',
  create: (el, ctx) => ctx.document.createElement('ui-link-cards'),
  update(node, el) {
    const min = atomOf(el, 'min');
    // CSS.supports is unavailable during static rendering. Accept dimensions
    // only, never a declaration or arbitrary CSS expression.
    const valid = min && /^(?:\d+(?:\.\d+)?)(?:px|rem|em|ch|vw|%)$/.test(min);
    node.style.setProperty('--min', valid ? min : '240px');
  },
});

defineKind('titled-section', {
  tag: 'ui-titled-section',
  childrenSlot: (node) => node.firstChild.children[2],
  create(el, ctx) {
    const node = ctx.document.createElement('ui-titled-section');
    const section = make(ctx.document, 'section');
    const parts = [
      make(ctx.document, 'div', { 'data-part': 'kicker' }),
      make(ctx.document, 'h2', { id: uid('ui-section-title') }),
      make(ctx.document, 'div', { 'data-part': 'content' }),
    ];
    for (const part of parts) {
      section.appendChild(part);
    }
    node.appendChild(section);
    return node;
  },
  update(node, el, changed, ctx) {
    const section = node.firstChild;
    const level = Math.max(
      1,
      Math.min(6, Math.trunc(numberOf(el, 'level', 2)))
    );
    let heading = section.children[1];
    if (heading.localName !== `h${level}`) {
      const next = make(ctx.document, `h${level}`, {
        id: heading.getAttribute('id'),
      });
      section.insertBefore(next, heading);
      section.removeChild(heading);
      heading = next;
    }
    setText(heading, atomOf(el, 'title') ?? el.positional?.[0] ?? 'Section');
    setAttr(section, 'aria-labelledby', heading.getAttribute('id'));
    setText(section.firstChild, atomOf(el, 'kicker'));
    setAttr(section.firstChild, 'hidden', !atomOf(el, 'kicker'));
  },
});
