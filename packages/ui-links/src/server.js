/**
 * A links server: the LinksOperation protocol of `clink --serve`
 * (link-cli's `docs/protocol/links-operations.txt`) over any storage, with
 * optional permissions, and two extensions for clients that keep a partial
 * copy of the links (`createSyncedLinks`):
 *
 *   (count: (i s t))          -> (count: N)
 *   (each: (i s t))           -> (i: s t) per link, by address
 *   (create: (s t))           -> () ((i: s t))
 *   (update: (i s t))         -> ((i: s t)) ((i: s2 t2))
 *   (delete: i)               -> ((i: s t)) () per deleted link, users included
 *   (get-name: i)             -> (name: 'text') or nothing
 *   (set-name: (i 'text'))    -> (link: i)
 *   (get-by-name: 'text')     -> (link: i) or nothing
 *   (remove-name: i)          -> nothing
 *   ()                        -> every link, names for named addresses
 *   anything else             -> a substitution query: its changes
 *
 *   (auth: token)             -> (subject: i), or an error
 *   (subscribe: (i s t))      -> (subscription: n); later, pushed to this
 *                                session only: (notify: n) and the changes
 *                                other sessions made to matching links
 *   (unsubscribe: n)          -> nothing
 *
 * An error is `(error: 'message')`. A restriction has up to three parts,
 * `*` matching anything: `()` every link, `(i)`, `(i v)` where `v` is the
 * source or the target, and `(i s t)`.
 *
 * Every request is atomic: a request that fails changes nothing.
 *
 * With `triplets: true` the server is in triplet mode (`clink --serve
 * --triplets`) and reads the same requests as triplets: see
 * `triplets-server.js`.
 */

import { ANY } from './constants.js';
import { deleteCascade } from './decorators.js';
import {
  allLinks,
  getLink,
  LinksError,
  normalizeQuery,
  matches,
} from './links.js';
import {
  decodeBinary,
  encodeBinary,
  formatLino,
  group,
  named,
  parseLino,
} from './lino.js';
import { createNames } from './names.js';
import { forbidden, withPermissions } from './permissions.js';
import {
  tripletMarkers,
  withTripletPermissions,
  withTriplets,
} from './triplets.js';
import { createTripletsSession, packTriplets } from './triplets-server.js';
import { runQuery, transact } from './query.js';

const OPERATIONS = new Set([
  'count',
  'each',
  'load',
  'name-links',
  'create',
  'update',
  'delete',
  'get-name',
  'set-name',
  'get-by-name',
  'remove-name',
  'auth',
  'subscribe',
  'unsubscribe',
]);

/** The values of an operation argument: `(a b)` → `[a, b]`, `a` → `[a]`. */
const argsOf = (value) => (typeof value === 'string' ? [value] : value.values);

/** The arguments of an operation: `n` words, or a `bad-request` error. */
function one(args, n, what) {
  if (args.length !== n || args.some((a) => typeof a !== 'string')) {
    throw new LinksError('bad-request', `Expected ${what}`);
  }
  return args;
}

/** One change as `(before) (after)`; `ref` writes an address. */
export function changeToLino({ before, after }, ref = String) {
  const side = (link) =>
    group(
      link === null
        ? []
        : [named(ref(link.id), [ref(link.from_id), ref(link.to_id)])]
    );
  return group([side(before), side(after)]);
}

/** Whether `document` is `()`, the request for every link. */
const isEmptyGroup = ([only, ...rest]) =>
  rest.length === 0 &&
  typeof only !== 'string' &&
  only.id === null &&
  only.values.length === 0;

/** `(i: s t)` with numbers. */
const linkLine = (link) =>
  named(String(link.id), [String(link.from_id), String(link.to_id)]);

