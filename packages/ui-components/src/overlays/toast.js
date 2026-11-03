/** Toasts do not focus themselves; each has a close button and pausable time. */
import { announce } from '../a11y/index.js';
import {
  atomOf,
  clockOf,
  emit,
  layerSurface,
  listen,
  make,
  registerOverlay,
  watchChildren,
} from './dom.js';
import { createToastQueue } from './toast-queue.js';

export function createToaster(node, initial, ctx) {
  let destroyed = false;
  let unlayer;
  const attached = new Map();
  const seen = new WeakSet();
  const max = Math.max(1, Math.floor(Number(atomOf(initial, 'max') ?? 3)) || 3);
  const token = ctx.document.defaultView
    .getComputedStyle(node)
    .getPropertyValue('--ui-toast-duration')
    .trim();
  const tokenDuration = token.endsWith('ms')
    ? parseFloat(token)
    : token.endsWith('s')
      ? parseFloat(token) * 1000
      : Number(token) || 5000;
  const queue = createToastQueue({
    max,
    duration: tokenDuration,
    clock: clockOf(ctx),
    onChange(entries) {
      for (const entry of entries) {
        entry.node.hidden = entry.service.state === 'queued';
        if (!entry.node.hidden && !seen.has(entry.node)) {
          seen.add(entry.node);
          // Visible content uses aria-live=off; the shared region announces it.
          announce(
            entry.node.querySelector('[data-part="message"]')?.textContent ??
              '',
            {
              document: ctx.document,
              politeness: entry.node.dataset.politeness,
            }
          );
        }
      }
    },
  });
  const refresh = () => {
    if (destroyed) {
      return;
    }
    for (const child of [...node.children].filter(
      (item) => item.dataset.kind === 'toast'
    )) {
      if (attached.has(child)) {
        continue;
      }
      const id = child.id;
      const detach = [
        listen(child, 'pointerenter', () => queue.pause(id, 'hover')),
        listen(child, 'pointerleave', () => queue.resume(id, 'hover')),
        listen(child, 'focusin', () => queue.pause(id, 'focus')),
        listen(child, 'focusout', (event) => {
          if (!child.contains(event.relatedTarget)) {
            queue.resume(id, 'focus');
          }
        }),
        listen(child, 'ui-close', () => queue.close(id)),
      ];
      attached.set(child, detach);
      queue.push(id, {
        node: child,
        duration: child.dataset.duration,
        onClose: () => {
          child.hidden = true;
          emit(node, 'toast-dismiss', { id });
        },
      });
    }
    for (const [child, detach] of attached) {
      if (!node.contains(child)) {
        detach.forEach((fn) => fn());
        attached.delete(child);
        queue.close(child.id);
      }
    }
    observer.takeRecords();
  };
  node.setAttribute('popover', 'manual');
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'off');
  node.setAttribute('aria-label', 'Notifications');
  const observer = watchChildren(node, refresh);
  globalThis.queueMicrotask(() => {
    if (destroyed) {
      return;
    }
    if (typeof node.showPopover === 'function') {
      node.showPopover();
    } else {
      unlayer = layerSurface(node, ctx, 'toast');
    }
    refresh();
  });
  return {
    queue,
    update() {
      globalThis.queueMicrotask(refresh);
    },
    disconnect() {
      destroyed = true;
      observer.disconnect();
      queue.disconnect();
      unlayer?.();
      if (
        typeof node.hidePopover === 'function' &&
        node.matches(':popover-open')
      ) {
        node.hidePopover();
      }
      for (const detach of attached.values()) {
        detach.forEach((fn) => fn());
      }
    },
  };
}
registerOverlay(
  'toaster',
  (el, ctx) => make(ctx.document, 'div'),
  createToaster
);
registerOverlay(
  'toast',
  (el, ctx) => make(ctx.document, 'div', { hidden: true }),
  (node, initial, ctx) => ({
    update(el) {
      node.dataset.politeness =
        atomOf(el, 'politeness') === 'assertive' ? 'assertive' : 'polite';
      if (atomOf(el, 'duration') !== undefined) {
        node.dataset.duration = atomOf(el, 'duration');
      }
      let message = node.querySelector('[data-part="message"]');
      if (!message) {
        message = make(ctx.document, 'span', { 'data-part': 'message' });
        const close = make(
          ctx.document,
          'button',
          { type: 'button', 'aria-label': 'Dismiss notification' },
          '×'
        );
        close.addEventListener('click', () =>
          emit(node, 'ui-close', { source: el.id })
        );
        node.append(message, close);
      }
      message.textContent = atomOf(el, 'label') ?? el.positional[0] ?? '';
    },
  })
);
