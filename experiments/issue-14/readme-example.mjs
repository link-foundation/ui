// Prints the README example: three forms of one button and the tree they give.
import { parse, format } from '../../packages/ui-core/src/index.js';

const forms = [
  "(ok: button (label 'OK') (variant filled) (on press (navigate home)))",
  "(ok: button\n  (label 'OK')\n  (variant filled)\n  (on press\n    (navigate home)))",
  "ok: button\n  label 'OK'\n  variant filled\n  on press\n    navigate home",
];
const trees = forms.map((t) => JSON.stringify(parse(t).roots[0], null, 2));
console.log(trees.every((t) => t === trees[0]) ? 'all equal' : 'DIFFERENT');
console.log(trees[0]);
const doc = parse(forms[0]);
for (const style of ['inline', 'multiline', 'indented']) {
  console.log(`--- ${style}\n${format(doc, { style })}`);
}
console.log(JSON.stringify(parse('(a: button (label))').diagnostics, null, 2));
