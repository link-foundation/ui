/** DeepClient's data API over an optimistic synced triplets storage. */
import { badDeepQuery, deepQuery, resolveDeepQuery } from './deep-query.js';
import {
  createDeepValues,
  deepValueKinds,
  deepValueText,
} from './deep-values.js';
import { createMinilinks, deepEmitter, deepObservable } from './minilinks.js';
import { formatLino, group, named } from './lino.js';

const plainTriplet = (t) => ({
  id: t.index,
  type_id: t.type,
  from_id: t.from,
  to_id: t.to,
});

function selectLocal(ml, input, options) {
  if (!options.table || options.table === 'links') {
    return ml.query(input, options);
  }
  const kind = options.table.slice(0, -1);
  if (!deepValueKinds().includes(kind)) {
    throw badDeepQuery(`Unsupported local table ${options.table}`);
  }
  const table = createMinilinks();
  table.add(ml.links.flatMap((row) => (row[kind] ? [row[kind]] : [])));
  return table.query(resolveDeepQuery(input, ml), options);
}

function createDeepReader(synced, ml, values) {
  let queued = false;
  let closed = false;
  let known = new Set();
  const refresh = () => {
    if (closed) {
      return;
    }
    const { hidden, values: decoded } = values.read();
    const rows = synced
      .eachTriplet()
      .filter((t) => !hidden.has(t.index))
      .map((t) => ({ ...plainTriplet(t), ...decoded.get(t.index) }));
    const current = new Set(rows.map((row) => row.id));
    for (const id of known) {
      const resolved = synced.resolve(id);
      if (!current.has(resolved) && ml.byId[resolved]) {
        ml.remove([resolved]);
      }
    }
    known = current;
    ml.apply(rows, 'synced');
  };
  const schedule = () => {
    if (!queued) {
      queued = true;
      Promise.resolve().then(() => {
        queued = false;
        refresh();
      });
    }
  };
  const stopChange = synced.onChange(schedule);
  const stopRemap = synced.onRemap((temp, real) => {
    ml.remap(temp, real);
    refresh();
  });
  refresh();
  return {
    refresh,
    close() {
      closed = true;
      stopChange();
      stopRemap();
    },
  };
}

