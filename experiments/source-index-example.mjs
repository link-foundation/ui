// Print the span tree of the example of link-foundation/ui#22 (or a file given as argument).
import { readFileSync } from 'node:fs';
import { indexSource } from '../packages/ui-core/src/source/index.js';

const text = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : "# primary action\n(ok: button\n  (label 'OK')   # shown on the button\n  (variant filled))\n";
const { root, form } = indexSource(text);
const show = (node, depth = 0) => {
  const { kind, id, name, role, start, end } = node;
  console.log(
    `${'  '.repeat(depth)}${kind}${id !== undefined ? ` #${id}` : ''}${name ? ` ${name}` : ''}${role ? ` (${role})` : ''} [${start},${end}) ${JSON.stringify(text.slice(start, end))}${node.form ? ` ${node.form}` : ''}`
  );
  node.children.forEach((c) => show(c, depth + 1));
};
console.log('form', form);
show(root);
