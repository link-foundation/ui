/**
 * The triplet mode of the server against link-cli's conversation
 * (`tests/fixtures/triplets.txt`, a copy of `docs/protocol/triplets.txt`).
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import { ArityRange, BinaryLinoOptions } from 'links-notation';
import {
  ANY,
  canonicalTriplets,
  createLinksServer,
  createMemoryLinks,
  createNames,
  decodeBinary,
  encodeBinary,
  formatLino,
  packTriplets,
  parseLino,
  withTriplets,
} from '@link-foundation/ui-links';
import { world } from './helpers.js';

const fixture = readFileSync(
  new URL('./fixtures/triplets.txt', import.meta.url),
  'utf8'
);

/** The steps of the conversation, as `triplets_protocol_tests.rs` reads them. */
function conversation(text) {
  const steps = [];
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const marker = line.slice(0, 2);
    if (['A>', 'B>', 'A<', 'B<'].includes(marker)) {
      const isPush = marker[1] === '<';
      const rest = line.slice(3);
      steps.push({
        connection: marker[0],
        isPush,
        message: rest,
        expected: isPush ? [rest] : [],
      });
    } else {
      steps.at(-1).expected.push(line);
    }
  }
  return steps;
}

/**
 * Replies that differ on purpose: link-cli's `(link: …)` of `set-name` is the
 * address of the link that holds the name in its names store; this server
 * answers the address named, as it does without triplets.
 */
const DEVIATIONS = { '(set-name: (3 Person))': ['(link: 3)'] };

/** A connection as text. */
function textClient(session, pushes) {
  return {
    ask: (request) => session.request(request),
    pushes,
    format: formatLino,
  };
}

/** A connection as binary packets of `options`. */
function binaryClient(session, pushes, options) {
  return {
    ask(request) {
      const packet = encodeBinary(parseLino(request), options);
      const reply = decodeBinary(session.requestBinary(packet));
      return formatLino(canonicalTriplets(reply.document));
    },
    pushes,
    format: (push) =>
      formatLino(
        canonicalTriplets(decodeBinary(encodeBinary(push, options)).document)
      ),
  };
}

function connect(server, options) {
  const pushes = [];
  const session = server.session({ onPush: (push) => pushes.push(push) });
  return options
    ? binaryClient(session, pushes, options)
    : textClient(session, pushes);
}

function replay(first, second) {
  const server = createLinksServer({
    links: createMemoryLinks(),
    triplets: true,
  });
  const clients = { A: connect(server, first), B: connect(server, second) };
  for (const step of conversation(fixture)) {
    const client = clients[step.connection];
    if (step.isPush) {
      expect(client.format(client.pushes.shift())).toBe(
        step.expected.join('\n')
      );
      continue;
    }
    const reply = client.ask(step.message);
    const expected = DEVIATIONS[step.message] ?? step.expected;
    expect([step.message, reply]).toEqual([
      step.message,
      expected[0]?.startsWith('! ')
        ? formatLino(parseLino(`(error: '${expected[0].slice(2)}')`))
        : expected.join('\n'),
    ]);
    expect(client.pushes.length).toBe(0);
  }
  expect(clients.A.pushes.length + clients.B.pushes.length).toBe(0);
}

const ARITIES = [
  ['2', new ArityRange(2, 2)],
  ['2..3', new ArityRange(2, 3)],
  ['1..', new ArityRange(1, null)],
];

const binaryOptions = ARITIES.flatMap(([arity, range]) =>
  [false, true].flatMap((external) =>
    [false, true].map((packed) => ({
      label: `arity ${arity}, external references ${external}, packed widths ${packed}`,
      options: new BinaryLinoOptions(external, range, packed),
    }))
  )
);

describe('the triplet conversation of link-cli', () => {
  it('has the 48 steps of link-cli', () => {
    expect(conversation(fixture).length).toBe(48);
  });

  it('replays over the text protocol', () => {
    replay(null, null);
  });

  for (const { label, options } of binaryOptions) {
    it(`replays over the binary protocol, ${label}`, () => {
      replay(options, options);
    });
  }

  it('replays with one text and one binary connection', () => {
    replay(null, binaryOptions[4].options);
  });
});

/** A session of `server` whose pushes land in `pushes`. */
function open(server, token) {
  const pushes = [];
  const session = server.session({ onPush: (push) => pushes.push(push) });
  if (token) {
    session.request(`(auth: ${token})`);
  }
  return { ask: (text) => session.request(text), pushes };
}

