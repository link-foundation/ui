/**
 * Mapping tables (`<format>/mapping.lino`).
 *
 * A table is plain Links Notation read by `links-notation`. Its links are:
 *
 *   (element <json type> <kind> [since <version>])
 *   (property <json type or *> <json key> <lino property> [since <version>])
 *   (values <lino property> (<json value> <lino value>)...)
 *   (group <name> <json type>...)
 *   (since <json type> <version>)
 *
 * `*` makes a property apply to every element type; a group name makes it
 * apply to every type of the group. Property values are
 * written with the lossless `any` encoding (see extra.js) unless a `values`
 * link renames them.
 */

import { parseNested } from '@link-foundation/ui-core';
import { decodeAny, encodeAny } from './extra.js';
import { readSibling } from './vocabulary.js';

const plain = (link) =>
  link.values.length === 0 ? link.id : link.values.map(plain);

/**
 * Read the links of a table as nested arrays of strings.
 * @param {string} text
 * @returns {(string|string[])[][]}
 */
export const readTable = (text) => parseNested(text).map(plain);

/** The value after a `since` marker in a link, or `undefined`. */
function since(link) {
  const at = link.indexOf('since');
  return at === -1 ? undefined : link[at + 1];
}

/**
 * A mapping read from a table.
 */
export class Mapping {
  /** @param {(string|string[])[][]} links */
  constructor(links) {
    /** json type -> { kind, since } */
    this.elements = new Map();
    /** kind -> json types (in table order) */
    this.byKind = new Map();
    /** json type ('*' for all) -> [{ key, name, since }] */
    this.properties = new Map();
    /** lino property -> { toLino: Map, toJson: Map } */
    this.values = new Map();
    /** group -> json types */
    this.groups = new Map();
    /** json type -> the version it was added in */
    this.typeSince = new Map();
    for (const link of links) {
      this.add(link);
    }
  }

  add(link) {
    const [head, ...rest] = link;
    if (head === 'element') {
      const [type, kind] = rest;
      this.elements.set(type, { kind, since: since(rest) });
      this.byKind.set(kind, [...(this.byKind.get(kind) ?? []), type]);
      if (since(rest) !== undefined) {
        this.typeSince.set(type, since(rest));
      }
    } else if (head === 'property') {
      const [type, key, name] = rest;
      const list = this.properties.get(type) ?? [];
      list.push({ key, name, since: since(rest) });
      this.properties.set(type, list);
    } else if (head === 'group') {
      const [name, ...types] = rest;
      this.groups.set(name, new Set(types));
    } else if (head === 'since') {
      this.typeSince.set(rest[0], rest[1]);
    } else if (head === 'values') {
      const [name, ...pairs] = rest;
      this.values.set(name, {
        toLino: new Map(pairs.map(([json, lino]) => [json, lino])),
        toJson: new Map(pairs.map(([json, lino]) => [lino, json])),
      });
    }
  }

  /**
   * The mapped properties of a JSON type (its own and the `*` ones).
   * @param {string} type
   */
  propertiesOf(type) {
    const groups = [...this.groups]
      .filter(([, types]) => types.has(type))
      .map(([name]) => name);
    return [type, ...groups, '*'].flatMap(
      (name) => this.properties.get(name) ?? []
    );
  }

  /**
   * Whether a JSON type is in a group.
   * @param {string} group
   * @param {string} type
   */
  inGroup(group, type) {
    return Boolean(this.groups.get(group)?.has(type));
  }

  /** Rename a JSON value to its LiNo value (or keep it). */
  toLino(name, json) {
    return this.values.get(name)?.toLino.get(json) ?? json;
  }

  /** Rename a LiNo value back to its JSON value (or keep it). */
  toJson(name, lino) {
    return this.values.get(name)?.toJson.get(lino) ?? lino;
  }

  /**
   * Encode one JSON value of a LiNo property: renamed by the table, or with
   * the `any` encoding. Returns `null` when the encoded value would read
   * back as a renamed one (such a value is kept in `extra` instead).
   * @param {string} name
   * @param {unknown} json
   * @returns {string|null}
   */
  encode(name, json) {
    const table = this.values.get(name);
    if (!table) {
      return encodeAny(json);
    }
    if (typeof json === 'string' && table.toLino.has(json)) {
      return table.toLino.get(json);
    }
    const text = encodeAny(json);
    return table.toJson.has(text) ? null : text;
  }

  /**
   * Decode one LiNo value of a property written by {@link encode}.
   * @param {string} name
   * @param {import('@link-foundation/ui-core').RawValue} raw
   */
  decode(name, raw) {
    const table = this.values.get(name);
    return typeof raw === 'string' && table?.toJson.has(raw)
      ? table.toJson.get(raw)
      : decodeAny(raw);
  }

  /**
   * Map the known keys of a JSON object of `type` to LiNo properties.
   * @param {string} type
   * @param {Record<string, unknown>} object
   * @returns {{ properties: { name: string, values: string[] }[],
   *   handled: Set<string> }}
   */
  importProperties(type, object) {
    const properties = [];
    const handled = new Set();
    for (const { key, name } of this.propertiesOf(type)) {
      if (!(key in object) || handled.has(key)) {
        continue;
      }
      const text = this.encode(name, object[key]);
      if (text !== null) {
        properties.push({ name, values: [text] });
        handled.add(key);
      }
    }
    return { properties, handled };
  }

  /**
   * Map the LiNo properties of a node back to the JSON keys of `type`.
   * @param {string} type
   * @param {(name: string) => import('@link-foundation/ui-core').RawValue|undefined} read
   * @returns {Record<string, unknown>}
   */
  exportProperties(type, read) {
    const out = {};
    for (const { key, name } of this.propertiesOf(type)) {
      const raw = read(name);
      if (raw !== undefined && !(key in out)) {
        out[key] = this.decode(name, raw);
      }
    }
    return out;
  }

  /**
   * The version a JSON key of `type` was added in, or `undefined`.
   * @param {string} type
   * @param {string} key
   */
  keySince(type, key) {
    return this.propertiesOf(type).find((p) => p.key === key)?.since;
  }
}

/**
 * Load the `mapping.lino` next to a module.
 * @param {string} moduleUrl `import.meta.url` of the module
 */
export const loadMapping = (moduleUrl) =>
  new Mapping(readTable(readSibling(moduleUrl, './mapping.lino')));
