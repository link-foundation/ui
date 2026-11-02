/**
 * `applyOpsToSource(text, ops)`: apply the edit ops of the store (link-foundation/ui#16) to the
 * source text, in order, keeping comments and layout.
 *
 * After every op the new text is checked: `parse(newText)` must deep-equal
 * the tree the same op gives on `parse(oldText)`. The ops are applied all or
 * nothing: on the first failure the result is `{ ok: false, error, index }`
 * with the input text unchanged.
 */

import { format } from '../format.js';
import { parse } from '../parse.js';
import {
  checkEdit,
  insertChild,
  moveNode,
  removeNode,
  removeProp,
  renameId,
  setPositional,
  setProp,
} from './edit.js';
import { indexSource } from './index.js';

/** The text of a new element in the layout of the document. */
function nodeText(text, node, options) {
  const { form, unit } = indexSource(text, options);
  return format({ roots: [node], unknown: [] }, { style: form, indent: unit });
}

const EDITS = {
  insert: (text, op, options) =>
    insertChild(
      text,
      op.parentId ?? null,
      op.index,
      nodeText(text, op.node, options),
      options
    ),
  remove: (text, op, options) => removeNode(text, op.id, options),
  move: (text, op, options) =>
    moveNode(text, op.id, op.parentId ?? null, op.index, options),
  setProp: (text, op, options) =>
    setProp(text, op.id, op.name, op.values, options),
  removeProp: (text, op, options) => removeProp(text, op.id, op.name, options),
  rename: (text, op, options) => renameId(text, op.id, op.to, options),
  setPositional: (text, op, options) =>
    setPositional(text, op.id, op.values, options),
};

/**
 * Apply ops to a source text.
 * @param {string} text
 * @param {object[]} ops
 * @param {{ vocabulary?: object }} [options]
 * @returns {{ ok: true, text: string, steps: Array<{ op: object, edits: object[] }> }
 *   | { ok: false, error: string, index: number, text: string }}
 */
export function applyOpsToSource(text, ops, options = {}) {
  if (!Array.isArray(ops)) {
    return { ok: false, error: 'The ops are not an array', index: 0, text };
  }
  let current = text;
  const steps = [];
  for (let index = 0; index < ops.length; index++) {
    const op = ops[index];
    const fail = (error) => ({ ok: false, error, index, text });
    const edit = EDITS[op?.op];
    if (!edit) {
      return fail(`Unknown op "${op?.op}"`);
    }
    let result;
    try {
      result = edit(current, op, options);
    } catch (error) {
      return fail(error.message);
    }
    if (!result.ok) {
      return fail(result.error);
    }
    // The check of the issue, made here again on the op as given.
    const error = checkEdit(parse(current, options), result.text, op, options);
    if (error) {
      return fail(error);
    }
    steps.push({ op, edits: result.edits });
    current = result.text;
  }
  return { ok: true, text: current, steps };
}