/**
 * A links server over `links`.
 * @param {object} options
 * @param {any} options.links  the storage
 * @param {any} [options.names]  the names store (a new one by default)
 * @param {ReturnType<typeof import('./permissions.js').createPolicy>} [options.policy]
 *   permissions; without it every session may do everything
 * @param {(token: string) => number | null} [options.authenticate]  the
 *   subject of a token, `null` when the token is not valid
 * @param {boolean} [options.autoCreate]  queries create missing references
 * @param {boolean} [options.triplets]  triplet mode: every request reads as
 *   triplets over `links`, and the markers are created when missing
 */
export function createLinksServer({
  links,
  names = createNames(),
  policy = null,
  authenticate = null,
  autoCreate = false,
  triplets = false,
}) {
  const sessions = new Set();
  // Rules on doublets say nothing of the doublets a triplet is stored in.
  const policyWatch = triplets ? null : policy?.watch?.();
  const server = {
    links,
    names,
    policy,
    authenticate,
    autoCreate,
    sessions,
    policyWatch,
    triplets: triplets
      ? withTriplets(links, { names, markers: tripletMarkers(links, names) })
      : null,
    /** Publish writes and indirect visibility changes to subscriptions. */
    publish(changes, origin) {
      if (triplets) {
        // Triplet mode publishes triplets, not the doublets below them.
        return;
      }
      const writes = changes.filter(({ before, after }) => before !== after);
      if (writes.length === 0) {
        return;
      }
      const affected = policyWatch?.refresh(writes, links);
      for (const session of sessions) {
        session.deliver(
          writes,
          affected?.(session.subject) ?? false,
          session === origin
        );
      }
    },
  };
  return {
    links,
    names,
    policy,
    /** The triplets of `links` in triplet mode; `undefined` otherwise. */
    triplets: server.triplets ?? undefined,
    /**
     * A connection: requests run as its subject.
     * @param {object} [options]
     * @param {number | null} [options.subject]  the subject before any `auth`
     * @param {(document: any[]) => void} [options.onPush]  gets pushed
     *   documents: `(notify: n)` and changes
     */
    session: (options) => openSession(server, options),
    /** The sessions that are open. */
    get sessions() {
      return [...sessions];
    },
  };
}

/**
 * A names store shared by every subject, as one subject sees it: a name of a
 * link it may not refer to is unknown, and taking it over is refused.
 */
function namesOfView(names, view) {
  const hidden = (name) => {
    const id = names.getByName(name);
    return id !== null && !view.canReference(id);
  };
  return {
    ...names,
    getByName: (name) => (hidden(name) ? null : names.getByName(name)),
    setName(id, name) {
      if (hidden(name)) {
        throw forbidden('hidden name');
      }
      return names.setName(id, name);
    },
  };
}

/** Reading addresses and restrictions as the subject of a session sees them. */
function createReader(view, names) {
  const address = (text) => {
    if (/^[0-9]+$/.test(text)) {
      return Number(text);
    }
    if (text === '*') {
      return ANY;
    }
    const id = names.getByName(text);
    if (id === null) {
      throw new LinksError('not-found', `Link not found: ${text}`);
    }
    return id;
  };
  const visibleLink = (id) => {
    const link = getLink(view, id);
    if (link === null) {
      throw new LinksError('not-found', `Link not found: ${id}`);
    }
    return link;
  };
  const restrictionOf = (value) => {
    const parts = argsOf(value);
    if (parts.length > 3 || parts.some((p) => typeof p !== 'string')) {
      throw new LinksError(
        'bad-request',
        'A restriction has up to three parts'
      );
    }
    return parts.map(address);
  };
  /** The links of a restriction, by address. */
  const select = (parts) => {
    if (parts.length === 2) {
      const [id, value] = parts;
      const found = new Map();
      for (const q of [
        { id, from_id: value },
        { id, to_id: value },
      ]) {
        for (const link of allLinks(view, q)) {
          found.set(link.id, link);
        }
      }
      return [...found.values()].sort((a, b) => a.id - b.id);
    }
    return allLinks(view, parts);
  };
  return { address, visibleLink, restrictionOf, select };
}

