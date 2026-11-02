/**
 * Links Notation for the links protocols, through links-notation's
 * `BinaryLinoCodec`: the canonical text of link-cli (`formatDocument`,
 * `parseDocument`) and its binary packets (`encode`, `decode`).
 *
 * The document model is the one of `@link-foundation/link-cli-client`: a
 * reference is a string, a link is `{ id: string | null, values }`.
 */

import {
  BinaryLinoCodec,
  BinaryLinoOptions,
  Link,
  PacketReader,
} from 'links-notation';
import { ensureCreated, allLinks, LinksError, isAddress } from './links.js';
import { isName } from './names.js';

/** @typedef {string | { id: string | null, values: LinoValue[] }} LinoValue */

const codec = new BinaryLinoCodec();

/** links-notation's `Link` → the document model. */
function fromCodec(link) {
  if (link.id !== null && link.id !== undefined && link.values.length === 0) {
    return link.id;
  }
  return { id: link.id ?? null, values: link.values.map(fromCodec) };
}

/** The document model → links-notation's `Link`. */
function toCodec(value) {
  if (typeof value === 'string') {
    return new Link(value, []);
  }
  return new Link(value.id ?? null, value.values.map(toCodec));
}

/** A link without an id: `(a b)`. */
export const group = (values) => ({ id: null, values });
/** A link with an id: `(id: a b)`. */
export const named = (id, values) => ({ id, values });

/**
 * Parse canonical LiNo text.
 * @param {string} text
 * @returns {LinoValue[]}
 */
export function parseLino(text) {
  try {
    return codec.parseDocument(text).map(fromCodec);
  } catch (error) {
    throw new LinksError('bad-request', `Not Links Notation: ${error.message}`);
  }
}

/**
 * Write a document as canonical LiNo text, one top-level link per line.
 * @param {LinoValue[]} document
 */
export const formatLino = (document) =>
  codec.formatDocument(document.map(toCodec));

/** Whether `bytes` start a binary packet (`0x10`..`0x1F`). */
export const isBinary = (bytes) =>
  bytes.length > 0 && bytes[0] >= 0x10 && bytes[0] <= 0x1f;

/**
 * Read one binary packet from the start of `bytes`.
 * @returns {{ document: LinoValue[], options: any, size: number } | null}
 *   `null` when the packet is not complete yet
 */
export function decodeBinary(bytes) {
  const reader = new PacketReader(bytes);
  let packet;
  try {
    packet = reader.read();
  } catch (error) {
    if (String(error.message).includes('unexpected end')) {
      return null;
    }
    throw new LinksError(
      'bad-request',
      `Not a binary packet: ${error.message}`
    );
  }
  if (packet === null) {
    return null;
  }
  const options = BinaryLinoOptions.ofPacket(packet);
  const document = new BinaryLinoCodec(options)
    .decodePacket(packet)
    .map(fromCodec);
  return { document, options, size: reader.offset };
}

/**
 * Write a document as one binary packet.
 * @param {LinoValue[]} document
 * @param {any} [options]  the `BinaryLinoOptions` of the request
 */
export const encodeBinary = (document, options) =>
  new BinaryLinoCodec(options).encode(document.map(toCodec));

/** A number of a reference, or the reference itself. */
const numberOr = (text) => (/^[0-9]+$/.test(text) ? Number(text) : text);

/**
 * Every link as `(index: source target)` lines, the export format of
 * link-cli; with `names`, a named address is written as its name.
 * @param {any} links
 * @param {{ names?: any }} [options]
 */
export function linksToLino(links, { names } = {}) {
  const ref = (id) => names?.getName(id) ?? String(id);
  return formatLino(
    allLinks(links).map((link) =>
      named(ref(link.id), [ref(link.from_id), ref(link.to_id)])
    )
  );
}

/**
 * Read `(index: source target)` lines into `links` (link-cli's `--in`): a
 * number is an address, a name is the link of that name, a new link when
 * nothing has it yet. Returns the addresses written, in order.
 * @param {any} links
 * @param {string} text
 * @param {{ names?: any }} [options]
 */
export function linksFromLino(links, text, { names } = {}) {
  const lines = parseLino(text).map((link) => {
    if (
      typeof link === 'string' ||
      link.id === null ||
      link.values.length !== 2 ||
      link.values.some((v) => typeof v !== 'string')
    ) {
      throw new LinksError(
        'bad-request',
        `Expected (index: source target), found ${formatLino([link])}`
      );
    }
    return [link.id, ...link.values].map(numberOr);
  });
  const address = (ref) => {
    if (typeof ref === 'number') {
      if (!isAddress(ref) && ref !== 0) {
        throw new LinksError('bad-reference', `Not a link address: ${ref}`);
      }
      if (ref !== 0) {
        ensureCreated(links, ref);
      }
      return ref;
    }
    if (!names || !isName(ref)) {
      throw new LinksError('bad-reference', `Unknown reference: ${ref}`);
    }
    const known = names.getByName(ref);
    if (known !== null) {
      ensureCreated(links, known);
      return known;
    }
    const id = links.create();
    links.update(id, id, id);
    names.setName(id, ref);
    return id;
  };
  const ids = lines.map(([id]) => address(id));
  lines.forEach(([, source, target], i) =>
    links.update(ids[i], address(source), address(target))
  );
  return ids;
}

/** The names as `(index: name)` lines, the names sidecar. */
export const namesToLino = (names) =>
  formatLino(names.entries().map(([id, name]) => named(String(id), [name])));

/** Read `(index: name)` lines into `names`. */
export function namesFromLino(names, text) {
  for (const link of parseLino(text)) {
    if (
      typeof link === 'string' ||
      link.values.length !== 1 ||
      typeof link.values[0] !== 'string' ||
      !/^[0-9]+$/.test(link.id ?? '')
    ) {
      throw new LinksError(
        'bad-request',
        `Expected (index: name), found ${formatLino([link])}`
      );
    }
    names.setName(Number(link.id), link.values[0]);
  }
  return names;
}
