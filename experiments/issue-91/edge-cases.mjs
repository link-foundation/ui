// Differential check: ui-core parse() vs the reference projection on edge cases of
// path folding. Prints the cases that differ and a summary line.
import { parse, toTree } from '../../packages/ui-core/src/parse.js';
import {
  loadVocabulary,
  projectText,
} from '../../scripts/spec-reference-projection.mjs';

const vocabulary = loadVocabulary();
const cases = [
  '(ok: button\n  (on press\n    (navigate home))\n  (on press\n    (navigate back)))',
  'foo bar\n  baz qux',
  '(foo bar\n  (baz qux))',
  "text 'A'\n  style x",
  "(text 'A'\n  (style x))",
  "s: stack\n  text 'A'\n    style x\n  text 'A'\n    style y",
  "(s: stack\n  (text 'A'\n    (style x))\n  (text 'A'\n    (style y)))",
  'b: button\n  colour red\n    shade dark\n      tone deep',
  '(b: button\n  (colour red\n    (shade dark\n      (tone deep))))',
  'b: button\n  (x y) z\n  (x y) w',
  'b: button\n  label OK\n  @ref',
  'b: button\n  colour @red\n    shade $dark',
  'lonely',
];
let different = 0;
for (const text of cases) {
  const ours = JSON.stringify(toTree(parse(text)));
  const ref = JSON.stringify(projectText(text, vocabulary).tree);
  if (ours !== ref) {
    different += 1;
    console.log('DIFFERENT', JSON.stringify(text));
    console.log('  ui-core  ', ours);
    console.log('  reference', ref);
  }
}
console.log(`${cases.length - different}/${cases.length} cases agree`);
