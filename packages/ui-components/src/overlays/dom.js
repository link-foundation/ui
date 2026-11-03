/** Shared kind lifecycle, native parts, actions and layer registration. */
import { defineKind, mountDocument } from '@link-foundation/ui-dom';
import { formatLinks } from '@link-foundation/ui-core';
import { createActionRegistry, interpret } from '../behavior/index.js';
import {
  atomOf,
  controllerOf,
  dropController,
  emit,
  idOf,
  isLive,
  layersOf,
  make,
  watchChildren,
} from '../layout/dom.js';
import { SURFACE_MACHINE } from './machines/index.js';
export { atomOf, emit, idOf, make, watchChildren };

export const overlayController = (node) => controllers.get(node);
const controllers = new WeakMap();
const partHandles = new WeakMap();
export function destroyParts(node) {
  (partHandles.get(node) ?? []).forEach(({ handle }) => handle.destroy());
  partHandles.delete(node);
}
const defaultClock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};
export const clockOf = (ctx) => ctx.options.overlays?.clock ?? defaultClock;

export function registerOverlay(kind, create, setup, update = () => {}) {
  defineKind(kind, {
    tag: `ui-${kind}`,
    create: (el, ctx) => create(el, ctx),
    update(node, el, changed, ctx) {
      if (!node.id) {
        node.id = `ui-${kind}-${encodeURIComponent(el.id)}`;
      }
      node.classList.add('ui-overlay');
      node.dataset.kind = kind;
      if (isLive(ctx)) {
        const controller = controllerOf(node, () => setup(node, el, ctx));
        controllers.set(node, controller);
        controller.update?.(el, changed);
      } else {
        update(node, el, ctx);
      }
    },
    destroy(node) {
      dropController(node);
      controllers.delete(node);
    },
  });
}

export function surfaceState(node, ctx, machine = SURFACE_MACHINE) {
  const service = interpret(machine, {
    clock: clockOf(ctx),
    actions: createActionRegistry(),
  });
  node.dataset.state = service.state;
  const unsubscribe = service.subscribe(({ state }) => {
    node.dataset.state = state;
  });
  return {
    service,
    stop() {
      unsubscribe();
      service.stop();
    },
  };
}

export function layerSurface(node, ctx, layer) {
  const manager = layersOf(ctx);
  const id = idOf(node);
  manager.register(id, layer);
  const update = () => {
    node.style.zIndex = String(manager.zIndexOf(id));
  };
  const unsubscribe = manager.subscribe(update);
  update();
  return () => {
    unsubscribe();
    manager.unregister(id);
  };
}

export function listen(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener, options);
}

/** Find a declared anchor by DOM id or stable link id without selector injection. */
export function anchorOf(node, el) {
  const id = atomOf(el, 'anchor');
  const doc = node.ownerDocument;
  const anchor =
    doc.getElementById(id) ??
    [...doc.querySelectorAll('[data-link-id]')].find(
      (item) => item.dataset.linkId === id
    ) ??
    null;
  return anchor?.localName === 'ui-button'
    ? (anchor.querySelector('button') ?? anchor)
    : anchor;
}

/** Render the simple title/body/actions parts used in the dialect example.
 * Rich content can also be supplied as regular rendered children. */
export function contentParts(node, el, onClose, ctx) {
  let title = node.querySelector(':scope > [data-part="title"]');
  if (!title) {
    title = make(ctx.document, 'h2', {
      'data-part': 'title',
      id: `${idOf(node)}-title`,
    });
    node.prepend(title);
  }
  title.textContent = atomOf(el, 'title') ?? atomOf(el, 'label') ?? el.kind;
  node.setAttribute('aria-labelledby', title.id);
  let body = node.querySelector(':scope > [data-part="body"]');
  if (!body) {
    body = make(ctx.document, 'div', { 'data-part': 'body' });
    node.append(body);
  }
  const old = partHandles.get(node) ?? [];
  old.forEach(({ handle }) => handle.destroy());
  body.replaceChildren();
  let actions = node.querySelector(':scope > [data-part="actions"]');
  if (!actions) {
    actions = make(ctx.document, 'div', { 'data-part': 'actions' });
    node.append(actions);
  }
  actions.replaceChildren();
  const handles = [];
  for (const [part, container] of [
    ['body', body],
    ['actions', actions],
  ]) {
    const raw = el.props.get(part) ?? [];
    if (raw.length === 1 && typeof raw[0] === 'string') {
      container.textContent = raw[0];
    } else if (raw.length) {
      handles.push(
        mountDocument(container, formatLinks(raw), {
          ...ctx.options,
          onAction(detail, event) {
            ctx.options.onAction?.(detail, event);
            if (detail.action[0] === 'emit' && detail.action[1] === 'close') {
              onClose();
            }
          },
        })
      );
    }
  }
  partHandles.set(node, handles);
  const close = make(
    ctx.document,
    'button',
    { type: 'button', 'aria-label': 'Close', 'data-part': 'close' },
    'Close'
  );
  close.addEventListener('click', onClose);
  actions.append(close);
}
