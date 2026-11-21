import { focusAnchor } from './page-links.js';
import { setAttr } from './dom.js';

function updateEdges(scroller, links, win) {
  const box = scroller.getBoundingClientRect();
  const leftEdge = box.left + scroller.clientLeft;
  const rightEdge = leftEdge + scroller.clientWidth;
  const rtl = win.getComputedStyle(scroller).direction === 'rtl';
  const items = links
    .map((link) => link.getBoundingClientRect())
    .filter(({ width, height }) => width || height);
  const left = items.some((item) => item.left < leftEdge - 1);
  const right = items.some((item) => item.right > rightEdge + 1);
  const more = [rtl ? right : left, rtl ? left : right];
  setAttr(
    scroller,
    'data-more',
    ['start', 'end'].filter((_, i) => more[i]).join(' ') || undefined
  );
}

/** Add route centering, logical overflow edges and section focus to host markup. */
export function attachScrollNavigation(scroller, options = {}) {
  const doc = scroller.ownerDocument;
  const win = doc.defaultView;
  const content = options.content ?? scroller;
  const kind = options.kind === 'section' ? 'location' : 'page';
  const selector = options.linkSelector ?? 'a[href]';
  const links = () => [...content.querySelectorAll(selector)];
  let active = options.active;
  let frame;
  let measured;
  let disconnected = false;

  const edges = () => updateEdges(scroller, links(), win);

  function isCurrent(link) {
    if (active === undefined) {
      return ['true', kind].includes(link.getAttribute('aria-current'));
    }
    return typeof active === 'function'
      ? active(link)
      : active !== null &&
          (link.getAttribute('href') === active ||
            link.closest('[data-link-id]')?.getAttribute('data-link-id') ===
              active);
  }

  function refresh() {
    if (disconnected) {
      return;
    }
    const items = links();
    const current = items.find(isCurrent);
    for (const link of items) {
      setAttr(link, 'aria-current', link === current ? kind : undefined);
    }
    center(current);
    edges();
  }

  function center(current) {
    if (
      !current ||
      !scroller.clientWidth ||
      scroller.scrollWidth <= scroller.clientWidth + 1
    ) {
      measured = undefined;
      return;
    }
    const box = scroller.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    const signature = [
      win.getComputedStyle(scroller).direction,
      scroller.clientWidth,
      scroller.scrollWidth,
      Math.round(item.left - box.left + scroller.scrollLeft),
      Math.round(item.width),
    ].join('/');
    if (
      item.width &&
      (current !== measured?.current || signature !== measured.signature)
    ) {
      scroller.scrollBy?.({
        left:
          item.left +
          item.width / 2 -
          box.left -
          scroller.clientLeft -
          scroller.clientWidth / 2,
        behavior: 'instant',
      });
      measured = { current, signature };
    }
  }

  function schedule() {
    if (!disconnected) {
      win.cancelAnimationFrame(frame);
      frame = win.requestAnimationFrame(refresh);
    }
  }
  function onClick(event) {
    const link = event.target.closest?.(selector);
    if (link && content.contains(link)) {
      focusAnchor(event, link);
    }
  }
  const resize =
    typeof win.ResizeObserver === 'function'
      ? new win.ResizeObserver(schedule)
      : null;
  function observeSizes() {
    resize?.disconnect();
    resize?.observe(scroller);
    if (content !== scroller) {
      resize?.observe(content);
    }
    for (const link of links()) {
      resize?.observe(link);
    }
    schedule();
  }
  const observer = new win.MutationObserver(observeSizes);
  observer.observe(content, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'dir', 'hidden'],
  });
  if (content !== scroller) {
    observer.observe(scroller, {
      attributes: true,
      attributeFilter: ['class', 'style', 'dir', 'hidden'],
    });
  }
  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ['dir'],
  });
  scroller.addEventListener('scroll', edges, { passive: true });
  if (kind === 'location') {
    scroller.addEventListener('click', onClick);
  }
  win.addEventListener('resize', schedule);
  win.addEventListener('pageshow', schedule);
  doc.fonts?.addEventListener('loadingdone', schedule);
  observeSizes();
  refresh();

  return {
    refresh,
    setActive(next) {
      active = next;
      refresh();
    },
    disconnect() {
      disconnected = true;
      win.cancelAnimationFrame(frame);
      observer.disconnect();
      resize?.disconnect();
      scroller.removeEventListener('scroll', edges);
      scroller.removeEventListener('click', onClick);
      win.removeEventListener('resize', schedule);
      win.removeEventListener('pageshow', schedule);
      doc.fonts?.removeEventListener('loadingdone', schedule);
    },
  };
}
