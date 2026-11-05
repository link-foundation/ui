/** A small browser-safe MinilinkCollection, without a React dependency. */
import {
  badDeepQuery,
  deepRelations,
  equalDeepValue,
  queryDeepRows,
  resolveDeepQuery,
} from './deep-query.js';

export function deepEmitter() {
  const listeners = new Map();
  const emitter = {
    on(event, listener) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(listener);
      return emitter;
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
      return emitter;
    },
    removeListener(event, listener) {
      return emitter.off(event, listener);
    },
    emit(event, ...args) {
      for (const listener of [...(listeners.get(event) ?? [])]) {
        listener(...args);
      }
    },
  };
  return emitter;
}

/** An observable with synchronous local delivery and idempotent disposal. */
export function deepObservable(start) {
  return {
    subscribe(observer) {
      const target =
        typeof observer === 'function' ? { next: observer } : observer;
      let closed = false;
      const stop = start({
        next: (value) => !closed && target.next?.(value),
        error: (error) => !closed && target.error?.(error),
      });
      return {
        unsubscribe() {
          if (closed) {
            return;
          }
          closed = true;
          stop?.();
        },
        get closed() {
          return closed;
        },
      };
    },
  };
}

function decorateRow(ml, input, applies) {
  const row = {
    type_id: undefined,
    from_id: undefined,
    to_id: undefined,
    ...input,
    _applies: [...applies],
  };
  for (const relation of Object.keys(deepRelations())) {
    Object.defineProperty(row, relation, {
      configurable: true,
      get() {
        const key = deepRelations()[relation];
        return ['from', 'to', 'type'].includes(relation)
          ? ml.byId[row[key]]
          : ml.links.filter((link) => link[key] === row.id);
      },
    });
  }
  for (const relation of ['in', 'out']) {
    Object.defineProperty(row, `${relation}ByType`, {
      get() {
        const groups = {};
        for (const link of row[relation]) {
          (groups[link.type_id] ??= []).push(link);
        }
        return groups;
      },
    });
  }
  row.value = input.value ?? input.string ?? input.number ?? input.object;
  row.toPlain = () => ({ ...input, value: row.value });
  return row;
}

function collectionWrites(ml, owners) {
  const put = (input, name) => {
    if (!Number.isSafeInteger(input.id)) {
      throw badDeepQuery('A minilink needs an integer id');
    }
    const old = ml.byId[input.id];
    const applies = owners.get(input.id) ?? new Set();
    applies.add(name);
    owners.set(input.id, applies);
    const row = decorateRow(ml, input, applies);
    ml.byId[row.id] = row;
    if (!old || !equalDeepValue(old.toPlain(), row.toPlain())) {
      ml.emitter.emit(old ? 'updated' : 'added', old, row);
      ml.emitter.emit('apply', old, row);
    }
    return row;
  };
  const remove = (id, name) => {
    const applies = owners.get(id);
    if (name !== undefined) {
      applies?.delete(name);
    } else {
      applies?.clear();
    }
    const row = ml.byId[id];
    if (!row) {
      return new Error(`${id} can't delete because not exists in collection`);
    }
    row._applies = [...applies];
    if (!applies.size) {
      delete ml.byId[id];
      owners.delete(id);
      ml.emitter.emit('removed', row, undefined);
      ml.emitter.emit('apply', row, undefined);
    }
    return null;
  };
  const anomalies = (rows) =>
    rows.flatMap((row) =>
      ['type', 'from', 'to'].flatMap((field) => {
        const id = row[`${field}_id`];
        return id && !ml.byId[id]
          ? [new Error(`${row.id} link.${field}_id ${id} not found`)]
          : [];
      })
    );
  const finish = (data, errors = []) => {
    ml.emitter.emit('change');
    return {
      data,
      plainLinks: data.map((row) => row.toPlain()),
      errors,
      anomalies: anomalies(data),
    };
  };
  return {
    add(rows, name = '') {
      const data = [],
        errors = [];
      for (const row of rows) {
        if (ml.byId[row.id]) {
          errors.push(
            new Error(
              `${row.id} can't add because already exists in collection`
            )
          );
        } else {
          data.push(put(row, name));
        }
      }
      return finish(data, errors);
    },
    update(rows, name = '') {
      return finish(
        rows.map((row) => put({ ...ml.byId[row.id]?.toPlain(), ...row }, name))
      );
    },
    remove(ids, name) {
      return finish([], ids.map((id) => remove(id, name)).filter(Boolean));
    },
    remap(temp, real) {
      ml.virtual[temp] = real;
      ml.virtualInverted[real] = temp;
      for (const old of ml.links) {
        const input = old.toPlain();
        for (const key of ['id', 'type_id', 'from_id', 'to_id']) {
          if (input[key] === temp) {
            input[key] = real;
          }
        }
        if (old.id === temp) {
          const applies = owners.get(temp);
          delete ml.byId[temp];
          owners.delete(temp);
          owners.set(real, new Set([...(owners.get(real) ?? []), ...applies]));
        }
        for (const name of owners.get(input.id)) {
          put(input, name);
        }
      }
      ml.emitter.emit('change');
    },
    apply(input, name = '', options = {}) {
      if (input?.options?.table && input.options.table !== 'links') {
        return finish([]);
      }
      const rows = Array.isArray(input) ? input : (input?.data ?? []);
      const flattened = [];
      const visit = (row, returning) => {
        flattened.push(row);
        for (const [key, spec] of Object.entries(returning ?? {})) {
          for (const child of [row[key] ?? []].flat()) {
            visit(child, spec.return);
          }
        }
      };
      rows.forEach((row) => visit(row, options.return ?? input?.return));
      const next = new Set(flattened.map((row) => row.id));
      const data = flattened.map((row) => put(row, name));
      for (const [id, applies] of [...owners]) {
        if (applies.has(name) && !next.has(id)) {
          remove(id, name);
        }
      }
      return finish(data);
    },
  };
}

