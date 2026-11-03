/** Selection overlays, size handles and transient drag decorations. */
import { createOverlay } from '@link-foundation/ui-devmode/overlay';
import { isLocked } from '@link-foundation/ui-devmode/model';
import { property, renderGeometry, resizeElement } from './geometry.js';
import { element } from './dom.js';

export function createCanvasView(context) {
  const {
    root,
    canvas,
    document,
    handle,
    store,
    selection,
    run,
    policy,
    mode,
  } = context;
  const overlay = createOverlay({
    document,
    label: (id, type) => `${id}: ${type}`,
  });
  const decorations = element(document, 'div', {
    class: 'designer-decorations',
    'aria-hidden': true,
  });
  root.append(decorations);
  let resizeHandle = null;
  function update() {
    renderGeometry(store, handle);
    for (const node of canvas.querySelectorAll('[data-link-id]')) {
      node.toggleAttribute(
        'data-selected',
        mode() === 'design' && selection.ids.has(handle.idFor(node))
      );
    }
    const id = [...selection.ids].at(-1);
    const node = mode() === 'design' && id ? handle.nodeFor(id) : null;
    overlay.show(
      'selected',
      node ? { node, id, type: store.get(id).kind } : null
    );
    resizeHandle?.remove();
    resizeHandle = null;
    if (
      node &&
      (property(store, id, 'width') || property(store, id, 'height')) &&
      !isLocked(policy, id, store.parentOf)
    ) {
      const rect = node.getBoundingClientRect();
      resizeHandle = element(document, 'button', {
        class: 'designer-resize',
        'data-resize': id,
        'aria-label': `Resize ${id}; arrows change size, Shift changes by 10 pixels`,
      });
      resizeHandle.style.left = `${rect.right - 6}px`;
      resizeHandle.style.top = `${rect.bottom - 6}px`;
      resizeHandle.addEventListener('keydown', (event) => {
        if (
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
            event.key
          )
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const bounds = handle.nodeFor(id).getBoundingClientRect();
        const step = event.shiftKey ? 10 : 1;
        run((s) =>
          resizeElement(
            s,
            id,
            bounds.width +
              (event.key === 'ArrowRight'
                ? step
                : event.key === 'ArrowLeft'
                  ? -step
                  : 0),
            bounds.height +
              (event.key === 'ArrowDown'
                ? step
                : event.key === 'ArrowUp'
                  ? -step
                  : 0)
          )
        );
        resizeHandle?.focus();
      });
      root.append(resizeHandle);
    }
  }

  function clearPreview() {
    decorations.replaceChildren();
    renderGeometry(store, handle);
  }
  function drawBox(rect, className) {
    const box = element(document, 'div', { class: className });
    Object.assign(box.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    decorations.append(box);
    return box;
  }
  function showGuides(guides) {
    for (const guide of guides) {
      const box = drawBox(
        guide.axis === 'x'
          ? {
              x: guide.position,
              y: guide.from,
              width: 1,
              height: guide.to - guide.from,
            }
          : {
              x: guide.from,
              y: guide.position,
              width: guide.to - guide.from,
              height: 1,
            },
        'designer-guide'
      );
      box.dataset.axis = guide.axis;
    }
  }

  return {
    update,
    clearPreview,
    drawBox,
    showDrop: (drop) => drawDrop(drop, drawBox),
    showGuides,
    clear: () => decorations.replaceChildren(),
    hover(id) {
      const node = id ? handle.nodeFor(id) : null;
      overlay.show(
        'hover',
        node ? { node, id, type: store.get(id)?.kind } : null
      );
    },
    destroy() {
      overlay.destroy();
      decorations.remove();
      resizeHandle?.remove();
    },
  };
}

function drawDrop(drop, drawBox) {
  if (!drop) {
    return;
  }
  const box = drawBox(
    drop.rect,
    `designer-drop ${drop.valid ? 'allowed' : 'refused'}`
  );
  if (drop.edge) {
    if (drop.horizontal) {
      box.style.left = `${drop.edge === 'after' ? drop.rect.right : drop.rect.left}px`;
      box.style.width = '3px';
    } else {
      box.style.top = `${drop.edge === 'after' ? drop.rect.bottom : drop.rect.top}px`;
      box.style.height = '3px';
    }
  }
  box.dataset.drop = drop.valid ? 'allowed' : 'refused';
}
