/**
 * The triplet mode of a links server (`createLinksServer({ triplets: true })`,
 * `clink --serve --triplets`): every request reads as triplets, because
 * `(delete: i)`, `(count: ())` and a substitution query look the same in both
 * worlds. The conversation is link-cli's `docs/protocol/triplets.txt`:
 *
 *   (count: (i T f t))        -> (count: N)
 *   (each: (i T f t))         -> (i: T f t) per match, by address
 *   (create: (T f t))         -> () ((i: T f t))
 *   (create: (0 0 0))         -> () ((i: i 0 0)), a point
 *   (update: (i T f t))       -> ((i: T f t)) ((i: T2 f2 t2))
 *   (delete: i)               -> ((i: T f t)) () per removed triplet, i first
 *   (subscribe: (i T f t))    -> (subscription: n); later (notify: n) and changes
 *   ()                        -> every triplet, names for named references
 *   anything else             -> a substitution query over triplets
 *
 * The other operations are those of the server without the mode, except for
 * `load` and `name-links`: the doublets that store a triplet never appear.
 *
 * A binary reply or push whose arity holds three references but not the five
 * of `(i: T f t)`, such as `2..3`, carries a triplet as `(i: (T f t))`.
 */

import { linkOf, LinksError } from './links.js';
import { formatLino, group, named } from './lino.js';
import { runQuery, transactTriplets } from './query.js';
import { matchesTriplet } from './triplets.js';

const MAX_ADDRESS = 0xffffffff;

const badRequest = (message) => new LinksError('bad-request', message);

/** The values of an argument: `(a b)` → `[a, b]`, anything else → itself. */
const partsOf = (value) =>
  typeof value !== 'string' && value.id === null ? value.values : [value];

/** One argument as it was written: a document line would lose parentheses. */
function formatArgument(value) {
  if (typeof value === 'string') {
    return value;
  }
  return value.id === null
    ? `(${value.values.map(formatArgument).join(' ')})`
    : formatLino([value]);
}

/** The address an argument spells. */
function numberOf(value) {
  if (typeof value !== 'string') {
    throw badRequest(`expected a number, found ${formatArgument(value)}`);
  }
  const number = /^[0-9]+$/.test(value) ? Number(value) : NaN;
  if (!(number <= MAX_ADDRESS)) {
    throw badRequest(`expected a number, found '${value}'`);
  }
  return number;
}

/** Exactly `count` addresses. */
function numbersOf(value, count) {
  const numbers = partsOf(value).map(numberOf);
  if (numbers.length !== count) {
    throw badRequest(
      `expected ${count} numbers, found ${formatArgument(value)}`
    );
  }
  return numbers;
}

/** A restriction of up to four parts: `*` matches anything, as does a part left out. */
function restrictionOf(value) {
  const parts = partsOf(value);
  if (parts.length > 4) {
    throw badRequest(`expected restriction, found ${formatArgument(value)}`);
  }
  return parts.map((part) => (part === '*' ? null : numberOf(part)));
}

/** `(i: T f t)`; `ref` writes a reference. */
const tripletLine = ({ index, type, from, to }, ref = String) =>
  named(ref(index), [ref(type), ref(from), ref(to)]);

/** One change as `(before) (after)`; `ref` writes a reference. */
const changeLine = ({ before, after }, ref) => {
  const side = (triplet) => group(triplet ? [tripletLine(triplet, ref)] : []);
  return group([side(before), side(after)]);
};

const sameTriplet = (a, b) =>
  a?.index === b?.index &&
  a?.type === b?.type &&
  a?.from === b?.from &&
  a?.to === b?.to;

/** `(i: T f t)` → `(i: (T f t))`, in the groups of a document too. */
function packLine(line) {
  if (typeof line === 'string') {
    return line;
  }
  if (line.id === null) {
    return group(line.values.map(packLine));
  }
  return line.values.length === 3 ? named(line.id, [group(line.values)]) : line;
}

