/** Server observations beneath the doublets client's durable optimistic queue. */
import { deleteCascade, sameLink } from './decorators.js';
import { allLinks, decorate, ensureCreated, getLink, linkOf } from './links.js';
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

/** A view of `links` that records the first value of each address it writes. */
function recording(links, saved) {
  const keep = (id) => {
    if (!saved.has(id)) {
      saved.set(id, getLink(links, id));
    }
  };
  return decorate(links, {
    createAt(id) {
      keep(id);
      return links.createAt(id);
    },
    update(id, source, target) {
      keep(id);
      return links.update(id, source, target);
    },
    delete(id) {
      keep(id);
      return links.delete(id);
    },
  });
}

/**
 * Keep the cache equal to `base` with the open writes replayed on top.
 * Only addresses that may differ are compared: changed in `base` (`touch`),
 * written optimistically (the changes of queued writes) or by the previous
 * replay. A write so costs its own size, not the size of the cache. The
 * replay runs on `base` itself and is reverted afterwards.
 */
function createSettler({ base, cache, emit, queue }) {
  const dirty = new Set();
  let replayed = [];
  // A restored cache is compared in full once.
  let restored = true;
  const sync = (id, origin) => {
    const before = getLink(cache, id);
    const after = getLink(base, id);
    if (after === null) {
      if (before !== null) {
        cache.delete(id);
        emit(before, null, origin);
      }
    } else if (!sameLink(before, after)) {
      put(cache, after);
      emit(before, after, origin);
    }
  };
  const settle = (replay, origin, full = restored) => {
    restored = false;
    for (const entry of queue) {
      for (const { before, after } of entry.changes) {
        dirty.add((after ?? before).id);
      }
    }
    replayed.forEach((id) => dirty.add(id));
    const saved = new Map();
    const scratch = recording(base, saved);
    queue.filter((entry) => !entry.done).forEach((e) => replay(scratch, e));
    const ids = full
      ? new Set([...allLinks(cache), ...allLinks(base)].map((l) => l.id))
      : new Set([...dirty, ...saved.keys()]);
    const order = [...ids].sort((x, y) => x - y);
    // Deletions first, as a cache never holds a link a deletion would orphan.
    const gone = order.filter((id) => getLink(base, id) === null);
    const kept = order.filter((id) => getLink(base, id) !== null);
    [...gone, ...kept].forEach((id) => sync(id, origin));
    for (const [id, link] of [...saved].reverse()) {
      if (link === null) {
        remove(base, id);
      } else {
        put(base, link);
      }
    }
    dirty.clear();
    replayed = [...saved.keys()];
  };
  return { settle, touch: (id) => dirty.add(id) };
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

  const settler = createSettler({ base, cache, emit, queue });
  const { touch } = settler;
  const apply = (links, changes) => {
    for (const { before, after } of changes) {
      if (after === null) {
        remove(links, before.id);
      } else {
        put(links, after);
      }
      if (links === base) {
        touch((after ?? before).id);
      }
    }
  };
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
  const settle = (origin, full) => settler.settle(replay, origin, full);
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
      settle('remote', true);
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
      touch(after.id);
      touch(temp);
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
            touch(link.id);
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
