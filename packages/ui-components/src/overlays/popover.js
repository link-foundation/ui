/** Shared top-layer surface for popovers, menus, context menus and tooltips. */
import { restoreFocus } from '../a11y/index.js';
import {
  anchorOf,
  atomOf,
  emit,
  idOf,
  layerSurface,
  listen,
  make,
  registerOverlay,
  surfaceState,
} from './dom.js';
import { positionFloating } from './position.js';

const openSurfaces = new WeakMap();

function dismissListeners(node, document, stack, state, close, options) {
  const detach = [];
  detach.push(
    listen(document, 'keydown', (event) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        stack.at(-1) === node &&
        state.service.state === 'open'
      ) {
        event.preventDefault();
        close();
      }
    }),
    listen(document, 'pointerdown', (event) => {
      if (
        options.dismissOutside &&
        state.service.state === 'open' &&
        !node.contains(event.target)
      ) {
        close(false);
      }
    })
  );
  return detach;
}

export function createPopover(node, initial, ctx, options = {}) {
  const stack = openSurfaces.get(ctx.document) ?? [];
  openSurfaces.set(ctx.document, stack);
  let el = initial;
  let anchor;
  let previous;
  let cleanupPosition;
  let unlayer;
  let destroyed = false;
  let context = {};
  const detach = [];
  const state = surfaceState(node, ctx);
  const open = (reference, detail = {}) => {
    if (destroyed) {
      return;
    }
    anchor = reference ?? anchorOf(node, el);
    context = detail;
    if (state.service.state === 'open') {
      cleanupPosition?.();
    } else {
      previous = ctx.document.activeElement;
      node.hidden = false;
      if (typeof node.showPopover === 'function') {
        node.showPopover();
      } else {
        unlayer = layerSurface(node, ctx, 'popover');
      }
      state.service.send('open');
      stack.push(node);
    }
    if (anchor) {
      cleanupPosition = positionFloating(anchor, node, {
        placement:
          atomOf(el, 'placement') ??
          (node.parentElement?.getAttribute('role') === 'menuitem'
            ? 'right-start'
            : 'bottom-start'),
        offset: Number(atomOf(el, 'offset') ?? 8),
      });
    }
    trigger()?.setAttribute('aria-expanded', 'true');
    options.onOpen?.(detail);
  };
  const close = (restore = true) => {
    if (state.service.state !== 'open') {
      return;
    }
    cleanupPosition?.();
    cleanupPosition = undefined;
    unlayer?.();
    unlayer = undefined;
    if (
      typeof node.hidePopover === 'function' &&
      node.matches(':popover-open')
    ) {
      node.hidePopover();
    }
    node.hidden = true;
    state.service.send('close');
    stack.splice(stack.indexOf(node), 1);
    trigger()?.setAttribute('aria-expanded', 'false');
    if (restore && options.restore !== false) {
      restoreFocus(previous);
    }
    emit(node, 'ui-close', { source: el.id, ...context });
    options.onClose?.();
  };
  const trigger = () =>
    anchorOf(node, el) ?? (anchor?.nodeType === 1 ? anchor : null);
  node.setAttribute('popover', options.manual ? 'manual' : 'auto');
  detach.push(
    listen(node, 'toggle', (event) => {
      if (
        event.newState === 'closed' &&
        state.service.state === 'open' &&
        !node.matches(':popover-open')
      ) {
        close(false);
      }
    })
  );
  detach.push(
    ...dismissListeners(node, ctx.document, stack, state, close, options)
  );
  globalThis.queueMicrotask(() => {
    if (destroyed) {
      return;
    }
    const target = trigger();
    if (target && !options.noTrigger) {
      target.setAttribute('aria-controls', idOf(node));
      target.setAttribute('aria-expanded', 'false');
      target.setAttribute('aria-haspopup', options.menu ? 'menu' : 'dialog');
      detach.push(
        listen(target, 'click', () =>
          state.service.state === 'open' ? close() : open()
        )
      );
      if (options.menu) {
        detach.push(
          listen(target, 'keydown', (event) => {
            if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
              event.preventDefault();
              open();
              options.focusEdge?.(event.key === 'ArrowUp');
            }
          })
        );
      }
    }
    if (atomOf(el, 'open') === 'true') {
      open();
    }
  });
  return {
    open,
    close,
    service: state.service,
    get context() {
      return context;
    },
    update(next, changed = []) {
      el = next;
      node.setAttribute('aria-label', atomOf(el, 'label') ?? el.kind);
      if (!options.menu && !options.manual) {
        node.setAttribute('role', 'dialog');
        node.tabIndex = -1;
      }
      if (changed.includes('open')) {
        globalThis.queueMicrotask(() => {
          if (!destroyed) {
            atomOf(el, 'open') === 'true' ? open() : close();
          }
        });
      }
    },
    disconnect() {
      destroyed = true;
      close(false);
      state.stop();
      detach.forEach((fn) => fn());
    },
  };
}
registerOverlay(
  'popover',
  (el, ctx) => make(ctx.document, 'div', { hidden: true }),
  (node, el, ctx) => createPopover(node, el, ctx)
);
