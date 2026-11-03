function focusMessage(at, event, state, keys) {
  const { messages, viewport, selection } = state;
  const next = Math.max(0, Math.min(messages.length - 1, at));
  state.active = keys[next];
  viewport.setActive(state.active);
  viewport.scrollTo(next);
  viewport.render();
  viewport.row(state.active)?.focus({ preventScroll: true });
  if (event.shiftKey) {
    selection.select(state.active, { range: true, keys });
    viewport.render();
  }
}

/** Keyboard actions never intercept keys from the composer or bubble controls. */
export function streamKeydown(event, state) {
  const { viewport, messages, selection, root, actions } = state;
  const row = event.target.closest?.('[data-message]');
  if (!row || event.target !== row) {
    return;
  }
  const keys = messages.map((m) => m.id);
  const index = keys.indexOf(row.dataset.message);
  const direction = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (direction) {
    event.preventDefault();
    focusMessage(index + direction, event, state, keys);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    focusMessage(
      event.key === 'Home' ? 0 : messages.length - 1,
      event,
      state,
      keys
    );
  } else if (
    event.key === 'Enter' ||
    event.key === 'ContextMenu' ||
    (event.key === 'F10' && event.shiftKey)
  ) {
    event.preventDefault();
    actions.open(messages[index], row);
  } else if (event.key === ' ') {
    event.preventDefault();
    selection.select(row.dataset.message, {
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey,
      keys,
    });
    viewport.render();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    selection.clear();
    viewport.render();
  }
  root.setAttribute('aria-label', state.label);
}
