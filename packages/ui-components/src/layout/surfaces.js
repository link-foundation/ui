/**
 * The surfaces of the layout elements: thin kinds over token styles
 * (layout.css), with no behaviour of their own.
 *
 *   (page: container (size medium) ...)
 *   (note: paper (elevation 2) ...)
 *   (plan: card Starter (subtitle 'For one person') (variant outlined) ...)
 *   (top: app-bar Inbox (position sticky) ...)
 *
 * `app-bar` draws a native `<header>`, which is the page's `banner` landmark
 * at page level and a plain group inside `main` or a `section`.
 */

import { defineKind } from '@link-foundation/ui-dom';
import { atomOf, flagOf, make, numberOf, setAttr, setText, uid } from './dom.js';

/** Mirror an enum property as an attribute, `fallback` unless it is valid. */
function setEnum(node, el, name, values, fallback) {
  const value = atomOf(el, name);
  setAttr(node, name, values.includes(value) ? value : fallback);
}

/** Write a text part, hiding it while it has no text; whether it has one. */
function setPartText(part, text) {
  const has = text !== undefined && text !== '';
  setText(part, text);
  setAttr(part, 'hidden', !has);
  return has;
}

defineKind('container', {
  tag: 'ui-container',
  create: (el, ctx) => ctx.document.createElement('ui-container'),
  update(node, el) {
    setEnum(
      node,
      el,
      'size',
      ['extra-small', 'small', 'medium', 'large', 'extra-large', 'full'],
      'large'
    );
    setAttr(node, 'gutters', flagOf(el, 'gutters', true) ? undefined : 'false');
  },
});

defineKind('paper', {
  tag: 'ui-paper',
  create: (el, ctx) => ctx.document.createElement('ui-paper'),
  update(node, el) {
    const level = Math.trunc(numberOf(el, 'elevation', 1));
    setEnum(node, el, 'variant', ['elevated', 'outlined'], 'elevated');
    setAttr(node, 'elevation', String(Math.min(5, Math.max(0, level))));
    setAttr(node, 'square', flagOf(el, 'square'));
  },
});

defineKind('card', {
  tag: 'ui-card',
  childrenSlot: (node) => node.children[1],
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-card');
    const header = make(doc, 'div', { 'data-part': 'header' });
    header.appendChild(
      make(doc, 'div', { 'data-part': 'title', id: uid('ui-card-title') })
    );
    header.appendChild(make(doc, 'div', { 'data-part': 'subtitle' }));
    node.appendChild(header);
    node.appendChild(make(doc, 'div', { 'data-part': 'content' }));
    return node;
  },
  update(node, el) {
    const header = node.firstChild;
    const title = header.firstChild;
    const titled = setPartText(title, atomOf(el, 'title'));
    const subtitled = setPartText(header.children[1], atomOf(el, 'subtitle'));
    setAttr(header, 'hidden', !titled && !subtitled);
    setAttr(node, 'role', titled ? 'group' : undefined);
    setAttr(node, 'aria-labelledby', titled ? title.getAttribute('id') : undefined);
    setEnum(node, el, 'variant', ['elevated', 'filled', 'outlined'], 'elevated');
  },
});

defineKind('app-bar', {
  tag: 'ui-app-bar',
  childrenSlot: (node) => node.firstChild.children[1],
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-app-bar');
    const root = make(doc, 'header', { 'data-part': 'root' });
    root.appendChild(make(doc, 'div', { 'data-part': 'title' }));
    root.appendChild(make(doc, 'div', { 'data-part': 'content' }));
    node.appendChild(root);
    return node;
  },
  update(node, el) {
    setPartText(node.firstChild.firstChild, atomOf(el, 'title'));
    setEnum(node, el, 'position', ['static', 'sticky', 'fixed'], 'static');
    setEnum(node, el, 'tone', ['surface', 'primary'], 'surface');
  },
});
