/**
 * The `overrides` patch format:
 *
 * ```lino
 * (user-overrides: overrides
 *   (layer user)
 *   (base app)
 *   (set greeting text 'Hello, agents')
 *   (set material3 token color.primary '#00639B')
 *   (unset ok label))
 * ```
 *
 * Text is read by ui-core `parse` (the official `links-notation` parser) and
 * written by ui-core `format`; there is no parser of its own.
 */

import {
  defaultVocabulary,
  format,
  parse,
  SPEC_VERSION,
} from '@link-foundation/ui-core';
import { DEFAULT_KEYED_PROPS, isLayer, LAYERS } from './layers.js';
import { diagnostic } from './errors.js';

/** @typedef {import('@link-foundation/ui-core').RawValue} RawValue */
/** @typedef {import('@link-foundation/ui-core').Diagnostic} Diagnostic */
/** @typedef {import('./layers.js').Layer} Layer */

/**
 * One operation of a patch. `key` is the first value of a keyed prop
 * (`token color.primary`), otherwise `null`.
 * @typedef {{ op: 'set', id: string, name: string, key: string|null, values: RawValue[] }
 *   | { op: 'unset', id: string, name: string, key: string|null }} PatchOp
 */

/**
 * @typedef {object} Patch
 * @property {string|null} name    the id of the `overrides` element
 * @property {Layer|null} layer
 * @property {string|null} base    the id of the document the patch applies to
 * @property {PatchOp[]} ops
 * @property {Diagnostic[]} [diagnostics]
 */

/** The largest patch text read, in UTF-8 bytes (64 KiB). */
export const DEFAULT_MAX_PATCH_SIZE = 64 * 1024;
/** The most operations a patch may have. */
export const DEFAULT_MAX_PATCH_OPS = 2000;
/** The kind of a patch element. */
export const PATCH_KIND = 'overrides';

let vocabulary = null;

/**
 * The ui-dialect/0 vocabulary plus the `overrides` kind, so `parse` reads
 * every `set` and `unset` as a property, in order.
 * @returns {import('@link-foundation/ui-core').Vocabulary}
 */
function patchVocabulary() {
  if (vocabulary === null) {
    const base = defaultVocabulary();
    const prop = (multi) => ({ type: 'any', multi });
    vocabulary = {
      ...base,
      kinds: new Map(base.kinds).set(PATCH_KIND, {
        positional: [],
        children: 'none',
        properties: new Map([
          ['layer', prop(false)],
          ['base', prop(false)],
          ['set', prop(true)],
          ['unset', prop(true)],
          ['note', prop(true)],
        ]),
      }),
      multiValued: new Set([...base.multiValued, 'set', 'unset']),
    };
  }
  return vocabulary;
}

const isAtom = (value) => typeof value === 'string' && value.length > 0;

/** The length of `text` in UTF-8 bytes (a lone surrogate counts as 3). */
function byteLength(text) {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code < 0x10000) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

/**
 * Read one `set` or `unset` property into an op.
 * @param {{ name: string, values: RawValue[] }} prop
 * @param {number} index        the position of the op in the patch
 * @param {readonly string[]} keyedProps
 * @param {Diagnostic[]} diagnostics
 * @returns {PatchOp|null}
 */
function readOp(prop, index, keyedProps, diagnostics) {
  const [id, name, ...rest] = prop.values;
  const at = { op: index, element: isAtom(id) ? id : undefined };
  if (!isAtom(id)) {
    diagnostics.push(
      diagnostic(
        'missing-id',
        'error',
        `${prop.name} #${index} has no element id`,
        at
      )
    );
    return null;
  }
  if (!isAtom(name)) {
    diagnostics.push(
      diagnostic(
        'missing-name',
        'error',
        `${prop.name} ${id} has no property name`,
        at
      )
    );
    return null;
  }
  const keyed = keyedProps.includes(name);
  let key = null;
  if (keyed) {
    key = rest.shift() ?? null;
    if (!isAtom(key)) {
      diagnostics.push(
        diagnostic(
          'missing-key',
          'error',
          `${prop.name} ${id} ${name} has no key`,
          {
            ...at,
            property: name,
          }
        )
      );
      return null;
    }
  }
  if (prop.name === 'unset') {
    if (rest.length > 0) {
      diagnostics.push(
        diagnostic(
          'unexpected-value',
          'warning',
          `unset ${id} ${name} has extra values; they are ignored`,
          { ...at, property: name }
        )
      );
    }
    return { op: 'unset', id, name, key };
  }
  if (rest.length === 0) {
    diagnostics.push(
      diagnostic('missing-value', 'error', `set ${id} ${name} has no value`, {
        ...at,
        property: name,
      })
    );
    return null;
  }
  return { op: 'set', id, name, key, values: rest };
}

/**
 * Parse the text of a patch and find its `overrides` link.
 * @param {unknown} text
 * @param {number} maxSize
 * @param {Diagnostic[]} diagnostics
 * @returns {import('@link-foundation/ui-core').UiNode|null}
 */
