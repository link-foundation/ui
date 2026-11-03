/** Pointer capture commits a whole drag, resize or marquee as one transaction. */
import { isLocked } from '@link-foundation/ui-devmode/model';
import { insertElement, moveElements, selectedRoots } from './commands.js';
import { nudgeElements, resizeElement } from './geometry.js';
import { marquee, normalizedRect } from './selection.js';
import { computeSnap } from './snap.js';
import { listen } from './dom.js';
import { dropTarget, ancestorOf } from './drop.js';
import { createCanvasView } from './canvas-view.js';
export { dropTarget } from './drop.js';

function isBlankDocument(context, target, inCanvas, id) {
  return (
    inCanvas &&
    context.store.get(id)?.kind === 'document' &&
    target === context.handle.nodeFor(id)
  );
}

function pointerTarget(context, target) {
  const toolbox = target.closest('[data-component]');
  const resize = target.closest('[data-resize]');
  const row = target.closest('[role=treeitem]');
  if (target.closest('[data-expand]')) {
    return null;
  }
  const inCanvas = context.canvas.contains(target);
  if (!toolbox && !resize && !row && !inCanvas) {
    return null;
  }
  const id =
    resize?.dataset.resize ??
    row?.dataset.id ??
    (inCanvas ? context.handle.idFor(target) : null);
  const blank = !id || isBlankDocument(context, target, inCanvas, id);
  const type = toolbox
    ? 'insert'
    : resize
      ? 'resize'
      : blank
        ? 'marquee'
        : 'move';
  return { toolbox, row, inCanvas, id, type };
}

function start(context, state, event) {
  if (context.mode() !== 'design' || event.button !== 0) {
    return;
  }
  const hit = pointerTarget(context, event.target);
  if (!hit) {
    return;
  }
  const { store, policy, selection, handle, choose, root, canvas } = context;
  const { id, type, toolbox, row, inCanvas } = hit;
  if (id && isLocked(policy, id, store.parentOf)) {
    context.report(`${id} is locked`);
    return;
  }
  const g = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    type,
    component: toolbox?.dataset.component,
    id,
    event,
    active: false,
    drop: null,
    rect: id ? handle.nodeFor(id)?.getBoundingClientRect() : null,
  };
  if (type === 'move' && !selection.ids.has(id)) {
    choose(id, event);
    g.selectedOnStart = true;
  }
  g.ids = selectedRoots(store, selection.ids);
  state.gesture = g;
  if (row) {
    [...context.outline.tree.querySelectorAll('[role=treeitem]')]
      .find((n) => n.dataset.id === id)
      ?.focus();
  } else if (inCanvas) {
    canvas.focus();
  }
  root.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function previewDrop(context, view, g, event, dx, dy) {
  const { store, handle, document } = context;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  // The toolbox and Outline share a dock. Activate a tab under an active
  // drag so the pointer can reach a destination behind the other tab.
  const tab = target?.closest('[role=tab]');
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
  }
  const types =
    g.type === 'insert' ? [g.component] : g.ids.map((id) => store.get(id).kind);
  const drop = dropTarget(context, target, event.clientX, event.clientY, types);
  if (
    drop &&
    g.type === 'move' &&
    g.ids.some(
      (id) => id === drop.parentId || ancestorOf(store, id, drop.parentId)
    )
  ) {
    drop.valid = false;
  }
  g.drop = drop;
  view.showDrop(drop);
  if (g.type !== 'move' || !g.rect) {
    return;
  }
  const parentId = store.parentOf(g.id);
  const siblings = parentId === null ? store.roots() : store.children(parentId);
  const others = siblings
    .filter((id) => !g.ids.includes(id))
    .map((id) => handle.nodeFor(id)?.getBoundingClientRect())
    .filter(Boolean);
  const moving = {
    x: g.rect.x + dx,
    y: g.rect.y + dy,
    width: g.rect.width,
    height: g.rect.height,
  };
  const snap = computeSnap(moving, others, {
    threshold: context.snapThreshold,
  });
  g.delta = { dx: Math.round(dx + snap.dx), dy: Math.round(dy + snap.dy) };
  view.showGuides(snap.guides);
}

