/** Context menus intercept only their declared target. Selection is separate. */
import {
  anchorOf,
  atomOf,
  clockOf,
  listen,
  make,
  registerOverlay,
} from './dom.js';
import { createMenu } from './menu.js';
import { virtualAnchor } from './position.js';

export function createContextMenu(node, initial, ctx) {
  let el = initial;
  let destroyed = false;
  let timer;
  let origin;
  const clock = clockOf(ctx);
  const detach = [];
  const menu = createMenu(node, el, ctx, { noTrigger: true, manual: true });
  const cancel = () => {
    clock.clearTimeout(timer);
    timer = undefined;
  };
  globalThis.queueMicrotask(() => {
    if (destroyed) {
      return;
    }
    const target = anchorOf(node, el);
    if (!target) {
      return;
    }
    const show = (x, y) => {
      const selection = ctx.options.overlays?.selection?.() ?? [];
      menu.open(virtualAnchor(x, y, target), {
        target: target.closest('[data-link-id]')?.dataset.linkId ?? target.id,
        selection: [...selection],
      });
    };
    const atTarget = () => {
      const rect = target.getBoundingClientRect();
      show(rect.left, rect.bottom);
    };
    detach.push(
      listen(target, 'contextmenu', (event) => {
        event.preventDefault();
        cancel();
        show(event.clientX, event.clientY);
      })
    );
    detach.push(
      listen(target, 'keydown', (event) => {
        if (
          event.key === 'ContextMenu' ||
          (event.key === 'F10' && event.shiftKey)
        ) {
          event.preventDefault();
          atTarget();
        }
      })
    );
    detach.push(
      listen(target, 'pointerdown', (event) => {
        if (event.pointerType !== 'touch') {
          return;
        }
        cancel();
        origin = { x: event.clientX, y: event.clientY };
        timer = clock.setTimeout(
          () => {
            timer = undefined;
            show(origin.x, origin.y);
          },
          Number(atomOf(el, 'long-press') ?? 600)
        );
      })
    );
    detach.push(
      listen(target, 'pointermove', (event) => {
        if (
          origin &&
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10
        ) {
          cancel();
        }
      })
    );
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      detach.push(listen(target, type, cancel));
    }
  });
  return {
    ...menu,
    update(next, changed) {
      el = next;
      menu.update(el, changed);
    },
    disconnect() {
      destroyed = true;
      cancel();
      detach.forEach((fn) => fn());
      menu.disconnect();
    },
  };
}
registerOverlay(
  'context-menu',
  (el, ctx) => make(ctx.document, 'div', { hidden: true }),
  createContextMenu
);
