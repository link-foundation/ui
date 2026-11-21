/** Logical edge detection uses geometry, independent of RTL scrollLeft models. */
import { attachScrollNavigation } from './scroll-navigation.js';
import { defineKind } from '@link-foundation/ui-dom';
import {
  atomOf,
  controllerOf,
  dropController,
  isLive,
  make,
  setAttr,
  setText,
} from './dom.js';

function createStrip(node) {
  const win = node.ownerDocument.defaultView;
  const nav = node.firstChild;
  const behavior = attachScrollNavigation(nav, {
    content: nav.firstChild,
    kind: node.localName === 'ui-section-nav' ? 'section' : 'page',
  });
  let breakpoint;
  let media;
  const wrap = () => {
    setAttr(node, 'data-wrapped', media?.matches ?? false);
    behavior.refresh();
  };
  return {
    update(next) {
      const width = atomOf(next, 'wrap-below');
      if (width !== breakpoint) {
        media?.removeEventListener('change', wrap);
        breakpoint = width;
        media = /^\d+(?:\.\d+)?(?:px|rem|em)$/.test(width ?? '')
          ? win.matchMedia?.(`(width < ${width})`)
          : null;
        media?.addEventListener('change', wrap);
      }
      behavior.setActive(atomOf(next, 'active') ?? null);
      wrap();
    },
    disconnect() {
      behavior.disconnect();
      media?.removeEventListener('change', wrap);
    },
  };
}

for (const kind of ['nav-strip', 'section-nav']) {
  defineKind(kind, {
    tag: `ui-${kind}`,
    childrenSlot: (node) => node.firstChild.firstChild,
    create(el, ctx) {
      const node = ctx.document.createElement(`ui-${kind}`);
      const nav = make(ctx.document, 'nav');
      nav.appendChild(make(ctx.document, 'ul'));
      node.appendChild(nav);
      return node;
    },
    update(node, el, changed, ctx) {
      const nav = node.firstChild;
      setAttr(
        nav,
        'aria-label',
        atomOf(el, 'label') ?? (kind === 'nav-strip' ? 'Pages' : 'Sections')
      );
      const href = atomOf(el, 'back-to-top');
      let back = nav.querySelector('[data-part="back"]');
      if (kind === 'section-nav' && href?.startsWith('#')) {
        if (!back) {
          back = make(ctx.document, 'li', { 'data-part': 'back' });
          const a = make(ctx.document, 'a');
          back.appendChild(a);
          nav.firstChild.insertBefore(back, nav.firstChild.firstChild);
        }
        setAttr(back.firstChild, 'href', href);
        setAttr(
          back.firstChild,
          'aria-label',
          atomOf(el, 'back-label') ?? 'Back to top'
        );
        setText(back.firstChild, '↑');
      } else {
        back?.remove();
      }
      if (isLive(ctx)) {
        controllerOf(node, () => createStrip(node)).update(el);
      }
    },
    destroy: dropController,
  });
}