function findPatchRoot(text, maxSize, diagnostics) {
  if (typeof text !== 'string') {
    diagnostics.push(
      diagnostic('not-a-patch', 'error', 'A patch must be text')
    );
    return null;
  }
  if (byteLength(text) > maxSize) {
    diagnostics.push(
      diagnostic(
        'patch-too-large',
        'error',
        `The patch is larger than ${maxSize} bytes`,
        { limit: maxSize }
      )
    );
    return null;
  }
  const doc = parse(text, {
    checks: false,
    maxInputSize: maxSize,
    vocabulary: patchVocabulary(),
  });
  diagnostics.push(...doc.diagnostics.filter((d) => d.severity === 'error'));
  const roots = doc.roots.filter((root) => root.kind === PATCH_KIND);
  if (roots.length === 0) {
    if (diagnostics.length === 0 && text.trim() !== '') {
      diagnostics.push(
        diagnostic(
          'not-a-patch',
          'error',
          'The text has no (name: overrides …) link'
        )
      );
    }
    return null;
  }
  if (roots.length > 1 || doc.roots.length > 1 || doc.unknown.length > 0) {
    diagnostics.push(
      diagnostic(
        'extra-links',
        'warning',
        'Only the first overrides link is read; the other links are ignored'
      )
    );
  }
  return roots[0];
}

/** An error for a link that is not a patch operation. */
const unknownOp = (head, at) =>
  diagnostic(
    'unknown-op',
    'error',
    `Unknown patch operation ${JSON.stringify(head)}; a patch has only layer, base, set and unset links`,
    { ...at, head: typeof head === 'string' ? head : null }
  );

/**
 * Read the properties of an `overrides` link into `patch`; returns the ops
 * in order, `null` for an op with an error.
 */
function readProperties(root, patch, keyedProps) {
  const { diagnostics } = patch;
  const ops = [];
  for (const prop of root.properties) {
    const first = prop.values[0];
    if (prop.name === 'set' || prop.name === 'unset') {
      ops.push(readOp(prop, ops.length, keyedProps, diagnostics));
    } else if (prop.name === 'layer' && isLayer(first)) {
      patch.layer = first;
    } else if (prop.name === 'layer') {
      diagnostics.push(
        diagnostic(
          'unknown-layer',
          'error',
          `Unknown layer ${JSON.stringify(first)}; expected one of ${LAYERS.join(', ')}`
        )
      );
    } else if (prop.name === 'base') {
      patch.base = isAtom(first) ? first : null;
    } else if (prop.name !== 'note') {
      // The common `note` property (docs/spec) is a comment: no op.
      diagnostics.push(unknownOp(prop.name, { op: ops.length }));
    }
  }
  for (const link of [...root.unknown, ...root.positional, ...root.children]) {
    const head = Array.isArray(link) ? link[0] : (link?.kind ?? link);
    diagnostics.push(unknownOp(head, {}));
  }
  return ops;
}

/**
 * Read a patch. Never throws: problems are diagnostics, and a patch over the
 * size or op limits has no ops.
 * @param {string} text
 * @param {{ keyedProps?: readonly string[], maxSize?: number, maxOps?: number }} [options]
 * @returns {Patch & { diagnostics: Diagnostic[] }}
 */
export function readPatch(text, options = {}) {
  const {
    keyedProps = DEFAULT_KEYED_PROPS,
    maxSize = DEFAULT_MAX_PATCH_SIZE,
    maxOps = DEFAULT_MAX_PATCH_OPS,
  } = options;
  /** @type {Patch & { diagnostics: Diagnostic[] }} */
  const patch = {
    name: null,
    layer: null,
    base: null,
    ops: [],
    diagnostics: [],
  };
  const root = findPatchRoot(text, maxSize, patch.diagnostics);
  if (!root) {
    return patch;
  }
  patch.name = root.id;
  const ops = readProperties(root, patch, keyedProps);
  if (ops.length > maxOps) {
    patch.diagnostics.push(
      diagnostic(
        'too-many-ops',
        'error',
        `The patch has more than ${maxOps} operations`,
        { limit: maxOps }
      )
    );
    return patch;
  }
  patch.ops = /** @type {PatchOp[]} */ (ops.filter(Boolean));
  return patch;
}

/**
 * Write a patch as Links Notation (ui-core `format`, multiline style).
 * @param {Patch} patch
 * @param {import('@link-foundation/ui-core').FormatOptions} [options]
 * @returns {string}
 */
export function writePatch(patch, options) {
  const properties = [];
  if (patch.layer) {
    properties.push({ name: 'layer', values: [patch.layer] });
  }
  if (patch.base) {
    properties.push({ name: 'base', values: [patch.base] });
  }
  for (const op of patch.ops) {
    const head = [
      op.id,
      op.name,
      ...(op.key === null || op.key === undefined ? [] : [op.key]),
    ];
    properties.push({
      name: op.op,
      values: op.op === 'set' ? [...head, ...op.values] : head,
    });
  }
  const node = {
    id: patch.name ?? null,
    kind: PATCH_KIND,
    positional: [],
    properties,
    children: [],
    unknown: [],
  };
  return format(
    {
      spec: SPEC_VERSION,
      roots: [node],
      unknown: [],
      byId: new Map(),
      diagnostics: [],
    },
    options
  );
}
