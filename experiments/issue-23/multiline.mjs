import { parseLinks } from '@link-foundation/ui-core';
for (const t of [
  "(a: (type range) (min 0)\n  (section x) (label 'B'))",
  '(a: (type range)\n  (min 0)\n  (section x))',
  "(a: b (type range) (min 0)\n  (section x) (label 'B'))",
  "(ok: button\n  (label 'OK')\n  (variant filled))",
  '(x: (y 1)) (z: (w 2))',
]) {
  console.log(JSON.stringify(t), '=>', JSON.stringify(parseLinks(t)));
}
