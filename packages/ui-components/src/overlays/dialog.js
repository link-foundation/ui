/** Modal dialog and alert dialog, backed by the browser's top layer. */
import { restoreFocus, trapFocus } from '../a11y/index.js';
import {
  atomOf,
  contentParts,
  destroyParts,
  emit,
  layerSurface,
  listen,
  make,
  registerOverlay,
  surfaceState,
} from './dom.js';

export function createDialog(node, initial, ctx) {
  let el = initial;
  let previous;
  let release;
  let unlayer;
  let destroyed = false;
  const state = surfaceState(node, ctx);
  const modal = () => el.kind !== 'drawer' || atomOf(el, 'modal') !== 'false';
  const close = () => {
    if (state.service.state !== 'open') {
      return;
    }
    release?.();
    release = undefined;
    if (node.open) {
      if (typeof node.close === 'function') {
        node.close();
      } else {
        node.removeAttribute('open');
      }
    }
    node.hidden = true;
    unlayer?.();
    unlayer = undefined;
    state.service.send('close');
    restoreFocus(previous);
    emit(node, 'ui-close', { source: el.id });
  };
  const open = () => {
    if (destroyed || state.service.state === 'open') {
      return;
    }
    previous = ctx.document.activeElement;
    node.hidden = false;
    node.setAttribute('aria-modal', String(modal()));
    if (modal() && typeof node.showModal === 'function') {
      node.showModal();
      release = trapFocus(node, { restore: false });
    } else {
      node.setAttribute('open', '');
      unlayer = layerSurface(node, ctx, modal() ? 'modal' : 'dock');
      if (modal()) {
        release = trapFocus(node, { restore: false });
      } else {
        node.querySelector('button')?.focus();
      }
    }
    state.service.send('open');
  };
  const detach = [
    listen(node, 'cancel', (event) => {
      event.preventDefault();
      close();
    }),
    listen(node, 'close', () => {
      if (!node.open) {
        close();
      }
    }),
    listen(node, 'keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }),
  ];
  return {
    open,
    close,
    service: state.service,
    update(next) {
      el = next;
      node.setAttribute(
        'role',
        el.kind === 'alert-dialog' ? 'alertdialog' : 'dialog'
      );
      node.dataset.side = atomOf(el, 'side') ?? 'right';
      contentParts(node, el, close, ctx);
      if (atomOf(el, 'open') === 'true') {
        globalThis.queueMicrotask(open);
      } else if (atomOf(el, 'open') === 'false') {
        close();
      } else if (state.service.state === 'closed') {
        node.hidden = true;
      }
    },
    disconnect() {
      destroyed = true;
      close();
      destroyParts(node);
      state.stop();
      detach.forEach((fn) => fn());
    },
  };
}
for (const kind of ['dialog', 'alert-dialog']) {
  registerOverlay(
    kind,
    (el, ctx) => make(ctx.document, 'dialog', { hidden: true }),
    createDialog
  );
}
