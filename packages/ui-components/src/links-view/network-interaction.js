import { networkNeighbours } from './network-model.js';

/** Resolve the closest centre/point for both SVG and Canvas, in world space. */
export function hitNetwork(node, state, event) {
  const rect = node.getBoundingClientRect();
  const view = node.view;
  const at = {
    x: (event.clientX - rect.left - view.x) / view.k,
    y: (event.clientY - rect.top - view.y) / view.k,
  };
  let found = null,
    distance = 16 / view.k;
  for (const [id, point] of state.positions) {
    const d = Math.hypot(at.x - point.x, at.y - point.y);
    if (d < distance) {
      distance = d;
      found = id;
    }
  }
  return { id: found, at };
}

export function selectNetwork(node, state, id, additive = false) {
  if (!additive) {
    state.selected.clear();
  }
  if (id !== null) {
    if (additive && state.selected.has(id)) {
      state.selected.delete(id);
    } else {
      state.selected.add(id);
    }
    state.focused = id;
  }
  const text =
    id === null
      ? 'No selection'
      : state.network.links.has(id)
        ? `Link ${id} from ${state.network.links.get(id).source} to ${state.network.links.get(id).target}`
        : `Point ${id}`;
  state.status.textContent = text;
  node.setAttribute('aria-label', `Links network. ${text}`);
  node.dispatchEvent(
    new state.win.CustomEvent('selectionchange', {
      detail: { ids: [...state.selected] },
      bubbles: true,
      composed: true,
    })
  );
  node.dispatchEvent(
    new state.win.CustomEvent('ui-select', {
      detail: {
        item: state.network.links.get(id) ?? state.network.points.get(id),
        ids: [...state.selected],
      },
      bubbles: true,
      composed: true,
    })
  );
  node.requestDraw();
}

export function networkAction(node, state, type, originalEvent) {
  if (type === 'activate') {
    networkAction(node, state, 'ui-activate', originalEvent);
  }
  node.dispatchEvent(
    new state.win.CustomEvent(type, {
      detail: {
        id: state.focused,
        item:
          state.network.links.get(state.focused) ??
          state.network.points.get(state.focused),
        originalEvent,
      },
      bubbles: true,
      composed: true,
    })
  );
}

function directionalNeighbour(node, state, event) {
  const direction = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[event.key];
  if (!direction) {
    return false;
  }
  event.preventDefault();
  if (event.altKey) {
    state.zoom.panBy(-direction[0] * 30, -direction[1] * 30);
    return true;
  }
  if (state.focused === null) {
    selectNetwork(node, state, state.positions.keys().next().value ?? null);
    return true;
  }
  const origin = state.positions.get(state.focused);
  if (!origin) {
    return true;
  }
  let best = null,
    distance = Infinity;
  for (const id of networkNeighbours(state.network, state.focused)) {
    const p = state.positions.get(id);
    if (!p) {
      continue;
    }
    const dx = p.x - origin.x,
      dy = p.y - origin.y;
    const d = Math.hypot(dx, dy);
    if (dx * direction[0] + dy * direction[1] > 0 && d < distance) {
      best = id;
      distance = d;
    }
  }
  if (best !== null) {
    selectNetwork(node, state, best, event.shiftKey);
  }
  return true;
}

function keyNetwork(node, state, event) {
  if (event.ctrlKey || event.metaKey) {
    return;
  }
  if (directionalNeighbour(node, state, event)) {
    return;
  }
  const actions = {
    Enter: () => networkAction(node, state, 'activate', event),
    Escape: () => selectNetwork(node, state, null),
    '+': () => state.zoom.zoomBy(1.25),
    '=': () => state.zoom.zoomBy(1.25),
    '-': () => state.zoom.zoomBy(0.8),
    0: () => state.zoom.reset(),
    Home: () =>
      selectNetwork(node, state, state.positions.keys().next().value ?? null),
    F10: () => {
      if (event.shiftKey) {
        networkAction(node, state, 'networkcontextmenu', event);
      }
    },
  };
  if (Object.hasOwn(actions, event.key)) {
    event.preventDefault();
    actions[event.key]();
  }
}

export function connectNetworkInteraction(node, state, listen) {
  listen(node, 'keydown', (event) => keyNetwork(node, state, event));
  listen(node, 'pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    const hit = hitNetwork(node, state, event);
    if (hit.id === null) {
      state.panning = true;
      state.hovered = null;
      return;
    }
    // These listeners are installed before zoom-pan. Stop the point drag
    // reaching its pan handler while keeping background pan and pinch local.
    event.stopImmediatePropagation();
    node.focus();
    node.setPointerCapture?.(event.pointerId);
    state.drag = { id: hit.id, start: hit.at, moved: false };
  });
  listen(node, 'pointermove', (event) => {
    if (state.panning) {
      return;
    }
    const hit = hitNetwork(node, state, event);
    if (state.drag) {
      event.stopImmediatePropagation();
      const { id, start } = state.drag;
      if (
        Math.hypot(hit.at.x - start.x, hit.at.y - start.y) < 2 &&
        !state.drag.moved
      ) {
        return;
      }
      state.drag.moved = true;
      state.positions.set(id, hit.at);
      state.pins.set(id, hit.at);
      state.runner?.cancel('layout');
      state.shapesDirty = true;
      node.requestDraw();
    } else if (state.hovered !== hit.id) {
      state.hovered = hit.id;
      node.requestDraw();
    }
  });
  const end = (event) => {
    state.panning = false;
    if (!state.drag) {
      return;
    }
    event.stopImmediatePropagation();
    const { id, moved } = state.drag;
    state.drag = null;
    if (node.hasPointerCapture?.(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
    if (!moved && event.type === 'pointerup') {
      selectNetwork(node, state, id, event.shiftKey);
    }
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(node, type, end);
  }
  listen(node, 'pointerleave', () => {
    state.hovered = null;
    node.requestDraw();
  });
  listen(node, 'contextmenu', (event) => {
    const { id } = hitNetwork(node, state, event);
    if (id !== null) {
      state.focused = id;
    }
    event.preventDefault();
    networkAction(node, state, 'networkcontextmenu', event);
  });
}