/** The operations of the protocol for one session. */
function createOperations(server, state, { names, reader, view, write }) {
  const { policy, authenticate } = server;
  const { address, visibleLink, restrictionOf, select } = reader;
  return {
    count: (arg) => [
      named('count', [String(select(restrictionOf(arg)).length)]),
    ],
    each: (arg) => select(restrictionOf(arg)).map(linkLine),
    load(arg) {
      const selected = select(restrictionOf(arg));
      return [
        named('links', [group(selected.map(linkLine))]),
        named('names', [
          group(
            (
              names.dependencies?.(
                selected.flatMap((link) => [link.id, link.from_id, link.to_id])
              ) ?? []
            ).map(linkLine)
          ),
        ]),
      ];
    },
    'name-links'(arg) {
      return (names.dependencies?.(argsOf(arg).map(address)) ?? []).map(
        linkLine
      );
    },
    create(arg) {
      const [s, t] = one(argsOf(arg), 2, '(create: (source target))').map(
        address
      );
      return write((store) => {
        const id = store.create();
        store.update(id, s, t);
      });
    },
    update(arg) {
      const [i, s, t] = one(
        argsOf(arg),
        3,
        '(update: (index source target))'
      ).map(address);
      return write((store) => store.update(i, s, t));
    },
    delete(arg) {
      const [i] = one(argsOf(arg), 1, '(delete: index)').map(address);
      return write((store) => deleteCascade(store, i));
    },
    'get-name'(arg) {
      const [i] = one(argsOf(arg), 1, '(get-name: index)').map(address);
      const name = getLink(view, i) === null ? null : names.getName(i);
      return name === null ? [] : [named('name', [name])];
    },
    'set-name'(arg) {
      const [i, name] = one(argsOf(arg), 2, "(set-name: (index 'name'))");
      const id = address(i);
      const link = visibleLink(id);
      if (policy && !policy.canWrite(state.subject, link)) {
        throw new LinksError('forbidden', `Forbidden: set-name ${id}`);
      }
      write((store, recorded, named, transactionNames) =>
        transactionNames.setName(id, name)
      );
      return [named('link', [String(id)])];
    },
    'get-by-name'(arg) {
      const [name] = one(argsOf(arg), 1, "(get-by-name: 'name')");
      const id = names.getByName(name);
      return id === null || getLink(view, id) === null
        ? []
        : [named('link', [String(id)])];
    },
    'remove-name'(arg) {
      const [i] = one(argsOf(arg), 1, '(remove-name: index)').map(address);
      const link = getLink(view, i);
      if (link !== null) {
        if (policy && !policy.canWrite(state.subject, link)) {
          throw new LinksError('forbidden', `Forbidden: remove-name ${i}`);
        }
        write((store, recorded, named, transactionNames) =>
          transactionNames.removeName(i)
        );
      }
      return [];
    },
    auth(arg) {
      const [token] = one(argsOf(arg), 1, '(auth: token)');
      const found = authenticate ? authenticate(token) : null;
      if (found === null || found === undefined) {
        throw new LinksError('forbidden', 'Forbidden: authentication failed');
      }
      state.subject = found;
      return [named('subject', [String(found)])];
    },
    subscribe(arg) {
      const parts = restrictionOf(arg);
      const [id = ANY, from = ANY, to = ANY] =
        parts.length === 2 ? [parts[0]] : parts;
      const n = state.next++;
      state.subscriptions.set(n, {
        selected: new Map(select(parts).map((link) => [link.id, link])),
        names: new Map(),
        bindings: new Set(),
        query: normalizeQuery([id, from, to]),
        either: parts.length === 2 ? parts[1] : null,
      });
      const subscription = state.subscriptions.get(n);
      for (const link of names.dependencies?.(
        select(parts).flatMap((link) => [link.id, link.from_id, link.to_id])
      ) ?? []) {
        subscription.names.set(link.id, link);
      }
      subscription.bindings = new Set(
        (
          names.bindings?.(
            select(parts).flatMap((link) => [link.id, link.from_id, link.to_id])
          ) ?? []
        ).map((link) => link.id)
      );
      return [named('subscription', [String(n)])];
    },
    unsubscribe(arg) {
      const [n] = one(argsOf(arg), 1, '(unsubscribe: n)');
      state.subscriptions.delete(Number(n));
      return [];
    },
  };
}

