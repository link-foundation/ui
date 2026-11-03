/** A tiny observable adapter; hosts may also supply any {get, subscribe} source. */
export function createDataSource(initial = []) {
  let items = initial;
  const listeners = new Set();
  return {
    get: () => items,
    set(next) {
      items = next;
      for (const listener of listeners) {
        listener(items);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Read scalar/record values already parsed by ui-core, never text. */
function valueOf(value) {
  if (!Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    value
      .filter(Array.isArray)
      .map(([name, ...values]) => [
        name,
        values.length === 1 ? valueOf(values[0]) : values.map(valueOf),
      ])
  );
}

export function sourceOf(el, options) {
  const values = el.props.get('items') ?? [];
  if (Array.isArray(values[0]) && values[0][0] === 'param') {
    return options.sources?.[values[0][1]] ?? [];
  }
  return values.map(valueOf);
}

export const itemsOf = (source) =>
  typeof source?.get === 'function' ? source.get() : source;
export const itemKey = (item) => String(item.id);
