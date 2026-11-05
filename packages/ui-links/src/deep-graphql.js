/**
 * A GraphQL transport for the existing synced triplets client. Deep ids stay
 * in their own address space: the endpoint maps them to physical triplets.
 */
import { createSyncedTriplets } from './triplets-client.js';
import { LinksError } from './links.js';
import {
  deepQuery,
  deepWhere,
  equalDeepValue,
  badDeepQuery,
} from './deep-query.js';
import { deepValueKinds, deepValueText } from './deep-values.js';
import { formatLino, parseLino, named, group } from './lino.js';

const linkFields = () =>
  'id type_id from_id to_id value string { id link_id value } number { id link_id value } object { id link_id value }';
const tableName = (name) => {
  if (
    ![
      'links',
      'strings',
      'numbers',
      'objects',
      'can',
      'selectors',
      'tree',
      'mp',
      'handlers',
    ].includes(name)
  ) {
    throw badDeepQuery(`Unsupported Deep table ${name}`);
  }
  return name;
};
const rowLino = (row) =>
  named(String(row.id), [row.type_id, row.from_id, row.to_id].map(String));
const changeLino = (before, after) =>
  group([
    group(before ? [rowLino(before)] : []),
    group(after ? [rowLino(after)] : []),
  ]);
const whereFor = (restriction) =>
  Object.fromEntries(
    ['id', 'type_id', 'from_id', 'to_id'].flatMap((key, i) =>
      restriction[i] !== undefined && restriction[i] !== '*'
        ? [[key, { _eq: Number(restriction[i]) }]]
        : []
    )
  );

function graphqlSocket({
  url,
  WebSocket,
  headers,
  protocol,
  query,
  variables,
  next,
  error,
}) {
  const socketUrl = new globalThis.URL(url);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(socketUrl, protocol);
  const legacy = protocol === 'graphql-ws';
  const send = (value) => socket.send(JSON.stringify(value));
  let stopped = false;
  socket.addEventListener('open', () =>
    send({ type: 'connection_init', payload: { headers: headers() } })
  );
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'connection_ack' && !stopped) {
        send({
          id: '1',
          type: legacy ? 'start' : 'subscribe',
          payload: { query, variables },
        });
      } else if (['data', 'next'].includes(message.type)) {
        if (message.payload.errors) {
          error(
            new LinksError(
              'remote',
              message.payload.errors.map((e) => e.message).join('; ')
            )
          );
        } else {
          Promise.resolve(next(message.payload.data.q0)).catch(error);
        }
      } else if (
        message.type === 'error' ||
        message.type === 'connection_error'
      ) {
        error(new LinksError('remote', JSON.stringify(message.payload)));
      } else if (message.type === 'ping') {
        send({ type: 'pong' });
      }
    } catch (cause) {
      error(cause);
    }
  });
  socket.addEventListener(
    'error',
    () =>
      !stopped && error(new LinksError('offline', 'GraphQL WebSocket failed'))
  );
  socket.addEventListener(
    'close',
    () =>
      !stopped && error(new LinksError('offline', 'GraphQL WebSocket closed'))
  );
  return {
    unsubscribe() {
      if (!stopped) {
        stopped = true;
        if (socket.readyState === 1) {
          send({ id: '1', type: legacy ? 'stop' : 'complete' });
        }
        socket.close();
      }
    },
  };
}

export function queryDocument(input, options = {}, subscription = false) {
  const q = deepQuery(input, options);
  const table = tableName(options.table ?? 'links');
  const returning =
    options.returning ??
    (table === 'links' ? linkFields() : 'id link_id value');
  return {
    query: `${subscription ? 'subscription' : 'query'} UI($where: ${table}_bool_exp!, $limit: Int, $offset: Int, $order: [${table}_order_by!]) { q0: ${table}(where: $where, limit: $limit, offset: $offset, order_by: $order) { ${returning} } }`,
    variables: {
      where: deepWhere(q.where),
      limit: q.limit,
      offset: q.offset,
      order: q.order_by,
    },
  };
}

function graphqlSubscription({
  url,
  WebSocket,
  headers,
  protocol,
  remote,
  ingest,
  sockets,
}) {
  return (input, queryOptions, next, error) => {
    const document = queryDocument(input, queryOptions, true);
    let previous = [];
    const sub = graphqlSocket({
      url,
      WebSocket,
      headers,
      protocol,
      ...document,
      async next(data) {
        if (!queryOptions.table || queryOptions.table === 'links') {
          const missing = previous.filter(
            (id) => !data.some((row) => row.id === id)
          );
          // Leaving a filtered result does not imply deletion. Refresh those
          // rows so another overlapping subscription keeps the current link.
          const remaining = missing.length
            ? await remote().select({ id: { _in: missing } })
            : [];
          ingest(
            data,
            missing.filter((id) => !remaining.some((row) => row.id === id))
          );
        }
        previous = data.map((row) => row.id);
        next(data);
      },
      error,
    });
    sockets.add(sub);
    return {
      unsubscribe() {
        sub.unsubscribe();
        sockets.delete(sub);
      },
    };
  };
}

