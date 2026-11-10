/** Logical edge detection uses geometry, independent of RTL scrollLeft models. */
import { focusAnchor } from './page-links.js';
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
  const list = nav.firstChild;
  let active;
  let direction;
  let frame;
  let breakpoint;
  let media;
  let el;
  const links = () => [...list.querySelectorAll('a')];
  const edges = () => {
    const items = links();
    const box = nav.getBoundingClientRect();
    const rtl = win.getComputedStyle(nav).direction === 'rtl';
    const left = items.some(
      (a) => a.getBoundingClientRect().left < box.left - 1
    );
    const right = items.some(
      (a) => a.getBoundingClientRect().right > box.right + 1
    );
    const more = [rtl ? right : left, rtl ? left : right]
      .map((value, i) => (value ? ['start', 'end'][i] : ''))
      .filter(Boolean)
      .join(' ');
    setAttr(nav, 'data-more', more || undefined);
  };
  const refresh = () => {
    const items = links();
    const wanted = atomOf(el, 'active');
    const current = items.find(
      (a) =>
        a.closest('[data-link-id]')?.getAttribute('data-link-id') === wanted ||
        a.getAttribute('href') === wanted
    );
    for (const a of items) {
      setAttr(
        a,
        'aria-current',
        a === current
          ? node.localName === 'ui-section-nav'
            ? 'location'
            : 'page'
          : undefined
      );
    }
    const nextDirection = win.getComputedStyle(nav).direction;
    if (
      current &&
      (current !== active || direction !== nextDirection) &&
      nav.scrollWidth > nav.clientWidth + 1
    ) {
      const a = current.getBoundingClientRect();
      const box = nav.getBoundingClientRect();
      nav.scrollBy?.({
        left: (a.left + a.right - box.left - box.right) / 2,
        behavior: 'instant',
      });
    }
    active = current;
    direction = nextDirection;
    edges();
  };
  const schedule = () => {
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(refresh);
  };
  const wrap = () => {
    setAttr(node, 'data-wrapped', media?.matches ?? false);
    schedule();
  };
  const observer = new win.MutationObserver(schedule);
  observer.observe(list, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
  observer.observe(node.ownerDocument.documentElement, {
    attributes: true,
    attributeFilter: ['dir'],
  });
  const resize =
    typeof win.ResizeObserver === 'function'
      ? new win.ResizeObserver(schedule)
      : null;
  resize?.observe(nav);
  resize?.observe(list);
  nav.addEventListener('scroll', edges, { passive: true });
  win.addEventListener('resize', schedule);
  return {
    update(next) {
      el = next;
      const width = atomOf(el, 'wrap-below');
      if (width !== breakpoint) {
        media?.removeEventListener('change', wrap);
        breakpoint = width;
        media = /^\d+(?:\.\d+)?(?:px|rem|em)$/.test(width ?? '')
          ? win.matchMedia?.(`(width < ${width})`)
          : null;
        media?.addEventListener('change', wrap);
      }
      refresh();
      wrap();
    },
    disconnect() {
      win.cancelAnimationFrame(frame);
      observer.disconnect();
      resize?.disconnect();
      media?.removeEventListener('change', wrap);
      nav.removeEventListener('scroll', edges);
      win.removeEventListener('resize', schedule);
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
          a.addEventListener('click', focusAnchor);
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