/** `(i: (T f t))` → `(i: T f t)`, in the groups of a document too. */
function unpackLine(line) {
  if (typeof line === 'string') {
    return line;
  }
  if (line.id === null) {
    return group(line.values.map(unpackLine));
  }
  const [only] = line.values;
  return line.values.length === 1 &&
    typeof only !== 'string' &&
    only.id === null &&
    only.values.length === 3
    ? named(line.id, only.values)
    : line;
}

/**
 * The document as a binary format of `options` carries it; text (no options)
 * and an arity that holds five references keep it as it is.
 * @param {any[]} document
 * @param {any} [options]  the `BinaryLinoOptions` of the connection
 */
export const packTriplets = (document, options) =>
  options?.arity.contains(3) && !options.arity.contains(5)
    ? document.map(packLine)
    : document;

/** The inverse of `packTriplets`: the document in its canonical form. */
export const canonicalTriplets = (document) => document.map(unpackLine);

/**
 * The triplet requests of one session.
 * @param {object} session
 * @param {any} session.context  the query context: `links` is the triplets view
 * @param {{ subscriptions: Map<number, any>, next: number, format?: any }} session.state
 * @param {(id: number) => string} session.nameRef  a reference as a name
 * @param {(changes: any[]) => void} session.publish  tell every session
 * @param {(document: any[]) => void} [session.onPush]
 */
export function createTripletsSession({
  context,
  state,
  nameRef,
  publish,
  onPush,
}) {
  const view = context.links;
  /** Tell the sessions what changed; the changes as LiNo for the reply. */
  const report = (changes, ref) => {
    const writes = changes.filter(
      ({ before, after }) => !sameTriplet(before, after)
    );
    if (writes.length > 0) {
      publish(writes);
    }
    return changes.map((change) => changeLine(change, ref));
  };
  const write = (fn) => report(transactTriplets(context, fn));
  const readable = ({ index, type }) =>
    view.readable?.(linkOf(index, type, index)) ?? true;

  return {
    operations: {
      count: (arg) => [
        named('count', [String(view.countTriplets(restrictionOf(arg)))]),
      ],
      each: (arg) =>
        view.eachTriplet(restrictionOf(arg)).map((t) => tripletLine(t)),
      create(arg) {
        const [type, from, to] = numbersOf(arg, 3);
        return write((store) => {
          if (type === 0 && from === 0 && to === 0) {
            const index = store.createTripletPoint();
            return [
              {
                before: null,
                after: { index, type: index, from: 0, to: 0 },
              },
            ];
          }
          const index = store.createTriplet(type, from, to);
          return [{ before: null, after: { index, type, from, to } }];
        });
      },
      update(arg) {
        const [index, type, from, to] = numbersOf(arg, 4);
        return write((store) => [
          {
            before: store.updateTriplet(index, type, from, to),
            after: { index, type, from, to },
          },
        ]);
      },
      delete(arg) {
        const index = numberOf(arg);
        return write((store) =>
          store.deleteTriplet(index).map((before) => ({ before, after: null }))
        );
      },
      subscribe(arg) {
        const n = state.next++;
        state.subscriptions.set(n, {
          query: restrictionOf(arg),
          format: state.format,
        });
        return [named('subscription', [String(n)])];
      },
      load: null,
      'name-links': null,
    },
    /** The reply to the empty request: every triplet the session may read. */
    list: () => view.eachTriplet().map((t) => tripletLine(t, nameRef)),
    /** A substitution query; its reply names what has a name. */
    query: (document) => report(runQuery(context, document), nameRef),
    /** Push the changes the subscriptions ask for; never a session's own. */
    deliver(changes, own) {
      for (const [n, { query, format }] of own ? [] : state.subscriptions) {
        const side = (triplet) =>
          triplet && matchesTriplet(triplet, query) && readable(triplet)
            ? triplet
            : null;
        const seen = changes
          .map(({ before, after }) => ({
            before: side(before),
            after: side(after),
          }))
          .filter(({ before, after }) => before || after);
        if (seen.length > 0) {
          onPush?.(
            packTriplets(
              [
                named('notify', [String(n)]),
                ...seen.map((change) => changeLine(change)),
              ],
              format
            )
          );
        }
      }
      for (const { before, after } of changes) {
        if (after === null) {
          view.forget?.(before.index);
        }
      }
    },
  };
}
