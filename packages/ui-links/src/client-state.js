/** LiNo checkpoint for the synced client's queue and address bookkeeping. */
import { formatLinks, parseLinks } from '@link-foundation/ui-core';
import { MAX_ADDRESS } from './constants.js';
import { group, named } from './lino.js';
import { LinksError } from './links.js';

const linkValue = (link) =>
  link === null
    ? 'none'
    : group([link.id, link.from_id, link.to_id].map(String));
const readLink = (value) =>
  value === 'none'
    ? null
    : {
        id: Number(value[0]),
        from_id: Number(value[1]),
        to_id: Number(value[2]),
      };

export const emptyClientState = () => ({
  connected: false,
  nextTemp: MAX_ADDRESS,
  real: [],
  refused: [],
  queue: [],
  subscriptions: [],
  nextSubscription: 1,
});

export function writeClientState(state) {
  return formatLinks([
    named('sync', [
      named('connected', [String(state.connected)]),
      named('next', [String(state.nextTemp)]),
      named('subscription-counter', [String(state.nextSubscription)]),
      named(
        'remaps',
        state.real.map(([a, b]) => group([String(a), String(b)]))
      ),
      named('refused', state.refused.map(String)),
      named(
        'subscriptions',
        state.subscriptions.map(([id, restriction]) =>
          named(
            String(id),
            restriction.map((v) =>
              v === null || v === undefined ? '*' : String(v)
            )
          )
        )
      ),
      named(
        'outbox',
        state.queue.map((entry) =>
          named(entry.kind, [
            ...[entry.id, entry.source, entry.target].map(String),
            ...entry.changes.map(({ before, after }) =>
              named('change', [linkValue(before), linkValue(after)])
            ),
          ])
        )
      ),
    ]),
  ]);
}

export function readClientState(text) {
  if (!text) {
    return emptyClientState();
  }
  const [root] = parseLinks(text);
  if (root?.id !== 'sync') {
    throw new LinksError('bad-request', 'Expected sync checkpoint');
  }
  const fields = new Map(
    root.values.map((v) => (typeof v === 'string' ? [v, []] : [v.id, v.values]))
  );
  return {
    connected: fields.get('connected')?.[0] === 'true',
    nextTemp: Number(fields.get('next')[0]),
    nextSubscription: Number(fields.get('subscription-counter')[0]),
    real: fields.get('remaps').map((v) => v.map(Number)),
    refused: (fields.get('refused') ?? []).map(Number),
    subscriptions: fields
      .get('subscriptions')
      .map((v) => [
        Number(typeof v === 'string' ? v : v.id),
        (v.values ?? []).map((p) => (p === '*' ? null : Number(p))),
      ]),
    queue: fields.get('outbox').map((v) => ({
      kind: v.id,
      id: Number(v.values[0]),
      source: Number(v.values[1]),
      target: Number(v.values[2]),
      changes: v.values.slice(3).map((c) => ({
        before: readLink(c.values[0]),
        after: readLink(c.values[1]),
      })),
    })),
  };
}
