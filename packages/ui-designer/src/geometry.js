/** Geometry is persisted as typed LiNo properties of the designer vocabulary. */
import { setProperty, selectedRoots } from './commands.js';

export const property = (store, id, name) =>
  store.get(id)?.properties.findLast((p) => p.name === name)?.values[0];
export const coordinate = (store, id, axis) =>
  Number(property(store, id, axis) ?? 0);

/** Apply geometry in both design and run modes; source stays the source of truth. */
export function renderGeometry(store, handle) {
  const visit = (id) => {
    const node = handle.nodeFor(id);
    // The window renderer already applies its numeric geometry in CSS pixels.
    if (node && store.get(id).kind !== 'window') {
      const x = coordinate(store, id, 'x');
      const y = coordinate(store, id, 'y');
      node.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
      for (const size of ['width', 'height']) {
        node.style[size] = String(property(store, id, size) ?? '');
      }
    }
    store.children(id).forEach(visit);
  };
  store.roots().forEach(visit);
}

export function nudgeElements(store, ids, dx, dy) {
  return store.transaction('Nudge elements', () => {
    const roots = selectedRoots(store, ids);
    for (const id of roots) {
      if (dx) {
        setProperty(store, id, 'x', coordinate(store, id, 'x') + dx);
      }
      if (dy) {
        setProperty(store, id, 'y', coordinate(store, id, 'y') + dy);
      }
    }
    return roots;
  });
}

export function resizeElement(store, id, width, height) {
  const unit = store.get(id).kind === 'window' ? '' : 'px';
  return store.transaction('Resize element', () => {
    setProperty(store, id, 'width', `${Math.max(1, Math.round(width))}${unit}`);
    setProperty(
      store,
      id,
      'height',
      `${Math.max(1, Math.round(height))}${unit}`
    );
    return [id];
  });
}