function graphqlCan(remote, rows) {
  return async (object, subject, action) => {
    // The can table contains type grants with 0 for Anything.
    await remote().select({});
    const ancestors = (id) => {
      const ids = new Set([0]);
      while (id && !ids.has(id)) {
        ids.add(id);
        id = rows.get(id)?.type_id;
      }
      return [...ids];
    };
    const data = await remote().select(
      {
        object_id: { _in: ancestors(rows.get(object)?.type_id) },
        subject_id: { _in: ancestors(subject) },
        action_id: action,
      },
      { table: 'can', returning: 'rule_id' }
    );
    return data.length > 0;
  };
}

const graphqlHeaders = (options, token) => ({
  ...options.headers,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

function createGraphQLRemote(options) {
  const {
    url,
    fetch: fetcher = globalThis.fetch,
    WebSocket = globalThis.WebSocket,
    protocol = 'graphql-transport-ws',
  } = options;
  const values = new Map();
  const rows = new Map();
  const pushes = new Set();
  const sockets = new Set();
  let token = options.token;
  const headers = () => graphqlHeaders(options, token);
  const execute = async (query, variables = {}) => {
    options.trace?.({ query, variables });
    let response;
    try {
      response = await fetcher(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers() },
        body: JSON.stringify({ query, variables }),
      });
    } catch (cause) {
      throw new LinksError('offline', String(cause));
    }
    const result = await response.json().catch(() => {
      throw new LinksError(
        'bad-reply',
        `Invalid GraphQL response (HTTP ${response.status})`
      );
    });
    if (!response.ok || result.errors) {
      throw new LinksError(
        'remote',
        result.errors?.map((e) => e.message).join('; ') ??
          `HTTP ${response.status}`
      );
    }
    return result.data;
  };
  const ingest = (data, removed = []) => {
    const changes = [];
    for (const id of removed) {
      const before = rows.get(id);
      if (before) {
        rows.delete(id);
        values.delete(id);
        changes.push(changeLino(before, null));
      }
    }
    for (const row of data) {
      if (row.type_id === undefined) {
        continue;
      }
      const before = rows.get(row.id) ?? null;
      rows.set(row.id, row);
      values.set(
        row.id,
        Object.fromEntries(deepValueKinds().map((kind) => [kind, row[kind]]))
      );
      // Values may change while the three reference parts stay the same.
      if (!equalDeepValue(before, row)) {
        changes.push(changeLino(before, row));
      }
    }
    if (changes.length) {
      const text = formatLino([named('notify', ['0']), ...changes]);
      pushes.forEach((listener) => listener(text));
    }
  };
  const remote = {
    values,
    rows,
    ingest,
    execute,
    async select(input, queryOptions = {}) {
      const { query, variables } = queryDocument(input, queryOptions);
      const data = (await execute(query, variables)).q0;
      if (!queryOptions.table || queryOptions.table === 'links') {
        const q = deepQuery(input, queryOptions);
        const full =
          !Object.keys(q.where).length &&
          q.limit === undefined &&
          q.offset === undefined;
        ingest(
          data,
          full
            ? [...rows.keys()].filter(
                (id) => !data.some((row) => row.id === id)
              )
            : []
        );
      }
      return data;
    },
    async mutate(operation, input, queryOptions = {}) {
      const table = tableName(queryOptions.table ?? 'links');
      const returning =
        queryOptions.returning ??
        (table === 'links' ? linkFields() : 'id link_id value');
      const insert = operation === 'insert';
      const update = operation === 'update';
      const declaration = insert
        ? `$objects: [${table}_insert_input!]!`
        : `$where: ${table}_bool_exp!${update ? `, $set: ${table}_set_input` : ''}`;
      const args = insert
        ? 'objects: $objects'
        : `where: $where${update ? ', _set: $set' : ''}`;
      const variables = insert
        ? { objects: input }
        : { where: deepWhere(input), set: queryOptions.set };
      const response = await execute(
        `mutation UI(${declaration}) { q0: ${operation}_${table}(${args}) { returning { ${returning} } } }`,
        variables
      );
      const data = response.q0.returning;
      if (table === 'links') {
        ingest(
          operation === 'delete' ? [] : data,
          operation === 'delete' ? data.map((row) => row.id) : []
        );
      }
      return data;
    },
    subscribe: graphqlSubscription({
      url,
      WebSocket,
      headers,
      protocol,
      remote: () => remote,
      ingest,
      sockets,
    }),
    async guest() {
      const auth = (await execute('query { guest { linkId token } }')).guest;
      token = auth.token;
      return auth;
    },
    can: graphqlCan(() => remote, rows),
    onPush(listener) {
      pushes.add(listener);
      return () => pushes.delete(listener);
    },
    close() {
      sockets.forEach((sub) => sub.unsubscribe());
      sockets.clear();
    },
  };
  return remote;
}