/** Diff a subscription's name marks while retaining shared text nodes. */
function includeNames(names, subscription, selected, seen) {
  const current = new Map(
    names
      .dependencies(
        selected.flatMap((link) => [link.id, link.from_id, link.to_id])
      )
      .map((link) => [link.id, link])
  );
  const delta = new Map(
    seen.map((change) => [(change.after ?? change.before).id, change])
  );
  for (const [id, before] of subscription.names) {
    if (!current.has(id) && subscription.bindings.has(id)) {
      delta.set(id, { before, after: null });
    }
  }
  for (const [id, after] of current) {
    const before = subscription.names.get(id) ?? null;
    if (
      !before ||
      before.from_id !== after.from_id ||
      before.to_id !== after.to_id
    ) {
      delta.set(id, { before, after });
    }
  }
  subscription.bindings = new Set(
    names
      .bindings(selected.flatMap((link) => [link.id, link.from_id, link.to_id]))
      .map((link) => link.id)
  );
  subscription.names = current;
  seen.splice(0, seen.length, ...delta.values());
}

/** Only changed values count; newly visible/hidden links have a null side. */
const differs = ({ before, after }) =>
  before?.from_id !== after?.from_id || before?.to_id !== after?.to_id;

/** Diff the saved readable selection against a refreshed one. */
function refreshSubscription(subscription, selected) {
  const previous = subscription.selected;
  subscription.selected = selected;
  return [...new Set([...previous.keys(), ...selected.keys()])]
    .map((id) => ({
      before: previous.get(id) ?? null,
      after: selected.get(id) ?? null,
    }))
    .filter(differs);
}

/** Ordinary writes touch only changed addresses in the saved selection. */
function updateSubscription(subscription, changes, fits) {
  return changes
    .map(({ before, after }) => {
      const id = (after ?? before).id;
      const change = {
        before: subscription.selected.get(id) ?? null,
        after: fits(subscription, after) ? after : null,
      };
      if (change.after) {
        subscription.selected.set(id, change.after);
      } else {
        subscription.selected.delete(id);
      }
      return change;
    })
    .filter(differs);
}

/** The permission-filtered store and names one session reads through. */
function sessionView(server, state) {
  const { links, policy } = server;
  const subjectOf = () => state.subject;
  const doublets = policy ? withPermissions(links, policy, subjectOf) : links;
  const tripletsView =
    server.triplets &&
    (policy
      ? withTripletPermissions(server.triplets, policy, subjectOf)
      : server.triplets);
  const view = tripletsView || doublets;
  const names =
    server.names.withLinks?.(view) ??
    (policy ? namesOfView(server.names, view) : server.names);
  const readable = (link) =>
    !policy || (server.policyWatch ?? policy).canRead(state.subject, link);
  return { view, names, readable };
}

/** Diff one subscription against `changes` and push what it still sees. */
function deliverSubscription(n, subscription, delivery) {
  const { links, names, fits, changes, refresh, own, onPush } = delivery;
  const seen = refresh
    ? refreshSubscription(
        subscription,
        new Map(
          allLinks(links, subscription.query)
            .filter((link) => fits(subscription, link))
            .map((link) => [link.id, link])
        )
      )
    : updateSubscription(subscription, changes, fits);
  if (names.dependencies) {
    const selected = [...subscription.selected.values()];
    includeNames(names, subscription, selected, seen);
  }
  if (own) {
    const written = new Set(
      changes.map(({ before, after }) => (after ?? before).id)
    );
    const indirect = seen.filter(
      ({ before, after }) => !written.has((after ?? before).id)
    );
    seen.splice(0, seen.length, ...indirect);
  }
  if (seen.length > 0 && onPush) {
    onPush([
      named('notify', [String(n)]),
      ...seen.map((change) => changeToLino(change)),
    ]);
  }
}