export function createMinilinks() {
  const owners = new Map();
  const ml = {
    byId: {},
    virtual: {},
    virtualInverted: {},
    emitter: deepEmitter(),
  };
  Object.defineProperty(ml, 'links', { get: () => Object.values(ml.byId) });
  for (const [index, field] of Object.entries({
    byFrom: 'from_id',
    byTo: 'to_id',
    byType: 'type_id',
    types: 'type_id',
  })) {
    Object.defineProperty(ml, index, {
      get: () => {
        const groups = {};
        for (const row of ml.links) {
          (groups[row[field]] ??= []).push(row);
        }
        return groups;
      },
    });
  }
  Object.assign(ml, collectionWrites(ml, owners), {
    query(input = {}, options = {}) {
      const rows = queryDeepRows(
        ml.links,
        resolveDeepQuery(input, ml),
        options
      );
      return options.aggregate === 'count' ? rows.length : rows;
    },
    select(input, options) {
      return ml.query(input, options);
    },
    subscribe(input, options) {
      return deepObservable(({ next }) => {
        let previous;
        const update = () => {
          const result = ml.query(input, options);
          const plain = Array.isArray(result)
            ? result.map((row) => row.toPlain())
            : result;
          if (!equalDeepValue(previous, plain)) {
            previous = plain;
            next(result);
          }
        };
        ml.emitter.on('change', update);
        update();
        return () => ml.emitter.off('change', update);
      });
    },
    id(start, ...path) {
      const optional = path.at(-1) === true;
      if (optional) {
        path.pop();
      }
      let id =
        typeof start === 'number'
          ? start
          : ml.links.find((row) => row.value?.value === start)?.id;
      for (const name of path) {
        id = ml.links.find(
          (row) => row.from_id === id && row.value?.value === name
        )?.to_id;
      }
      if (!id && !optional) {
        throw badDeepQuery(
          `Id not found by ${JSON.stringify([start, ...path])}`
        );
      }
      return id ?? 0;
    },
    name(input) {
      const id = typeof input === 'object' ? input.id : input;
      return ml.links.find(
        (row) => row.to_id === id && typeof row.value?.value === 'string'
      )?.value.value;
    },
  });
  return ml;
}
