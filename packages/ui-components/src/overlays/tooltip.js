/** Hover/focus tooltip: delayed open, hoverable content and Escape dismissal. */
import {
  anchorOf,
  atomOf,
  listen,
  make,
  registerOverlay,
  surfaceState,
} from './dom.js';
import { createPopover } from './popover.js';
import { TOOLTIP_MACHINE } from './machines/index.js';

export function createTooltip(node, initial, ctx) {
  let el = initial;
  let destroyed = false;
  let focused = false;
  let hovered = false;
  const detach = [];
  const state = surfaceState(node, ctx, TOOLTIP_MACHINE);
  const popup = createPopover(node, el, ctx, {
    manual: true,
    noTrigger: true,
    restore: false,
    onClose: () => state.service.send('close'),
  });
  const sync = () => {
    if (state.service.state === 'open' || state.service.state === 'closing') {
      popup.open();
    } else {
      popup.close(false);
    }
  };
  const unsubscribe = state.service.subscribe(sync);
  const enter = () => state.service.send('enter');
  const leave = () => {
    if (!hovered && !focused) {
      state.service.send('leave');
    }
  };
  globalThis.queueMicrotask(() => {
    if (destroyed) {
      return;
    }
    const anchor = anchorOf(node, el);
    if (!anchor) {
      return;
    }
    const old = anchor.getAttribute('aria-describedby');
    anchor.setAttribute(
      'aria-describedby',
      [old, node.id].filter(Boolean).join(' ')
    );
    detach.push(() =>
      old === null
        ? anchor.removeAttribute('aria-describedby')
        : anchor.setAttribute('aria-describedby', old)
    );
    for (const target of [anchor, node]) {
      detach.push(
        listen(target, 'pointerenter', () => {
          hovered = true;
          enter();
        })
      );
      detach.push(
        listen(target, 'pointerleave', () => {
          hovered = false;
          leave();
        })
      );
    }
    detach.push(
      listen(anchor, 'focusin', () => {
        focused = true;
        enter();
      })
    );
    detach.push(
      listen(anchor, 'focusout', () => {
        focused = false;
        leave();
      })
    );
  });
  return {
    open: () => {
      enter();
    },
    close: () => state.service.send('close'),
    service: state.service,
    update(next) {
      el = next;
      popup.update(el);
      node.setAttribute('role', 'tooltip');
      node.textContent = atomOf(el, 'label') ?? atomOf(el, 'value') ?? '';
    },
    disconnect() {
      destroyed = true;
      unsubscribe();
      state.stop();
      popup.disconnect();
      detach.forEach((fn) => fn());
    },
  };
}
registerOverlay(
  'tooltip',
  (el, ctx) => make(ctx.document, 'div', { hidden: true }),
  createTooltip
);
