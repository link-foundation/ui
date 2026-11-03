import { Link, Parser } from 'links-notation';
import { normalizeLink } from '@link-foundation/ui-core/source';
import { annotateLinks, formatNetworkRoots } from './lino-network-source.js';

// Indented groups hold values of their parent, before path normalisation.
const unindent = ({ element, children }) =>
  new Link(element.id, [...element.values, ...children.map(unindent)]);

const numeric = (text) =>
  text.length > 0 && [...text].every((c) => c >= '0' && c <= '9');
const isDefinition = (node) =>
  node.id !== null && (node.values.length > 0 || node.definition);
const isReference = (node) => node.id !== null && !isDefinition(node);
const loneWord = (node) =>
  node.id === null && node.values.length === 1 && isReference(node.values[0]);

function freshId(used, preferred) {
  let id = preferred;
  let suffix = 0;
  while (used.has(id) || id === '0') {
    id = `${preferred}~${++suffix}`;
  }
  used.add(id);
  return id;
}

function mapper(roots, positions) {
  const rootSet = new WeakSet(roots);
  const rootWord = (node) => rootSet.has(node) && loneWord(node);
  const used = new Set(['0']);
  const definitions = new Map();
  const ids = new WeakMap();
  const ignored = new WeakSet();
  const diagnostics = [];
  const sourceMap = new Map();
  const links = [];
  const points = new Map();
  const warn = (code, node, message) =>
    diagnostics.push({
      code,
      severity: 'warning',
      ...positions.get(node),
      message,
    });
  const collect = (node) => {
    if (isDefinition(node)) {
      if (definitions.has(node.id)) {
        ignored.add(node);
        warn(
          'duplicate-id',
          node,
          `Duplicate ID ${node.id}; the first definition wins`
        );
        return;
      }
      definitions.set(node.id, node);
    }
    if (node.id !== null && !node.quote) {
      used.add(node.id);
    }
    node.values.forEach(collect);
  };
  roots.forEach(collect);
  for (const [id, node] of definitions) {
    ids.set(node, id === '0' ? freshId(used, '@id:0') : id);
  }
  const allocate = (node, path) => {
    if (ignored.has(node) || isReference(node)) {
      return;
    }
    if (rootWord(node)) {
      return;
    }
    if (!ids.has(node)) {
      ids.set(node, freshId(used, path));
    }
    node.values.forEach((value, index) =>
      allocate(value, `${ids.get(node)}/${index}`)
    );
  };
  roots.forEach((node, index) => allocate(node, `@${index}`));
  const locate = (id, node) => {
    if (!sourceMap.has(id)) {
      sourceMap.set(id, positions.get(node));
    }
    return id;
  };
  const point = (node) => {
    const key = node.quote ? `value:${node.id}` : `point:${node.id}`;
    if (!points.has(key)) {
      const id = node.quote
        ? freshId(used, `@value:${node.id}`)
        : node.id === '0'
          ? freshId(used, '@point:0')
          : node.id;
      points.set(key, {
        id,
        kind: node.quote ? 'value' : 'point',
        label: node.id,
      });
    }
    return locate(points.get(key).id, node);
  };
  const reference = (node) => {
    if (node.quote) {
      return point(node);
    }
    const definition = definitions.get(node.id);
    if (definition) {
      return ids.get(definition);
    }
    if (numeric(node.id)) {
      warn(
        'unknown-reference',
        node,
        `Unknown reference ${node.id}; shown as a point`
      );
    }
    return point(node);
  };
  const visit = (node) => {
    if (ignored.has(node)) {
      return ids.get(definitions.get(node.id));
    }
    if (isReference(node)) {
      return reference(node);
    }
    if (rootWord(node)) {
      return reference(node.values[0]);
    }
    const id = locate(ids.get(node), node);
    // Reserve the parent's place before traversing nested values.
    const link = { id, source: 0, target: 0, label: node.id ?? id };
    links.push(link);
    const values = node.values.map(visit);
    if (values.length === 2) {
      [link.source, link.target] = values;
    } else if (values.length > 0) {
      link.source = id;
      link.target = values[0];
      for (let i = 1; i < values.length; i++) {
        const chainId = locate(freshId(used, `${id}/${i}`), node.values[i]);
        links.push({
          id: chainId,
          source: values[i - 1],
          target: values[i],
          label: chainId,
        });
      }
    }
    return id;
  };
  roots.forEach(visit);
  const input = [...links, ...points.values()];
  if (input.length > 0) {
    // Enumerable metadata survives buildNetwork's record copies and structured clone.
    // Positions stay separate so equivalent parse shapes yield equal networks.
    input[0].lino = { roots };
  }
  return { links: input, diagnostics, sourceMap };
}