const permitted = () => {
  const fixture = world();
  const server = createLinksServer({
    links: fixture.links,
    names: fixture.names,
    policy: fixture.policy,
    authenticate: (token) => fixture.v[token] ?? null,
    triplets: true,
  });
  return { ...fixture, server };
};

describe('triplet mode with permissions', () => {
  it('reads and writes only the triplets a subject may', () => {
    const { server, t, v } = permitted();
    const alice = open(server, 'alice');
    const boss = open(server, 'boss');
    const { note, shared, secret } = v;

    expect(boss.ask(`(each: (${secret}))`)).toBe(
      `(${secret}: ${t.Secret} 0 0)`
    );
    expect(alice.ask(`(each: (${secret}))`)).toBe('');
    expect(alice.ask(`(each: (* ${t.Secret}))`)).toBe('');
    expect(alice.ask(`(each: (${note}))`)).toBe(`(${note}: ${t.Note} 0 0)`);
    expect(alice.ask(`(each: (${shared}))`)).toBe(
      `(${shared}: ${t.Shared} 0 0)`
    );
    expect(alice.ask(`(count: (${secret}))`)).toBe('(count: 0)');

    const created = parseLino(
      alice.ask(`(create: (${t.Note} ${note} ${shared}))`)
    );
    const index = created[0].values[1].values[0].id;
    expect(alice.ask(`(update: (${index} ${t.Note} ${shared} ${note}))`)).toBe(
      `((${index}: ${t.Note} ${note} ${shared})) ((${index}: ${t.Note} ${shared} ${note}))`
    );

    for (const refused of [
      `(create: (${t.Secret} 0 0))`,
      `(update: (${index} ${t.Secret} 0 0))`,
    ]) {
      expect(alice.ask(refused)).toContain('Forbidden');
    }
    for (const hidden of [
      `(delete: ${secret})`,
      `(update: (${secret} ${t.Note} 0 0))`,
      `(create: (${t.Note} ${secret} 0))`,
    ]) {
      expect(alice.ask(hidden)).toContain('is not a triplet');
    }

    // A triplet of boss that uses the note hides in the cascade.
    const reply = parseLino(
      boss.ask(`(create: (${t.Secret} ${note} ${note}))`)
    );
    const secretUser = reply[0].values[1].values[0].id;
    expect(alice.ask(`(delete: ${note})`)).toContain('Forbidden');
    expect(boss.ask(`(each: (${secretUser}))`)).toBe(
      `(${secretUser}: ${t.Secret} ${note} ${note})`
    );
    expect(boss.ask(`(each: (${note}))`)).toBe(`(${note}: ${t.Note} 0 0)`);
    expect(boss.ask(`(delete: ${note})`).split('\n')[0]).toBe(
      `((${note}: ${t.Note} 0 0)) ()`
    );
  });

  it('keeps the points a subject created, and a guest writes nothing', () => {
    const { server, t, v } = permitted();
    const alice = open(server, 'alice');
    const boss = open(server, 'boss');
    const { note } = v;

    const reply = parseLino(alice.ask('(create: (0 0 0))'));
    const point = reply[0].values[1].values[0].id;
    expect(alice.ask(`(each: (${point}))`)).toBe(`(${point}: ${point} 0 0)`);
    expect(boss.ask(`(update: (${point} ${point} ${note} 0))`)).not.toContain(
      'error'
    );
    expect(alice.ask(`(each: (${point}))`)).toBe('');

    expect(alice.ask('() ((90000: 90000 0 0))')).toBe(
      '() ((90000: 90000 0 0))'
    );
    expect(alice.ask(`() ((90001: ${t.Note} 0 0))`)).toContain(
      'is not a triplet'
    );
    expect(alice.ask('(delete: 90000)')).toBe('((90000: 90000 0 0)) ()');

    const guest = open(server);
    for (const request of [
      '(create: (0 0 0))',
      `(create: (${t.Note} 0 0))`,
      '() ((90001: 90001 0 0))',
    ]) {
      expect(guest.ask(request)).toContain('Forbidden');
    }
    expect(guest.ask('(count: ())')).toBe('(count: 0)');
  });

  it('pushes a subscriber only the triplets its subject may read', () => {
    const { server, t, v } = permitted();
    const subscriber = open(server, 'alice');
    const writer = open(server, 'boss');
    const { alice, note, secret } = v;
    subscriber.ask('(subscribe: ())');

    writer.ask(`(update: (${secret} ${t.Secret} ${alice} 0))`);
    expect(subscriber.pushes).toEqual([]);
    writer.ask(`(update: (${note} ${t.Note} ${alice} 0))`);
    expect(subscriber.pushes.map((push) => formatLino(push))).toEqual([
      `(notify: 1)\n((${note}: ${t.Note} 0 0)) ((${note}: ${t.Note} ${alice} 0))`,
    ]);
  });
});