function move(context, state, view, event) {
  const g = state.gesture;
  if (!g) {
    view.hover(
      context.mode() === 'design' && context.canvas.contains(event.target)
        ? context.handle.idFor(event.target)
        : null
    );
    return;
  }
  if (g.pointerId !== event.pointerId) {
    return;
  }
  const dx = event.clientX - g.startX;
  const dy = event.clientY - g.startY;
  if (!g.active && Math.hypot(dx, dy) < 4) {
    return;
  }
  g.active = true;
  view.clear();
  if (g.type === 'marquee') {
    g.box = normalizedRect({ x: g.startX, y: g.startY, width: dx, height: dy });
    view.drawBox(g.box, 'designer-marquee');
  } else if (g.type === 'resize') {
    g.size = {
      width: Math.max(1, g.rect.width + dx),
      height: Math.max(1, g.rect.height + dy),
    };
    view.drawBox({ x: g.rect.x, y: g.rect.y, ...g.size }, 'designer-marquee');
  } else {
    previewDrop(context, view, g, event, dx, dy);
  }
}

function selectMarquee(context, g) {
  const { canvas, handle, store, selection } = context;
  const rects = [...canvas.querySelectorAll('[data-link-id]')].map((node) => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { id: handle.idFor(node), x, y, width, height };
  });
  const picked = marquee(rects, g.box).filter(
    (id) => store.get(id).kind !== 'document'
  );
  const leaves = picked.filter(
    (id) =>
      !picked.some((other) => other !== id && ancestorOf(store, id, other))
  );
  selection.replace(
    g.event.shiftKey || g.event.ctrlKey || g.event.metaKey
      ? [...selection.ids, ...leaves]
      : leaves
  );
  context.refresh();
}

function commitGesture(context, g) {
  const { store, run, selection, catalog, refresh } = context;
  if (g.type === 'marquee') {
    selectMarquee(context, g);
    return;
  }
  if (g.type === 'resize') {
    run((s) => resizeElement(s, g.id, g.size.width, g.size.height));
    return;
  }
  if (!g.drop?.valid) {
    context.report('Drop refused: this component cannot contain the selection');
    return;
  }
  if (g.type === 'insert') {
    const ids = run((s) =>
      insertElement(s, { ...g.drop, type: g.component, catalog })
    );
    if (ids) {
      selection.replace(ids);
      refresh();
    }
  } else if (
    g.drop.free &&
    g.ids.every((id) => store.parentOf(id) === g.drop.parentId)
  ) {
    run((s) => nudgeElements(s, g.ids, g.delta.dx, g.delta.dy));
  } else {
    run((s) => moveElements(s, { ...g.drop, ids: g.ids, catalog }));
  }
}

function end(context, state, view, event, cancel = false) {
  const g = state.gesture;
  if (!g || g.pointerId !== event.pointerId) {
    return;
  }
  state.gesture = null;
  if (context.root.hasPointerCapture(event.pointerId)) {
    context.root.releasePointerCapture(event.pointerId);
  }
  view.clearPreview();
  if (cancel) {
    view.update();
    return;
  }
  state.ignoreClick = true;
  if (g.active) {
    commitGesture(context, g);
    view.update();
    return;
  }
  if (g.type === 'move' && !g.selectedOnStart) {
    context.choose(g.id, g.event);
  }
  if (g.type === 'insert') {
    context.insert(g.component);
  }
  if (g.type === 'marquee') {
    context.choose(null);
  }
}

export function mountCanvas(context) {
  const { root, window, canvas, controller } = context;
  const view = createCanvasView(context);
  const state = { gesture: null, ignoreClick: false };
  const cancel = (event) => end(context, state, view, event, true);
  listen(
    root,
    'pointerdown',
    (event) => start(context, state, event),
    controller,
    true
  );
  listen(
    root,
    'pointermove',
    (event) => move(context, state, view, event),
    controller,
    true
  );
  listen(
    root,
    'pointerup',
    (event) => end(context, state, view, event),
    controller,
    true
  );
  listen(root, 'pointercancel', cancel, controller, true);
  listen(root, 'lostpointercapture', cancel, controller, true);
  listen(
    root,
    'click',
    (event) => {
      if (
        context.mode() === 'design' &&
        (canvas.contains(event.target) || state.ignoreClick)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.ignoreClick = false;
      }
    },
    controller,
    true
  );
  listen(window, 'scroll', view.update, controller, true);
  listen(window, 'resize', view.update, controller);
  listen(
    root,
    'keydown',
    (event) => {
      if (event.key === 'Escape' && state.gesture) {
        cancel({ pointerId: state.gesture.pointerId });
      }
    },
    controller
  );
  return {
    update: view.update,
    destroy() {
      if (state.gesture) {
        cancel({ pointerId: state.gesture.pointerId });
      }
      view.destroy();
    },
  };
}
