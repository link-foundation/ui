/**
 * Generated IDs of anonymous elements (docs: README, "ID rules").
 *
 * The specification (docs/spec/ordering-and-ids.md) reserves no prefix for
 * generated IDs, so they are `_1`, `_2`, ... A generator never returns an ID
 * that is in use, and never returns the same ID twice, so an ID names one
 * element for the whole life of the store, even after that element is
 * removed (its removal can be undone).
 */

/** The prefix of generated IDs. */
export const GENERATED_ID_PREFIX = '_';

/**
 * @param {Iterable<string> | ((id: string) => boolean)} [usedIds]
 *   the IDs to skip: a collection, or a predicate that is asked at every
 *   call (the store passes "is this ID an element now").
 */
export function createIdGenerator(usedIds = []) {
  const used =
    typeof usedIds === 'function'
      ? usedIds
      : (
          (set) => (id) =>
            set.has(id)
        )(new Set(usedIds));
  /** IDs this generator returned or was told about with `reserve`. */
  const issued = new Set();
  let counter = 0;
  return {
    /** The next free ID. */
    next() {
      let id;
      do {
        counter += 1;
        id = `${GENERATED_ID_PREFIX}${counter}`;
      } while (issued.has(id) || used(id));
      issued.add(id);
      return id;
    },
    /**
     * Mark an ID given to an anonymous element from elsewhere (a replayed
     * operation log or a redo) as issued, so it is never generated again.
     * @param {string} id
     */
    reserve(id) {
      issued.add(id);
    },
  };
}
