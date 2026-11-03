/**
 * The frame of a floating surface, shared by `window` and the floating
 * panels of a dock: a header that is the drag handle, a body, a resize
 * grip, and a layer of the layer manager.
 *
 * - Dragging the header (pointer events with `setPointerCapture`) moves
 *   the frame; dragging the grip resizes it.
 * - Alt+Arrow moves it by 16px and Alt+Shift+Arrow resizes it, from
 *   anywhere inside the frame.
 * - Escape closes it when it is closable.
 * - The frame always stays inside the viewport: on drag, on resize, and
 *   when the browser window is resized.
 * - A pointer down or focus inside raises it above the other windows.
 */

import { make, uid } from './dom.js';

const STEP = 16;
const MIN_WIDTH = 160;
const MIN_HEIGHT = 96;

const ARROWS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * A rectangle moved and sized so it lies inside the viewport: never wider
 * or taller than the viewport, and with no edge outside it.
 * @param {{x: number, y: number, width: number, height: number}} rect
 * @param {{width: number, height: number}} viewport
 */
export function clampRect(rect, viewport) {
  const width = Math.max(
    Math.min(MIN_WIDTH, viewport.width),
    Math.min(rect.width, viewport.width)
  );
  const height = Math.max(
    Math.min(MIN_HEIGHT, viewport.height),
    Math.min(rect.height, viewport.height)
  );
  const x = Math.min(Math.max(0, rect.x), Math.max(0, viewport.width - width));
  const y = Math.min(
    Math.max(0, rect.y),
    Math.max(0, viewport.height - height)
  );
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** The size of the viewport (without scroll bars). */
export function viewportOf(document) {
  const win = document.defaultView;
  const root = document.documentElement;
  return {
    width: root?.clientWidth || win?.innerWidth || 0,
    height: root?.clientHeight || win?.innerHeight || 0,
  };
}

/**
 * Build a frame in `root`.
 * @param {HTMLElement} root
 * @param {{title: string, closable?: boolean, layers: object,
 *   onClose?: () => void, onChange?: (rect: object) => void,
 *   tools?: HTMLElement[]}} spec
 */
export function createWindowFrame(root, spec) {
  const document = root.ownerDocument;
  const win = document.defaultView;
  const layerId = uid('ui-window');
  const titleId = uid('ui-window-title');
  root.classList.add('ui-window-frame');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', titleId);
  root.tabIndex = -1;

  const header = make(document, 'div', { class: 'ui-window-header' });
  const title = make(document, 'span', {
    id: titleId,
    class: 'ui-window-title',
  });
  const close = make(
    document,
    'button',
    { type: 'button', class: 'ui-window-close' },
    '×'
  );
  close.addEventListener('click', () => spec.onClose?.());
  header.append(title, ...(spec.tools ?? []), close);
  const body = make(document, 'div', { class: 'ui-window-body' });
  const grip = make(document, 'div', {
    class: 'ui-window-grip',
    'aria-hidden': 'true',
  });
  root.prepend(header);
  root.append(body, grip);

  let rect = { x: 0, y: 0, width: 320, height: 240 };
  let closable = spec.closable !== false;

  const draw = () => {
    root.style.setProperty('left', `${rect.x}px`);
    root.style.setProperty('top', `${rect.y}px`);
    root.style.setProperty('width', `${rect.width}px`);
    root.style.setProperty('height', `${rect.height}px`);
  };

  const setRect = (next, notify = true) => {
    const clamped = clampRect({ ...rect, ...next }, viewportOf(document));
    const same = Object.keys(clamped).every((k) => clamped[k] === rect[k]);
    rect = clamped;
    draw();
    if (notify && !same) {
      spec.onChange?.({ ...rect });
    }
  };

  const layers = spec.layers;
  layers.register(layerId, 'window');
  const paint = () =>
    root.style.setProperty('z-index', String(layers.zIndexOf(layerId)));
  const unsubscribe = layers.subscribe(paint);
  paint();
  const raise = () => layers.raise(layerId);
  root.addEventListener('pointerdown', raise, true);
  root.addEventListener('focusin', raise);

  /** A pointer drag of `handle` that changes the rect by `change`. */
  const dragWith = (handle, change) => {
    let start = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest?.('button')) {
        return;
      }
      handle.setPointerCapture?.(event.pointerId);
      start = { id: event.pointerId, x: event.clientX, y: event.clientY, rect };
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (start?.id === event.pointerId) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        setRect(change(start.rect, dx, dy), false);
      }
    });
    const end = (event) => {
      if (start?.id === event.pointerId) {
        handle.releasePointerCapture?.(event.pointerId);
        start = null;
        spec.onChange?.({ ...rect });
      }
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };
  dragWith(header, (r, dx, dy) => ({ x: r.x + dx, y: r.y + dy }));
  dragWith(grip, (r, dx, dy) => ({
    width: r.width + dx,
    height: r.height + dy,
  }));

  root.addEventListener('keydown', (event) => {
    const arrow = ARROWS[event.key];
    if (arrow !== undefined && event.altKey) {
      const [dx, dy] = arrow;
      setRect(
        event.shiftKey
          ? { width: rect.width + dx * STEP, height: rect.height + dy * STEP }
          : { x: rect.x + dx * STEP, y: rect.y + dy * STEP }
      );
    } else if (event.key === 'Escape' && closable) {
      spec.onClose?.();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });

  const onResize = () => setRect({}, true);
  win.addEventListener('resize', onResize);

  const frame = {
    root,
    header,
    body,
    get rect() {
      return { ...rect };
    },
    setRect,
    raise,
    layerId,
    setTitle(text) {
      title.textContent = text;
      close.setAttribute('aria-label', `Close ${text}`);
    },
    setClosable(on) {
      closable = on;
      close.hidden = !on;
    },
    disconnect() {
      win.removeEventListener('resize', onResize);
      unsubscribe();
      layers.unregister(layerId);
    },
  };
  frame.setTitle(spec.title);
  frame.setClosable(closable);
  return frame;
}
