/**
 * 300 seeded random ops on the source fixtures and samples. Every edit is
 * either confirmed independently (the new text parses to the tree the op
 * gives, its comments are kept) or refused with the text unchanged: no
 * silent mismatch.
 */

import { describe, it, expect } from 'test-anywhere';
import { stripComments } from 'links-notation';
import { defaultVocabulary, parse } from '@link-foundation/ui-core';
import {
  applyOpToTree,
  applyOpsToSource,
} from '@link-foundation/ui-core/source';
import {
  commentsOf,
  samples,
  seededRandom,
  shape,
  sourceFixtures,
} from './helpers.js';

const OPS = 300;
const SEED = 22;
const comments = (text) => commentsOf(text, stripComments);

const NEW_NODES = [
  '(n: text New)',
  "(n: text 'Two words')",
  '(n: button (label Go) (variant filled))',
  '(n: stack (gap (token space.small)))',
];
const VALUES = ['A', 'Hello there', "it's", 'x(y)', '#hash', ''];
const PROPS = ['label', 'note', 'variant'];

/** Every element id of a document and its child element ids. */
function elements(doc) {
  const all = [];
  const visit = (node) => {
    all.push(node);
    node.children.forEach(visit);
  };
  doc.roots.forEach(visit);
  return all.filter((n) => n.id !== null);
}

let fresh = 0;
const KINDS = defaultVocabulary().kinds;

/**
 * Why the edit of an op the tree accepts is refused. The tree ops do not
 * know the vocabulary: a property the kind does not declare is not read
 * back as a property, so the source edit is refused. Nothing else is.
 */
function refusalReason(doc, op) {
  const kind = KINDS.get(doc.byId.get(op.id)?.kind);
  if (op.op === 'setProp' && !kind?.properties.has(op.name)) {
    return 'undeclared property';
  }
  return 'unexplained';
}

/** A random op on a parsed document. */
function randomOp(random, doc) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const nodes = elements(doc);
  const target = pick(nodes);
  const parent = random() < 0.2 ? null : pick(nodes);
  const size = parent === null ? doc.roots.length : parent.children.length;
  const index = Math.floor(random() * (size + 1));
  const parentId = parent?.id ?? null;
  const kind = pick([
    'insert',
    'remove',
    'move',
    'setProp',
    'removeProp',
    'rename',
    'setPositional',
  ]);
  switch (kind) {
    case 'insert': {
      const node = parse(pick(NEW_NODES)).roots[0];
      node.id = `n${++fresh}`;
      return { op: 'insert', parentId, index, node };
    }
    case 'move':
      return { op: 'move', id: target.id, parentId, index };
    case 'setProp':
      return {
        op: 'setProp',
        id: target.id,
        name: pick(PROPS),
        values: [pick(VALUES)],
      };
    case 'removeProp': {
      const name =
        target.properties.length > 0 && random() < 0.8
          ? pick(target.properties).name
          : pick(PROPS);
      return { op: 'removeProp', id: target.id, name };
    }
    case 'rename':
      return {
        op: 'rename',
        id: target.id,
        to: random() < 0.9 ? `r${++fresh}` : pick(nodes).id,
      };
    case 'setPositional':
      return { op: 'setPositional', id: target.id, values: [pick(VALUES)] };
    default:
      return { op: 'remove', id: target.id };
  }
}

describe('source edits under random ops', () => {
  it(`confirms or refuses ${OPS} seeded ops`, () => {
    const random = seededRandom(SEED);
    const inputs = [...sourceFixtures(), ...samples()]
      .map((f) => f.text)
      .filter((text) => elements(parse(text)).length > 1);
    let text = inputs[0];
    let applied = 0;
    let refused = 0;
    for (let n = 0; n < OPS; n++) {
      let doc = parse(text);
      if (n % 25 === 0 || elements(doc).length < 2) {
        text = inputs[Math.floor(random() * inputs.length)];
        doc = parse(text);
      }
      const op = randomOp(random, doc);
      const result = applyOpsToSource(text, [op]);
      const where = `op ${n} ${JSON.stringify(op)}`;
      if (!result.ok) {
        refused++;
        expect(result.text, where).toBe(text);
        if (applyOpToTree(shape(doc), op).ok) {
          expect(refusalReason(doc, op), where).toBe('undeclared property');
        }
        continue;
      }
      // An independent check of the edit, not the one inside the module.
      const expected = applyOpToTree(shape(doc), op);
      expect(expected.ok, where).toBe(true);
      expect(shape(parse(result.text)), where).toEqual(expected.tree);
      const kept = comments(result.text);
      const before = comments(text);
      if (op.op === 'remove') {
        expect(
          kept.every((c) => before.includes(c)),
          where
        ).toBe(true);
      } else {
        expect([...kept].sort(), where).toEqual([...before].sort());
      }
      applied++;
      text = result.text;
    }
    expect(applied + refused).toBe(OPS);
    // Most random ops are valid: the run is not vacuous.
    expect(applied > OPS / 2, `${applied} applied`).toBe(true);
  });
});