describe('triplet mode', () => {
  const server = () =>
    createLinksServer({ links: createMemoryLinks(), triplets: true });

  it('matches nothing with a reserved number in a query', () => {
    const session = server().session();
    session.request('(create: (0 0 0))');
    session.request('(create: (0 0 0))');
    for (const pattern of [`(${ANY}: * * *)`, `(${ANY} * *)`]) {
      expect(session.request(`(${pattern} ())`)).toBe('');
    }
    expect(session.request('(count: ())')).toBe('(count: 2)');
  });

  it('shows its view as `triplets`, and has none in the other mode', () => {
    const running = server();
    expect(running.triplets.createTripletPoint()).toBe(3);
    expect(createLinksServer({ links: createMemoryLinks() }).triplets).toBe(
      undefined
    );
  });

  it('packs a push for a binary client of two to three references', () => {
    const options = new BinaryLinoOptions(false, new ArityRange(2, 3), false);
    const pushes = [];
    const running = server();
    const subscriber = running.session({ onPush: (d) => pushes.push(d) });
    const writer = running.session();
    subscriber.requestBinary(
      encodeBinary(parseLino('(subscribe: ())'), options)
    );
    writer.request('(create: (0 0 0))');
    expect(pushes.map((push) => formatLino(push))).toEqual([
      '(notify: 1)\n() ((3: (3 0 0)))',
    ]);
  });

  it('carries each triplet as one link of three references when asked', () => {
    const running = server();
    const text = running.session();
    for (const request of [
      '(create: (0 0 0))',
      '(create: (0 0 0))',
      '(create: (3 0 0))',
      '(create: (3 0 0))',
      '(create: (4 5 6))',
    ]) {
      text.request(request);
    }
    const session = running.session();
    const ask = (range) => {
      const options = new BinaryLinoOptions(true, range, false);
      const bytes = encodeBinary(parseLino('(each: (* 4 5 6))'), options);
      return formatLino(decodeBinary(session.requestBinary(bytes)).document);
    };
    expect(ask(new ArityRange(2, 3))).toBe('(9: (4 5 6))');
    expect(ask(new ArityRange(2, 2))).toBe('(9: 4 5 6)');
  });

  it('packs only the triplets of a format with three references but not five', () => {
    const document = parseLino(
      '((1: 2 3 4)) ((1: 2 3 5))\n(count: 1)\n(name: a)'
    );
    const format = (min, max) => ({ arity: new ArityRange(min, max) });
    const packed = packTriplets(document, format(2, 3));
    expect(formatLino(packed)).toBe(
      '((1: (2 3 4))) ((1: (2 3 5)))\n(count: 1)\n(name: a)'
    );
    expect(canonicalTriplets(packed)).toEqual(document);
    for (const other of [undefined, format(2, 2), format(1, null)]) {
      expect(packTriplets(document, other)).toEqual(document);
    }
  });

  it('keeps the triplets of an existing store readable', () => {
    const links = createMemoryLinks();
    const names = createNames();
    const triplets = withTriplets(links, { names });
    const point = triplets.createTripletPoint();
    const index = triplets.createTriplet(point, 0, 0);
    const session = createLinksServer({
      links,
      names,
      triplets: true,
    }).session();
    expect(session.request(`(each: (${index}))`)).toBe(
      `(${index}: ${point} 0 0)`
    );
  });

  it('has no doublet extensions, as the doublets never appear', () => {
    const session = server().session();
    session.request('(create: (0 0 0))');
    for (const request of ['(load: ())', '(name-links: (3))']) {
      expect(session.request(request)).toContain('error');
    }
  });

  it('does not change a server without the mode', () => {
    const session = createLinksServer({ links: createMemoryLinks() }).session();
    expect(session.request('(create: (0 0))')).toBe('() ((1: 0 0))');
    expect(session.request('(each: (* * *))')).toBe('(1: 0 0)');
    for (const request of [
      '(create: (1 1 1))',
      '(update: (1 1 1 1))',
      '(each: (1 2 3 4))',
    ]) {
      expect(session.request(request)).toContain('error');
    }
    expect(session.request('(count: ())')).toBe('(count: 1)');
  });

  it('refuses an argument that is not a number with its text', () => {
    const session = server().session();
    expect(session.request('(create: (a 0 0))')).toBe(
      `(error: "expected a number, found 'a'")`
    );
    expect(session.request('(delete: (1 2))')).toBe(
      "(error: 'expected a number, found (1 2)')"
    );
  });
});
