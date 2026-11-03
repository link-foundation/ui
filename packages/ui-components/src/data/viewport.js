import {
  anchorScrollTop,
  indexAt,
  listOffsets,
  listRange,
} from './virtual-range.js';
import { itemKey } from './source.js';

/**
 * One observer for the viewport and all mounted rows. Observer writes are
 * deferred to a frame, avoiding WebKit's ResizeObserver feedback loop.
 * Rows are keyed and reconciled in place, including the focused row outside
 * the overscan range. Measurements survive reorder/prepend by item key.
 */
export function createViewport(
  root,
  body,
  { estimate = 32, virtualized = true, draw, changed }
) {
  const win = root.ownerDocument.defaultView;
  const heights = new Map();
  const mounted = new Map();
  let items = [];
  let offsets = new Float64Array([0]);
  let active = null;
  let frame = null;
  let disposed = false;
  const pending = new Map();
  const keys = () => items.map(itemKey);
  const snapshot = () => ({ keys: keys(), offsets, scrollTop: root.scrollTop });
  const rebuild = () => {
    const measured = new Map();
    items.forEach((item, i) => {
      if (heights.has(itemKey(item))) {
        measured.set(i, heights.get(itemKey(item)));
      }
    });
    offsets = listOffsets({ count: items.length, estimate, measured });
    body.style.height = `${offsets.at(-1)}px`;
  };
  const anchorKey = () =>
    itemKey(items[indexAt(offsets, root.scrollTop)] ?? { id: '' });
  const schedule = () => {
    if (frame !== null || disposed) {
      return;
    }
    frame = win.requestAnimationFrame(() => {
      frame = null;
      if (disposed) {
        return;
      }
      const before = snapshot();
      const anchor = anchorKey();
      const resized = applyMeasurements(pending, heights, mounted);
      if (resized) {
        rebuild();
        root.scrollTop = anchorScrollTop(before, snapshot(), anchor);
      }
      render();
    });
  };
  const observer =
    typeof win.ResizeObserver === 'function'
      ? new win.ResizeObserver((entries) => {
          queueMeasurements(entries, root, pending);
          schedule();
        })
      : null;
  observer?.observe(root);

  function render() {
    if (disposed) {
      return;
    }
    const focused = root.ownerDocument.activeElement;
    const restoreFocus = body.contains(focused);
    const wanted = wantedIndices(root, items, offsets, virtualized, active);
    pruneRows(items, wanted, mounted, observer);
    let previous = null;
    for (const i of [...wanted].sort((a, b) => a - b)) {
      const item = items[i];
      const key = itemKey(item);
      let row = mounted.get(key);
      if (!row) {
        row = root.ownerDocument.createElement('div');
        row.className = 'ui-data-row';
        row.dataset.key = key;
        mounted.set(key, row);
        observer?.observe(row);
      }
      draw(row, item, i);
      row.style.position = 'absolute';
      row.style.top = `${offsets[i]}px`;
      row.style.minHeight = `${estimate}px`;
      if (row.previousElementSibling !== previous || row.parentNode !== body) {
        body.insertBefore(
          row,
          previous ? previous.nextSibling : body.firstChild
        );
      }
      previous = row;
    }
    // Moving an existing DOM node blurs it in browsers without moveBefore.
    if (
      restoreFocus &&
      focused.isConnected &&
      root.ownerDocument.activeElement !== focused
    ) {
      focused.focus({ preventScroll: true });
    }
    changed?.();
  }
  root.addEventListener('scroll', schedule, { passive: true });
  return {
    render,
    setActive(key) {
      active = key;
    },
    setItems(next) {
      const before = snapshot();
      const anchor = anchorKey();
      items = next;
      const present = new Set(keys());
      for (const key of heights.keys()) {
        if (!present.has(key)) {
          heights.delete(key);
        }
      }
      rebuild();
      root.scrollTop = anchorScrollTop(before, snapshot(), anchor);
      render();
    },
    scrollTo(index) {
      if (index < 0 || index >= items.length) {
        return;
      }
      const top = offsets[index];
      const bottom = offsets[index + 1];
      const height = (root.clientHeight || 320) - body.offsetTop;
      if (top < root.scrollTop) {
        root.scrollTop = top;
      } else if (bottom > root.scrollTop + height) {
        root.scrollTop = bottom - height;
      }
      render();
    },
    row: (key) => mounted.get(key),
    disconnect() {
      disposed = true;
      observer?.disconnect();
      root.removeEventListener('scroll', schedule);
      if (frame !== null) {
        win.cancelAnimationFrame(frame);
      }
      mounted.clear();
      pending.clear();
      heights.clear();
    },
  };
}

function wantedIndices(root, items, offsets, virtualized, active) {
  const { start, end } = virtualized
    ? listRange(offsets, root.scrollTop, root.clientHeight || 320)
    : { start: 0, end: items.length };
  const wanted = new Set();
  for (let i = start; i < end; i++) {
    wanted.add(i);
  }
  const focused = root.ownerDocument.activeElement?.closest?.('[data-key]');
  for (const key of [active, focused?.dataset.key]) {
    const index = items.findIndex((item) => itemKey(item) === key);
    if (index >= 0) {
      wanted.add(index);
    }
  }

  return wanted;
}

function pruneRows(items, wanted, mounted, observer) {
  const kept = new Set([...wanted].map((i) => itemKey(items[i])));
  for (const [key, row] of mounted) {
    if (!kept.has(key)) {
      observer?.unobserve(row);
      row.remove();
      mounted.delete(key);
    }
  }
}

function queueMeasurements(entries, root, pending) {
  for (const entry of entries) {
    if (entry.target !== root) {
      pending.set(
        entry.target,
        entry.borderBoxSize?.[0]?.blockSize ??
          entry.target.getBoundingClientRect().height
      );
    }
  }
}

function applyMeasurements(pending, heights, mounted) {
  let resized = false;
  for (const [row, height] of pending) {
    const key = row.dataset.key;
    if (height > 0 && heights.get(key) !== height && mounted.get(key) === row) {
      heights.set(key, height);
      resized = true;
    }
  }
  pending.clear();

  return resized;
}