function graphqlValueStore(remote, synced) {
  const pending = [];
  let flushing;
  const read = () => {
    const values = new Map(
      [...remote.values].map(([id, value]) => [id, { ...value }])
    );
    for (const entry of pending) {
      const id = synced.resolve(entry.owner);
      const own = values.get(id) ?? {};
      own[entry.kind] = entry.remove
        ? null
        : { id, link_id: id, value: entry.value };
      values.set(id, own);
    }
    return { hidden: new Set(), values };
  };
  const drain = async () => {
    while (pending.length && synced.connected && !synced.pending) {
      const entry = pending[0];
      const owner = synced.resolve(entry.owner);
      let retry = false;
      try {
        if (!synced.isTriplet(owner)) {
          continue;
        }
        const table = `${entry.kind}s`;
        const [existing] = await remote.select({ link_id: owner }, { table });
        if (entry.remove && existing) {
          await remote.mutate('delete', { link_id: owner }, { table });
        } else if (!entry.remove) {
          if (existing) {
            await remote.mutate(
              'update',
              { link_id: owner },
              { table, set: { value: entry.value } }
            );
          } else {
            await remote.mutate(
              'insert',
              { link_id: owner, value: entry.value },
              { table }
            );
          }
        }
        await remote.select(owner);
      } catch (error) {
        // Disconnected work stays queued; a refused mutation loses its overlay.
        if (error.code === 'offline') {
          retry = true;
          throw error;
        }
        pending.shift();
        throw error;
      } finally {
        if (!retry && pending[0] === entry) {
          pending.shift();
        }
      }
    }
  };
  return {
    read,
    set(owner, kind, value) {
      deepValueText(kind, value);
      pending.push({ owner, kind, value });
    },
    remove(owner, kind) {
      if (!deepValueKinds().includes(kind)) {
        throw badDeepQuery(`Invalid value kind ${kind}`);
      }
      pending.push({ owner, kind, remove: true });
    },
    flush() {
      if (!flushing) {
        flushing = drain().finally(() => {
          flushing = null;
        });
      }
      return flushing;
    },
  };
}

function graphqlTransport(remote) {
  const subscriptions = new Map();
  let nextId = 1;
  return {
    onPush: remote.onPush,
    async send(text) {
      const [operation] = parseLino(text);
      const parts = operation.values[0]?.values ?? operation.values;
      const numbers = parts.map(Number);
      switch (operation.id) {
        case 'each':
          return formatLino(
            (await remote.select(whereFor(parts))).map(rowLino)
          );
        case 'count':
          return formatLino([
            named('count', [
              String((await remote.select(whereFor(parts))).length),
            ]),
          ]);
        case 'create': {
          const [type_id, from_id, to_id] = numbers;
          const [row] = await remote.mutate('insert', {
            type_id,
            from_id,
            to_id,
          });
          return formatLino([changeLino(null, row)]);
        }
        case 'update': {
          const [id, type_id, from_id, to_id] = numbers;
          const before = remote.rows.get(id);
          const [after] = await remote.mutate('update', id, {
            set: { type_id, from_id, to_id },
          });
          return formatLino([changeLino(before, after)]);
        }
        case 'delete': {
          const deleted = await remote.mutate('delete', numbers[0]);
          const current = await remote.select({});
          remote.ingest(
            [],
            [...remote.rows.keys()].filter(
              (id) => !current.some((row) => row.id === id)
            )
          );
          return formatLino(deleted.map((row) => changeLino(row, null)));
        }
        case 'subscribe': {
          const id = nextId++;
          const sub = remote.subscribe(
            whereFor(parts),
            {},
            () => {},
            () => {}
          );
          subscriptions.set(id, sub);
          return formatLino([named('subscription', [String(id)])]);
        }
        case 'unsubscribe':
          subscriptions.get(numbers[0])?.unsubscribe();
          subscriptions.delete(numbers[0]);
          return '';
        default:
          throw badDeepQuery(`GraphQL transport cannot send ${operation.id}`);
      }
    },
    close() {
      remote.close();
      subscriptions.clear();
    },
  };
}

/**
 * Synced triplets in the Deep id space, over clink's Hasura endpoint.
 * @param {{ url: string, token?: string, headers?: object, fetch?: typeof fetch,
 * WebSocket?: any, protocol?: 'graphql-ws'|'graphql-transport-ws',
 * trace?: (operation: object) => void }} options
 */
export function createSyncedDeepLinks(options) {
  const remote = createGraphQLRemote(options);
  const transport = graphqlTransport(remote);
  const synced = createSyncedTriplets({ transport });
  remote.valueStore = (client) => graphqlValueStore(remote, client);
  Object.defineProperty(synced, 'deep', { value: remote });
  Object.defineProperty(synced, 'close', {
    value: () => {
      synced.disconnect();
      transport.close();
    },
  });
  return synced;
}
