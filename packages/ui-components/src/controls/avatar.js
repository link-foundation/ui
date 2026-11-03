/**
 * `avatar`: a person's picture, or their initials when there is no
 * picture (or it fails to load). The picture is an `<img alt=NAME>`; the
 * initials are `role=img` with the name as `aria-label`, so the name is
 * read once either way. A `source` with an unsafe scheme is never loaded.
 *
 *   (me: avatar 'Ada Lovelace' (source 'https://example.com/ada.png'))
 *   (you: avatar 'Grace Hopper')
 */

import { isUnsafeUrl } from '@link-foundation/ui-dom';
import { atomOf, changesOf, isLive, partOf, setAttr, setText } from './dom.js';

/** The initials of a name: the first letters of its first and last words. */
export function initialsOf(name) {
  const words = String(name ?? '')
    .trim()
    .split(/[\s\-_.]+/u)
    .filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const first = [...words[0]][0];
  const last = words.length > 1 ? [...words.at(-1)][0] : '';
  return (first + last).toLocaleUpperCase();
}

/** Show the picture, or the initials when it is missing or broken. */
function show(node, picture) {
  const [root] = node.children;
  const [image, initials] = root.children;
  const name = node.getAttribute('data-name') ?? '';
  image.toggleAttribute('hidden', !picture);
  initials.toggleAttribute('hidden', picture);
  setAttr(root, 'role', picture ? undefined : 'img');
  setAttr(root, 'aria-label', picture ? undefined : name);
}

export const AVATAR_KIND = Object.freeze({
  tag: 'ui-avatar',
  childrenSlot: null,
  attributes: { size: 'string' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-avatar');
    const root = partOf(doc, 'span', 'root');
    const image = partOf(doc, 'img', 'image', { alt: '', hidden: '' });
    const initials = partOf(doc, 'span', 'label', { 'aria-hidden': 'true' });
    root.appendChild(image);
    root.appendChild(initials);
    node.appendChild(root);
    if (isLive(ctx)) {
      image.addEventListener('error', () => show(node, false));
    }
    return node;
  },
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const [image, initials] = node.firstChild.children;
    const name = atomOf(el, 'name') ?? '';
    if (has('name')) {
      node.setAttribute('data-name', name);
      setAttr(image, 'alt', name);
      setText(initials, initialsOf(name));
      if (name === '') {
        ctx.diagnostic('missing-label', 'error', { property: 'name' });
      }
    }
    if (has('name') || has('source')) {
      const src = atomOf(el, 'source');
      const unsafe = src !== undefined && isUnsafeUrl(src);
      if (unsafe) {
        ctx.diagnostic('unsafe-url', 'error', { property: 'source' });
      }
      const picture = src !== undefined && !unsafe;
      setAttr(image, 'src', picture ? src : undefined);
      show(node, picture);
    }
  },
});
