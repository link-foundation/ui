function validatePage(page, id, pageSize) {
  if (
    !Array.isArray(page.messages) ||
    page.messages.some((m) => typeof m.id !== 'string') ||
    page.messages.length > pageSize ||
    new Set(page.messages.map((m) => m.id)).size !== page.messages.length
  ) {
    throw new TypeError('Invalid stream page');
  }
  if (id !== undefined && !page.messages.some((m) => m.id === id)) {
    throw new Error(`Message not found: ${id}`);
  }
}

function mergePage(current, page, direction, id, pageSize, ceiling) {
  validatePage(page, id, pageSize);
  const replace = direction === 'around' || !current.messages.length;
  const incoming = new Set(page.messages.map((m) => m.id));
  const kept = current.messages.filter((m) => !incoming.has(m.id));
  let messages = replace
    ? page.messages
    : direction === 'before'
      ? [...page.messages, ...kept]
      : [...kept, ...page.messages];
  let hasOlder =
    replace || direction === 'before' ? page.hasOlder : current.hasOlder;
  let hasNewer =
    replace || direction === 'after' ? page.hasNewer : current.hasNewer;
  if (messages.length > ceiling) {
    if (direction === 'before') {
      messages = messages.slice(0, ceiling);
      hasNewer = true;
    } else {
      messages = messages.slice(-ceiling);
      hasOlder = true;
    }
  }
  return {
    messages,
    hasOlder,
    hasNewer,
    highlighted: id ?? current.highlighted,
    loading: false,
    error: null,
  };
}

/**
 * Bidirectional contiguous history. The source owns ordering and cursors.
 * @typedef {{messages: object[], hasOlder: boolean, hasNewer: boolean,
 * highlighted: string|null, loading: boolean, error: Error|null}} StreamState
 * @typedef {{before?: string, after?: string, around?: string, limit: number,
 * signal: AbortSignal}} StreamQuery
 * @typedef {{load(query: StreamQuery): Promise<{messages: object[], hasOlder: boolean, hasNewer: boolean}>}} StreamSource
 */

/**
 * @param {StreamSource} source
 * @param {{pageSize?: number, prefetch?: number, ceiling?: number}} [options]
 * @returns {{loadOlder(): Promise<void>, loadNewer(): Promise<void>, jumpTo(id: string): Promise<void>, state(): StreamState, subscribe(fn: Function): Function, disconnect(): void, prefetch: number}}
 */
export function createStreamWindow(
  source,
  { pageSize = 50, prefetch = 30, ceiling = 500 } = {}
) {
  if (
    ![pageSize, prefetch, ceiling].every(
      (n) => Number.isSafeInteger(n) && n > 0
    ) ||
    ceiling < pageSize
  ) {
    throw new RangeError(
      'Positive integer limits required; ceiling must fit one page'
    );
  }
  let current = {
    messages: [],
    hasOlder: true,
    hasNewer: false,
    highlighted: null,
    loading: false,
    error: null,
  };
  let generation = 0;
  let pending;
  let abort;
  let disposed = false;
  const listeners = new Set();
  const state = () => ({ ...current, messages: [...current.messages] });
  const notify = () => listeners.forEach((fn) => fn(state()));

  async function load(direction, id) {
    if (disposed) {
      return;
    }
    if (direction !== 'around' && pending) {
      return pending;
    }
    if (
      direction === 'before' &&
      current.messages.length &&
      !current.hasOlder
    ) {
      return;
    }
    const token = ++generation;
    abort?.abort();
    abort = new AbortController();
    current = { ...current, loading: true, error: null };
    notify();
    const query = { limit: pageSize, signal: abort.signal };
    if (id !== undefined) {
      query.around = id;
    } else if (current.messages.length) {
      query[direction] = (
        direction === 'before' ? current.messages[0] : current.messages.at(-1)
      ).id;
    }
    const task = (async () => {
      try {
        const page = await Promise.resolve().then(() => source.load(query));
        if (token !== generation || disposed) {
          return;
        }
        current = mergePage(current, page, direction, id, pageSize, ceiling);
      } catch (error) {
        if (token !== generation || disposed) {
          return;
        }
        current = { ...current, loading: false, error };
        throw error;
      } finally {
        if (token === generation && !disposed) {
          pending = null;
          notify();
        }
      }
    })();
    pending = task;
    return await task;
  }
  return {
    prefetch,
    state,
    loadOlder: () => load('before'),
    loadNewer: () => load('after'),
    jumpTo: (id) => load('around', id),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    disconnect() {
      disposed = true;
      generation++;
      abort?.abort();
      listeners.clear();
    },
  };
}