/**
 * Convert arbitrary LiNo using only the official parser, with bounded input/depth.
 *
 * | LiNo | Network |
 * | --- | --- |
 * | `(a: b c)` | Link a, source b, target c (forward references allowed). |
 * | `(a: b c d)` | a: a→b, a/1: b→c, a/2: c→d. |
 * | `(a: (b c) d)` | Anonymous link a/0 referenced by a. |
 * | Bare word | Labelled point unless it names a definition. |
 * | Quoted value | Separate point with kind value and decoded label. |
 * | `(a: a a)` / cycles | References retained without recursive expansion. |
 * | Duplicate id | Warning; first definition and its subtree win. |
 *
 * One value uses the sequence's first edge; zero values make a free-ended link.
 * Root single words are points. Root anonymous links use @0, @1, etc.
 * Generated IDs get ~1, ~2, etc. on collision; explicit ID 0 is remapped because
 * the network model reserves 0 for free ends. Numeric atoms without definitions
 * warn; ordinary words are valid labels (LiNo has no distinct reference syntax).
 *
 * @param {string} text
 * @param {{ maxInputSize?: number, maxDepth?: number }} [options]
 * @returns {{ links: import('./index.js').LinoNetworkInput[], diagnostics: object[], sourceMap: Map<string, {line:number,column:number}> }}
 */
export function linoToNetwork(text, options = {}) {
  const { maxInputSize = 1024 * 1024, maxDepth = 64 } = options;
  try {
    if (typeof text !== 'string') {
      throw new TypeError('Links Notation input must be a string');
    }
    if (text.length > maxInputSize) {
      return {
        links: [],
        sourceMap: new Map(),
        diagnostics: [
          {
            code: 'input-too-large',
            severity: 'error',
            line: 1,
            column: 1,
            message: `Input exceeds ${maxInputSize} characters`,
          },
        ],
      };
    }
    const parser = new Parser({ maxInputSize, maxDepth });
    const links = parser.parseGroups(text).map(unindent).map(normalizeLink);
    const { roots, positions } = annotateLinks(links, text);
    return mapper(roots, positions);
  } catch (error) {
    return {
      links: [],
      sourceMap: new Map(),
      diagnostics: [
        {
          code:
            error.maxDepth || error.cause instanceof RangeError
              ? 'depth-exceeded'
              : 'syntax-error',
          severity: 'error',
          line: error.line ?? 1,
          column: error.column ?? 1,
          message: error.message,
        },
      ],
    };
  }
}

/**
 * Reconstruct LiNo-origin networks (a conversion, its links, or buildNetwork).
 * Preserves IDs, references and quoted value kinds; formatting is nested LiNo.
 * View edits are intentionally outside this read-only converter's contract.
 * @returns {string}
 */
export function networkToLino(network) {
  const input =
    network.links instanceof Map
      ? [...network.links.values(), ...network.points.values()]
      : Array.isArray(network)
        ? network
        : network.links;
  if (input.length === 0) {
    return '';
  }
  const metadata = input.find((link) => link.lino)?.lino;
  if (!metadata) {
    throw new TypeError('networkToLino requires a network that came from LiNo');
  }
  return formatNetworkRoots(metadata.roots);
}
