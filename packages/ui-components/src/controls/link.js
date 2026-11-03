/**
 * `link`: an `<a>` to a URL or to a store element. A plain click
 * dispatches a cancelable `ui-navigate` event `{source, href}`;
 * `mountControls` sends it through the `navigate` action of the actions
 * registry, which rejects `javascript:`, `data:` and `vbscript:` URLs and
 * calls the host's `navigate` (without one the browser follows the
 * link). An unsafe `href` is never written to the DOM (`unsafe-url`).
 *
 *   (docs: link 'Read the docs' (href 'https://example.com/docs') (external true))
 *   (top: link 'Back to top' (href app))
 */

import { isUnsafeUrl } from '@link-foundation/ui-dom';
import {
  atomOf,
  changesOf,
  flagOf,
  isLive,
  partOf,
  setAttr,
  setText,
} from './dom.js';

/** Whether an `href` is a URL (not the ID of a store element). */
export const isUrl = (href) => /[:/#.?]/.test(href);

const hrefs = new WeakMap();

/** Dispatch `ui-navigate` for a plain primary click; cancel it if handled. */
function onClick(event) {
  const a = event.currentTarget;
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const win = a.ownerDocument.defaultView;
  const go = new win.CustomEvent('ui-navigate', {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: Object.freeze({
      source: a.parentNode?.getAttribute('data-link-id') ?? null,
      href: hrefs.get(a) ?? '',
    }),
  });
  if (!a.dispatchEvent(go) || !a.hasAttribute('href')) {
    event.preventDefault();
  }
}

export const LINK_KIND = Object.freeze({
  tag: 'ui-link',
  childrenSlot: null,
  attributes: { external: 'boolean' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-link');
    const a = partOf(doc, 'a', 'root');
    node.appendChild(a);
    if (isLive(ctx)) {
      a.addEventListener('click', onClick);
    }
    return node;
  },
  eventTarget: (node) => node.firstChild,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const a = node.firstChild;
    if (has('label')) {
      setText(a, atomOf(el, 'label') ?? atomOf(el, 'href'));
    }
    if (has('href')) {
      const href = atomOf(el, 'href');
      hrefs.set(a, href);
      const unsafe = href !== undefined && isUnsafeUrl(href);
      if (unsafe) {
        ctx.diagnostic('unsafe-url', 'error', { property: 'href' });
      }
      const target =
        href === undefined || unsafe
          ? undefined
          : isUrl(href)
            ? href
            : `#${href}`;
      setAttr(a, 'href', target);
      setAttr(a, 'aria-disabled', target === undefined ? 'true' : undefined);
      setAttr(a, 'role', target === undefined ? 'link' : undefined);
    }
    if (has('external')) {
      const external = flagOf(el, 'external');
      setAttr(a, 'target', external ? '_blank' : undefined);
      setAttr(a, 'rel', external ? 'noopener noreferrer' : undefined);
    }
  },
});