function deepWrites({ synced, ml, values, reader, flush, load }) {
  const validate = (input) => {
    if (input.id !== undefined) {
      throw badDeepQuery(
        'Explicit insert ids are not supported by the synced triplets client'
      );
    }
    for (const kind of deepValueKinds()) {
      if (input[kind]) {
        deepValueText(kind, input[kind].data.value);
      }
    }
    for (const field of ['type', 'from', 'to', 'in', 'out', 'typed']) {
      for (const child of [input[field]?.data ?? []].flat()) {
        validate(child);
      }
    }
  };
  const valueKind = (table) => {
    const kind = table.slice(0, -1);
    if (!deepValueKinds().includes(kind)) {
      throw badDeepQuery(`Unsupported value table ${table}`);
    }
    return kind;
  };
  const insertOne = (input) => {
    if (input.id !== undefined) {
      throw badDeepQuery(
        'Explicit insert ids are not supported by the synced triplets client'
      );
    }
    const part = (field) =>
      input[field]?.data
        ? insertOne(input[field].data)
        : (input[`${field}_id`] ?? 0);
    const id = synced.createTriplet(part('type'), part('from'), part('to'));
    for (const kind of deepValueKinds()) {
      if (input[kind]) {
        values.set(id, kind, input[kind].data.value);
      }
    }
    for (const [relation, field] of [
      ['in', 'to_id'],
      ['out', 'from_id'],
      ['typed', 'type_id'],
    ]) {
      for (const row of [input[relation]?.data ?? []].flat()) {
        insertOne({ ...row, [field]: id });
      }
    }
    return id;
  };
  const result = async (ids) => {
    reader.refresh();
    await flush();
    reader.refresh();
    return {
      data: ids.map((id) => ml.byId[synced.resolve(id)]).filter(Boolean),
      loading: false,
    };
  };
  return {
    async insert(input, options = {}) {
      if (options.table && options.table !== 'links') {
        const kind = valueKind(options.table);
        const rows = [input].flat();
        rows.forEach((row) => deepValueText(kind, row.value));
        if (synced.connected) {
          await load({}, {});
        }
        for (const row of rows) {
          if (!ml.byId[synced.resolve(row.link_id)]) {
            throw badDeepQuery('Value owner does not exist');
          }
        }
        rows.forEach((row) => values.set(row.link_id, kind, row.value));
        await flush();
        reader.refresh();
        return {
          data: rows.map((row) => ml.byId[synced.resolve(row.link_id)]?.[kind]),
          loading: false,
        };
      }
      [input].flat().forEach(validate);
      const ids = [input].flat().map(insertOne);
      return result(ids);
    },
    async update(input, changes, options = {}) {
      if (synced.connected) {
        await load(options.table ? {} : input, {});
      }
      const table = options.table ?? 'links';
      if (table !== 'links') {
        const kind = valueKind(table);
        deepValueText(kind, changes.value);
        const rows = ml.links.flatMap((row) => (row[kind] ? [row[kind]] : []));
        const matches = createMinilinks();
        matches.add(rows);
        const found = matches.query(input);
        for (const row of found) {
          values.set(row.link_id, kind, changes.value);
        }
        await flush();
        reader.refresh();
        return {
          data: found.map((row) => ({ ...row, value: changes.value })),
          loading: false,
        };
      }
      const ids = ml.query(input).map((row) => {
        synced.updateTriplet(
          row.id,
          changes.type_id ?? row.type_id,
          changes.from_id ?? row.from_id,
          changes.to_id ?? row.to_id
        );
        return row.id;
      });
      return result(ids);
    },
    async delete(input, options = {}) {
      if (synced.connected) {
        await load(options.table ? {} : input, {});
      }
      if (options.table && options.table !== 'links') {
        const kind = valueKind(options.table);
        const table = createMinilinks();
        table.add(ml.links.flatMap((row) => (row[kind] ? [row[kind]] : [])));
        const data = table.query(input).map((row) => row.toPlain());
        for (const row of data) {
          values.remove(row.link_id, kind);
        }
        await flush();
        reader.refresh();
        return { data, loading: false };
      }
      const data = ml.query(input).map((row) => ({ ...row.toPlain() }));
      for (const row of data) {
        if (synced.isTriplet(row.id)) {
          synced.deleteTriplet(row.id);
        }
      }
      await result([]);
      return { data, loading: false };
    },
  };
}

function deepSubscription({ synced, ml, remote, reader, subscriptions }) {
  return (input = {}, queryOptions = {}) => {
    input = resolveDeepQuery(input, ml);
    return deepObservable(({ next, error }) => {
      let stopped = false,
        subscription;
      let local;
      const dispose = () => {
        stopped = true;
        local?.unsubscribe();
        subscriptions.delete(dispose);
        if (subscription) {
          const current = subscription;
          subscription = null;
          Promise.resolve(
            remote ? current.unsubscribe() : synced.unsubscribe(current.id)
          ).catch(error);
        }
      };
      subscriptions.add(dispose);
      const start = async () => {
        if (remote) {
          subscription = remote.subscribe(
            input,
            queryOptions,
            (data) => {
              reader.refresh();
              if (queryOptions.apply) {
                ml.apply(data, queryOptions.apply);
              }
              next({
                data: queryOptions.aggregate === 'count' ? data.length : data,
                loading: false,
              });
            },
            error
          );
        } else {
          subscription = await synced.subscribe();
          reader.refresh();
          if (!stopped) {
            local = ml.subscribe({}).subscribe(() =>
              next({
                data: selectLocal(ml, input, queryOptions),
                loading: false,
              })
            );
          }
        }
        if (stopped && subscription) {
          dispose();
        }
      };
      start().catch(error);
      return dispose;
    });
  };
}

