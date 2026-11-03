/**
 * The highlight overlay: a box over the hovered element and one over the
 * selected element, each labelled `id: type`. The boxes live in a shadow
 * root of a fixed host above the page, take no pointer events, follow the
 * element on scroll, resize and re-render, and do not animate when the user
 * prefers reduced motion.
 */

const OVERLAY_CSS = `
:host { all: initial; position: fixed; inset: 0; pointer-events: none;
  z-index: 2147483646; }
.box { position: fixed; box-sizing: border-box; pointer-events: none;
  border: 2px solid #1a56db; background: rgb(26 86 219 / 0.08);
  transition: top 80ms ease-out, left 80ms ease-out, width 80ms ease-out,
    height 80ms ease-out; }
.box[hidden] { display: none; }
.box.selected { border-color: #b3261e; background: transparent;
  border-style: dashed; }
.label { position: absolute; left: -2px; bottom: 100%; padding: 1px 6px;
  font: 600 12px/18px system-ui, sans-serif; white-space: nowrap;
  color: #fff; background: #1a56db; border-radius: 3px 3px 0 0; }
.box.selected .label { background: #b3261e; }
.box.below .label { bottom: auto; top: 100%; border-radius: 0 0 3px 3px; }
@media (prefers-reduced-motion: reduce) { .box { transition: none; } }
@media (forced-colors: active) { .box { border-color: Highlight; }
  .label { forced-color-adjust: none; } }
`;

/**
 * Create the overlay.
 * @param {{ document: Document, label: (id: string, type: string) => string }} options
 * @returns {{ host: HTMLElement, show: (which: 'hover'|'selected',
 *   target: { node: Element, id: string, type: string }|null) => void,
 *   update: () => void, destroy: () => void }}
 */
export function createOverlay({ document, label }) {
  const host = document.createElement('ui-devmode-overlay');
  host.setAttribute('aria-hidden', 'true');
  host.dataset.uiDevmode = 'overlay';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = OVERLAY_CSS;
  shadow.append(style);
  const boxes = {};
  const targets = { hover: null, selected: null };
  for (const which of ['selected', 'hover']) {
    const box = document.createElement('div');
    box.className = which === 'hover' ? 'box hover' : 'box selected';
    box.dataset.box = which;
    box.hidden = true;
    const text = document.createElement('span');
    text.className = 'label';
    box.append(text);
    shadow.append(box);
    boxes[which] = box;
  }
  document.body.append(host);

  const place = (which) => {
    const box = boxes[which];
    const target = targets[which];
    if (!target || !target.node.isConnected) {
      box.hidden = true;
      return;
    }
    const rect = target.node.getBoundingClientRect();
    box.hidden = false;
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    // The label sits above the box, or inside the top when there is no room.
    box.classList.toggle('below', rect.top < 20);
    box.firstChild.textContent = label(target.id, target.type);
  };

  return {
    host,
    show(which, target) {
      targets[which] = target;
      place(which);
    },
    update() {
      place('selected');
      place('hover');
    },
    destroy() {
      host.remove();
    },
  };
}
