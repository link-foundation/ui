import { itemKey } from './source.js';

export async function expandTree(
  state,
  item,
  open = !state.expanded.has(itemKey(item))
) {
  const key = itemKey(item);
  if (!item._tree?.branch) {
    return;
  }
  if (!open) {
    state.expanded.delete(key);
    state.refresh();
    return;
  }
  state.expanded.add(key);
  if (
    item.hasChildren &&
    !item.children &&
    !state.loaded.has(key) &&
    !state.pending.has(key)
  ) {
    await loadChildren(state, item, key);
  } else {
    state.refresh();
  }
}

async function loadChildren(state, item, key) {
  const abort = new AbortController();
  state.pending.set(key, abort);
  state.failures.delete(key);
  state.refresh();
  try {
    if (!state.options.loadChildren) {
      throw new Error('No loadChildren adapter');
    }
    const children = await state.options.loadChildren(item, {
      signal: abort.signal,
    });
    if (!state.disposed && !abort.signal.aborted) {
      state.loaded.set(key, children);
    }
  } catch (error) {
    if (!state.disposed && !abort.signal.aborted) {
      state.failures.set(key, String(error.message ?? error));
    }
  } finally {
    state.pending.delete(key);
    if (!state.disposed) {
      state.refresh();
    }
  }
}