function openSession(server, { subject = null, onPush = null } = {}) {
  const { links, autoCreate, sessions } = server;
  const state = { subject, subscriptions: new Map(), next: 1 };
  const { view, names, readable } = sessionView(server, state);
  const context = { links: view, base: links, names, autoCreate };
  const nameRef = (id) => names.getName(id) ?? String(id);
  /** Tell the other sessions about `changes`; them as LiNo for the reply. */
  const report = (changes, ref = String) => {
    server.publish(changes, api);
    return changes.map((change) => changeToLino(change, ref));
  };
  const write = (fn, ref = String) => report(transact(context, fn), ref);
  const tripletMode =
    server.triplets &&
    createTripletsSession({
      context,
      state,
      nameRef,
      onPush,
      publish(changes) {
        for (const session of sessions) {
          session.deliverTriplets(changes, session === api);
        }
      },
    });
  const operations = {
    ...createOperations(server, state, {
      names,
      view,
      reader: createReader(view, names),
      write,
    }),
    ...tripletMode?.operations,
  };

  /** Answer one request document. */
  const handle = (document) => {
    try {
      const [first] = document;
      if (document.length === 0 || isEmptyGroup(document)) {
        if (tripletMode) {
          return tripletMode.list();
        }
        return allLinks(view).map((link) =>
          named(nameRef(link.id), [nameRef(link.from_id), nameRef(link.to_id)])
        );
      }
      if (
        document.length === 1 &&
        typeof first !== 'string' &&
        OPERATIONS.has(first.id) &&
        operations[first.id] &&
        first.values.length === 1
      ) {
        return operations[first.id](first.values[0]);
      }
      return tripletMode
        ? tripletMode.query(document)
        : report(runQuery(context, document), nameRef);
    } catch (error) {
      if (!(error instanceof LinksError)) {
        throw error;
      }
      return [named('error', [error.message])];
    }
  };

  const fits = (subscription, link) =>
    link !== null &&
    matches(link, subscription.query) &&
    (subscription.either === null ||
      link.from_id === subscription.either ||
      link.to_id === subscription.either) &&
    readable(link);

  const api = {
    get subject() {
      return state.subject;
    },
    handle,
    /** Answer LiNo text (the text protocol). */
    request(text) {
      let document;
      try {
        document = parseLino(text);
      } catch (error) {
        return formatLino([named('error', [error.message])]);
      }
      state.format = null;
      return formatLino(handle(document));
    },
    /** Answer a binary packet with a packet of the same options. */
    requestBinary(bytes) {
      let decoded;
      try {
        decoded = decodeBinary(bytes);
      } catch (error) {
        return encodeBinary([named('error', [error.message])]);
      }
      if (decoded === null) {
        return encodeBinary([named('error', ['Incomplete binary packet'])]);
      }
      state.format = decoded.options;
      const reply = handle(decoded.document);
      return encodeBinary(
        tripletMode ? packTriplets(reply, decoded.options) : reply,
        decoded.options
      );
    },
    /** Triplet mode: push what the subscriptions of this session ask for. */
    deliverTriplets: (changes, own) => tripletMode?.deliver(changes, own),
    /** Push the changes the subscriptions of this session ask for. */
    deliver(changes, refresh = false, own = false) {
      for (const { before, after } of changes) {
        if (after === null && before !== null) {
          view.forget?.(before.id);
        }
      }
      if (state.subscriptions.size === 0) {
        return;
      }
      const delivery = { links, names, fits, changes, refresh, own, onPush };
      for (const [n, subscription] of state.subscriptions) {
        deliverSubscription(n, subscription, delivery);
      }
    },
    close() {
      sessions.delete(api);
      if (![...sessions].some((session) => session.subject === state.subject)) {
        server.policyWatch?.forget(state.subject);
      }
    },
  };
  sessions.add(api);
  return api;
}
