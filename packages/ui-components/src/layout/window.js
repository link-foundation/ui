/**
 * `window`: a floating, movable and resizable surface (a non-modal
 * `role="dialog"`).
 *
 *   (inspector: window (title Inspector) (open false)
 *     (x 120) (y 96) (width 360) (height 280) ...)
 *
 * The header is the drag handle; Alt+Arrow moves the window and
 * Alt+Shift+Arrow resizes it (see `window-frame.js`). The window is kept
 * inside the viewport on drag and when the browser window is resized, and
 * it is raised above the other windows by the layer manager of the render
 * (`options.layout.layers`, else one shared by the document).
 *
 * `(open true)` shows the window and focuses it; the element that had the
 * focus is its opener. The close button and Escape hide it, give the focus
 * back to the opener and send `window-close` (`detail.id`); the
 * application writes `(open false)` to its store then. Every move and
 * resize sends `window-change` with `detail.rect`.
 */

import { defineKind } from '@link-foundation/ui-dom';
import {
  atomOf,
  controllerOf,
  dropController,
  emit,
  findController,
  isLive,
  layersOf,
  make,
  numberOf,
} from './dom.js';
import { createWindowFrame } from './window-frame.js';

const DEFAULTS = { x: 48, y: 48, width: 360, height: 240 };

const bodies = new WeakMap();

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function createWindow(node, ctx) {
  const state = { id: null, open: false, opener: null, started: false };

  const hide = () => {
    if (!state.open) {
      return;
    }
    state.open = false;
    node.hidden = true;
    const opener = state.opener;
    state.opener = null;
    if (opener?.isConnected) {
      opener.focus();
    }
    emit(node, 'window-close', { id: state.id });
  };

  const frame = createWindowFrame(node, {
    title: '',
    layers: layersOf(ctx),
    onClose: hide,
    onChange: (rect) => emit(node, 'window-change', { id: state.id, rect }),
  });
  bodies.set(node, frame.body);

  const show = (focus) => {
    if (state.open) {
      return;
    }
    state.open = true;
    const active = ctx.document.activeElement;
    state.opener = active !== null && !node.contains(active) ? active : null;
    node.hidden = false;
    frame.raise();
    frame.setRect({});
    if (focus) {
      const first = frame.body.querySelector(FOCUSABLE);
      (first ?? node).focus();
    }
  };

  return {
    state,
    frame,
    show,
    hide,
    update(el, changed) {
      state.id = el.id;
      if (changed.includes('title') || !state.started) {
        frame.setTitle(atomOf(el, 'title') ?? el.name ?? 'Window');
      }
      if (changed.includes('closable')) {
        frame.setClosable(atomOf(el, 'closable') !== 'false');
      }
      const geometry = ['x', 'y', 'width', 'height'].filter((n) =>
        changed.includes(n)
      );
      if (geometry.length > 0 || !state.started) {
        const rect = {};
        for (const name of ['x', 'y', 'width', 'height']) {
          if (geometry.includes(name) || !state.started) {
            rect[name] = numberOf(el, name, DEFAULTS[name]);
          }
        }
        frame.setRect(rect, false);
      }
      if (changed.includes('open') || !state.started) {
        if (atomOf(el, 'open') === 'false') {
          node.hidden = true;
          state.open = false;
        } else {
          // A window open from the start does not take the focus.
          show(state.started);
        }
      }
      state.started = true;
    },
    disconnect: () => frame.disconnect(),
  };
}

defineKind('window', {
  tag: 'ui-window',
  childrenSlot: (node) => bodies.get(node) ?? node,
  create(el, ctx) {
    const node = ctx.document.createElement('ui-window');
    if (!isLive(ctx)) {
      const body = make(ctx.document, 'div', { class: 'ui-window-body' });
      node.appendChild(body);
      bodies.set(node, body);
    }
    return node;
  },
  update(node, el, changed, ctx) {
    if (isLive(ctx)) {
      controllerOf(node, () => createWindow(node, ctx)).update(el, changed);
    } else if (atomOf(el, 'open') === 'false') {
      node.setAttribute('hidden', '');
    }
  },
  destroy: (node) => dropController(node),
});

/** The controller of a rendered window (for tests and tools). */
export const windowController = (node) => findController(node);
