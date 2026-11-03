/**
 * Reproduce the source-fuzz refusals (#133): replay the seeded ops of
 * packages/ui-core/tests/source-fuzz.test.js and print every op that the tree
 * accepts but the source edit refuses for a reason other than an undeclared
 * property.
 *   node experiments/issue-133/source-fuzz-repro.mjs
 */
import { defaultVocabulary, parse } from '../../packages/ui-core/src/index.js';
import {
  applyOpToTree,
  applyOpsToSource,
} from '../../packages/ui-core/src/source.js';
import {
  samples,
  seededRandom,
  shape,
  sourceFixtures,
} from '../../packages/ui-core/tests/helpers.js';

const KINDS = defaultVocabulary().kinds;
const NEW_NODES = [
  '(n: text New)',
  "(n: text 'Two words')",
  '(n: button (label Go) (variant filled))',
  '(n: stack (gap (token space.small)))',
];
const VALUES = ['A', 'Hello there', "it's", 'x(y)', '#hash', ''];
const PROPS = ['label', 'note', 'variant'];
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
const random = seededRandom(22);
const inputs = [...sourceFixtures(), ...samples()]
  .map((f) => f.text)
  .filter((text) => elements(parse(text)).length > 1);
let text = inputs[0];
for (let n = 0; n < 300; n++) {
  let doc = parse(text);
  if (n % 25 === 0 || elements(doc).length < 2) {
    text = inputs[Math.floor(random() * inputs.length)];
    doc = parse(text);
  }
  const op = randomOp(random, doc);
  const result = applyOpsToSource(text, [op]);
  if (!result.ok) {
    const kind = KINDS.get(doc.byId.get(op.id)?.kind);
    const undeclared = op.op === 'setProp' && !kind?.properties.has(op.name);
    if (applyOpToTree(shape(doc), op).ok && !undeclared) {
      console.log(`op ${n}`, JSON.stringify(op));
      console.log(JSON.stringify(result, null, 1).slice(0, 1500));
      console.log(`--- text\n${text}`);
    }
    continue;
  }
  text = result.text;
}
