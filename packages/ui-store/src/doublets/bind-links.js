/** Bidirectional document binding. Fragment writes precede handle publication. */
import { bindingNames } from './string-names.js';
import { applySnapshot } from './reconcile.js';
import { check } from '../errors.js';
import { documentWriter, linkAt, readGraph } from './live-graph.js';

/**
 * Follow a loaded/subscribed links graph. Links win the initial load.
 * The returned disposer has `flush()` to await writes and reconciliation.
 * Invalid intermediate graphs wait for subsequent cache changes; flush
 * reports an incomplete graph.
 */
export function bindStoreLinks(
  store,
  links,
  { roots, names = links.names, onError = () => {} }
) {
  check(
    typeof links.onChange === 'function',
    'bad-doublets',
    'bindStoreLinks needs onChange'
  );
  check(
    Array.isArray(roots) &&
      roots.length === 2 &&
      roots.every(
        (id) => linkAt(links, links.resolve?.(id) ?? id)?.from_id === 0
      ),
    'bad-doublets',
    'Live binding requires stable roots from writeDocumentLinks'
  );
  names = bindingNames(links, names);
  const writer = documentWriter(links, names);
  let handles = new Map();
  let stopped = false;
  let applying = false;
  let queued = null;
  let failure = null;
  let writeFailure = null;
  let reachable = new Set();
  let initial = true;
  const resolve = writer.resolve;

  const receive = () => {
    const snapshot = readGraph(links, { roots, names });
    applying = true;
    try {
      const next = applySnapshot(store, snapshot, handles, initial, resolve);
      initial = false;
      handles = next;
      reachable = snapshot.reachable;
      failure = null;
    } finally {
      applying = false;
    }
  };
  receive();
  const schedule = () => {
    if (stopped || applying || queued) {
      return;
    }
    queued = Promise.resolve().then(() => {
      queued = null;
      if (!stopped) {
        try {
          receive();
        } catch (error) {
          failure = error;
          onError(error);
        }
      }
    });
  };
  const stopLinks = links.onChange(({ before, after, origin }) => {
    if (origin === 'remap') {
      reachable = new Set([...reachable].map(resolve));
      return;
    }
    if (failure || reachable.has(resolve((after ?? before).id))) {
      schedule();
    }
  });
  const stopStore = store.subscribe((events) => {
    for (const event of events) {
      if (event.type === 'rename' && handles.has(event.before)) {
        handles.set(event.after, handles.get(event.before));
        handles.delete(event.before);
      }
    }
    if (applying || stopped) {
      return;
    }
    applying = true;
    writeFailure = null;
    try {
      const element = (id) => {
        const node = store.get(id);
        return writer.element(
          { ...node, id: node.name },
          id,
          store.children(id).map(element),
          handles
        );
      };
      const value = writer.sequence(store.roots().map(element));
      const root = resolve(roots[0]);
      // Existing documents written before live handles remain readable;
      // live editing requires stable root handles from writeDocumentLinks.
      writer.handle(value, root);
      writer.handle(
        writer.values(store.toDocument().unknown),
        resolve(roots[1])
      );
      reachable = readGraph(links, { roots, names }).reachable;
    } catch (error) {
      writeFailure = error;
      onError(error);
    } finally {
      applying = false;
    }
  });
  const dispose = () => {
    stopped = true;
    stopStore();
    stopLinks();
  };
  dispose.flush = async () => {
    await links.flush?.();
    await queued;
    if (!stopped) {
      receive();
    }
    if (writeFailure || failure) {
      throw writeFailure ?? failure;
    }
  };
  return dispose;
}
