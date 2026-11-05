/** Server observations beneath the doublets client's durable optimistic queue. */
import { deleteCascade, sameLink } from './decorators.js';
import { allLinks, ensureCreated, getLink, linkOf } from './links.js';
import { createLinksNames } from './links-names.js';
import { createMemoryLinks } from './memory.js';

function put(links, link) {
  if (getLink(links, link.id) === null) {
    ensureCreated(links, link.id);
  }
  links.update(link.id, link.from_id, link.to_id);
}

function remove(links, id) {
  if (getLink(links, id) !== null) {
    links.delete(id);
  }
}

/**
 * Inverse records retain the confirmed state without duplicating it in the
 * persistence format. Rebase them whenever the server supplies new information,
 * so restoring the cache and undoing the queue also restores that information.
 */
export function createCacheWriter(cache, emit, state, checkpoint) {
  const { queue } = state;
  const real = new Map(state.real);
  const refused = new Set(state.refused);
  const resolve = (id) => real.get(id) ?? id;
  const resolved = (link) =>
    linkOf(resolve(link.id), resolve(link.from_id), resolve(link.to_id));
  const base = createMemoryLinks();
  allLinks(cache).forEach((link) => put(base, link));
  for (const entry of [...queue].reverse()) {
    for (const { before, after } of [...entry.changes].reverse()) {
      if (before === null) {
        remove(base, resolve(after.id));
      } else {
        put(base, resolved(before));
      }
    }
  }

  const apply = (links, changes) => {
    for (const { before, after } of changes) {
      if (after === null) {
        remove(links, before.id);
      } else {
        put(links, after);
      }
    }
  };
  const open = (entry) => !entry.done;
  const lost = (entry) =>
    [entry.id, entry.source, entry.target].find((id) => refused.has(id));
  const replay = (links, entry) => {
    const id = resolve(entry.id);
    const before = getLink(links, id);
    entry.changes = [];
    if (lost(entry) !== undefined) {
      return;
    }
    if (entry.kind === 'delete') {
      if (before !== null) {
        entry.changes = deleteCascade(links, id).map((link) => ({
          before: link,
          after: null,
        }));
      }
    } else if (entry.kind === 'create' || before !== null) {
      const after = linkOf(id, resolve(entry.source), resolve(entry.target));
      put(links, after);
      entry.changes = [{ before, after }];
    }
  };
  const settle = (origin) => {
    let next = base;
    if (queue.some(open)) {
      next = createMemoryLinks();
      allLinks(base).forEach((link) => put(next, link));
      queue.filter(open).forEach((entry) => replay(next, entry));
    }
    for (const before of allLinks(cache)) {
      if (getLink(next, before.id) === null) {
        cache.delete(before.id);
        emit(before, null, origin);
      }
    }
    for (const after of allLinks(next)) {
      const before = getLink(cache, after.id);
      if (!sameLink(before, after)) {
        put(cache, after);
        emit(before, after, origin);
      }
    }
  };
  const learn = (changes) => {
    apply(base, changes);
    settle('remote');
    checkpoint();
  };

  return {
    real,
    refused,
    resolve,
    lost,
    learn,
    settled(entry, changes) {
      entry.done = true;
      learn(changes);
    },
    /** A subscription exit does not erase a newer value from another one. */
    applyRemote(changes) {
      learn(
        changes.filter(
          ({ before, after }) =>
            after !== null || sameLink(getLink(base, before.id), before)
        )
      );
    },
    replaceBase(links) {
      allLinks(base).forEach((link) => base.delete(link.id));
      links.forEach((link) => put(base, link));
      settle('remote');
      checkpoint();
    },
    refreshNames(ids, metadata) {
      const changes = createLinksNames(base)
        .bindings(ids)
        .map((before) => ({
          before,
          after: null,
        }));
      learn([
        ...changes,
        ...metadata.map((after) => ({ before: null, after })),
      ]);
    },
    /** Retain a partially acknowledged self-create before its update resumes. */
    remap(temp, after) {
      real.set(temp, after.id);
      put(base, after);
      const before = getLink(cache, temp);
      if (before !== null) {
        const moved = resolved(before);
        put(cache, moved);
        for (const link of allLinks(cache)) {
          if (
            link.id !== temp &&
            (link.from_id === temp || link.to_id === temp)
          ) {
            put(cache, resolved(link));
          }
        }
        cache.delete(temp);
        emit(before, moved, 'remap');
      }
      settle('remote');
    },
    undo(changes) {
      const entry = queue.find((queued) => queued.changes === changes);
      entry.done = true;
      if (entry.kind === 'create' && !real.has(entry.id)) {
        refused.add(entry.id);
      }
      settle('rollback');
    },
  };
}
