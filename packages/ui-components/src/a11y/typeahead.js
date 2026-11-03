/**
 * Typeahead (WAI-ARIA APG): typing characters in a list, a menu or a tree
 * moves to the next item whose label starts with them. Characters typed
 * within `timeout` ms of each other form one query; typing the same
 * character again cycles through the items that start with it.
 */

/** A clock on the global timers. */
const globalClock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

/** Whether a key is a character to search for. */
const isSearchKey = (key) =>
  typeof key === 'string' && [...key].length === 1 && key.trim() !== '';

/**
 * @param {() => readonly string[]} getLabels  the labels of the items, in
 *   order (read at every key, so the list may change)
 * @param {{timeout?: number, clock?: {setTimeout: Function,
 *   clearTimeout: Function}, locale?: string}} [options]  `timeout`
 *   (default 500 ms) ends the query; `clock` is injected in tests
 */
export function createTypeahead(getLabels, options = {}) {
  const { timeout = 500, clock = globalClock, locale } = options;
  let query = '';
  let timer = null;
  const fold = (text) => String(text).toLocaleLowerCase(locale).trim();

  const reset = () => {
    query = '';
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }
  };

  /**
   * Add a typed key to the query and find the item to move to.
   * @param {string} key  `KeyboardEvent.key`
   * @param {number} [current]  the index of the current item (-1: none)
   * @returns {number}  the index to move to, or -1 (no match, or the key
   *   is not a character: then the query is unchanged)
   */
  const handleKey = (key, current = -1) => {
    if (!isSearchKey(key)) {
      return -1;
    }
    query += fold(key);
    if (timer !== null) {
      clock.clearTimeout(timer);
    }
    timer = clock.setTimeout(() => {
      timer = null;
      query = '';
    }, timeout);

    const labels = getLabels().map(fold);
    const repeated = [...query].every((c) => c === query[0]);
    // One character (or one repeated): search after the current item, so
    // pressing it again moves on; a longer query may stay on the current
    // item when it still matches.
    const search = repeated ? query[0] : query;
    const start = repeated ? current + 1 : Math.max(current, 0);
    for (let n = 0; n < labels.length; n++) {
      const i = (start + n) % labels.length;
      if (labels[i].startsWith(search)) {
        return i;
      }
    }
    return -1;
  };

  return {
    get query() {
      return query;
    },
    handleKey,
    reset,
  };
}