/**
 * @param {object} synced A createSyncedTriplets-compatible client.
 * @param {object} [options]
 * @param {any} [options.minilinks] An existing compatible collection.
 * @param {any} [options.policy] The permission policy for local `can`.
 * @param {number | null} [options.subject]
 * @param {Record<string, string>} [options.actions] Action id to read/write/reference.
 */
export function createDeepClient(synced, options = {}) {
  const ml = options.minilinks ?? createMinilinks();
  const remote = synced.deep ?? null;
  const values = remote?.valueStore(synced) ?? createDeepValues(synced);
  const reader = createDeepReader(synced, ml, values);
  const errors = [];
  const subscriptions = new Set();
  const stopError = synced.onError((error, write) => {
    if (write) {
      errors.push(error);
    }
  });
  const flush = async () => {
    try {
      await synced.flush();
      await values.flush?.();
    } finally {
      reader.refresh();
    }
    if (errors.length) {
      const [error] = errors.splice(0);
      throw error;
    }
  };
  const load = async (input, queryOptions) => {
    input = resolveDeepQuery(input, ml);
    if (remote) {
      return remote.select(input, queryOptions);
    }
    // Substitution has no negation operator: read the candidate network and
    // evaluate the complete Hasura expression on its readable local copy.
    const pattern = named('$i', ['$type', '$from', '$to']);
    const side = group([pattern]);
    await synced.query(formatLino([group([side, side])]));
    reader.refresh();
    return selectLocal(ml, input, queryOptions);
  };
  const deep = {
    minilinks: ml,
    ml,
    synced,
    emitter: deepEmitter(),
    linkId: options.subject ?? null,
    ...deepWrites({ synced, ml, values, reader, flush, load }),
    flush,
    resolve: synced.resolve,
    async select(input = {}, queryOptions = {}) {
      const q = deepQuery(input, queryOptions);
      const data =
        queryOptions.remote === false
          ? selectLocal(ml, input, queryOptions)
          : await load(input, queryOptions);
      if (
        queryOptions.apply &&
        !queryOptions.aggregate &&
        (!queryOptions.table || queryOptions.table === 'links')
      ) {
        ml.apply(data, queryOptions.apply);
      }
      return {
        data:
          q.aggregate === 'count' && Array.isArray(data) ? data.length : data,
        loading: false,
      };
    },
    subscribe: deepSubscription({ synced, ml, remote, reader, subscriptions }),
    async id(start, ...path) {
      if (remote) {
        await load({}, {});
      } else {
        await deep.select({});
      }
      return typeof start === 'object'
        ? (await deep.select(start)).data[0]?.id
        : ml.id(start, ...path);
    },
    idLocal: (start, ...path) => ml.id(start, ...path),
    async can(object, subject = deep.linkId, action = 'read') {
      if (remote) {
        const name = options.actions?.[action] ?? action;
        const actionId =
          typeof name === 'number'
            ? name
            : await deep.id(
                '@deep-foundation/core',
                name === 'read'
                  ? 'AllowSelect'
                  : name === 'write'
                    ? 'AllowUpdate'
                    : name
              );
        return remote.can(
          synced.resolve(object),
          synced.resolve(subject),
          actionId
        );
      }
      const name = options.actions?.[action] ?? action;
      const method = {
        read: 'canRead',
        write: 'canWrite',
        reference: 'canReference',
      }[name];
      if (!method || !options.policy) {
        throw badDeepQuery(
          'can requires a permission policy and a known action'
        );
      }
      const row = ml.byId[synced.resolve(object)];
      return (
        !!row &&
        options.policy[method](subject, {
          id: row.id,
          from_id: row.type_id,
          to_id: row.to_id,
        })
      );
    },
    async guest() {
      if (!remote) {
        throw badDeepQuery('guest requires the GraphQL endpoint');
      }
      const auth = await remote.guest();
      deep.linkId = auth.linkId;
      deep.token = auth.token;
      return auth;
    },
    close() {
      subscriptions.forEach((dispose) => dispose());
      reader.close();
      stopError();
      values.close?.();
    },
  };
  ml.deep = deep;
  return deep;
}
