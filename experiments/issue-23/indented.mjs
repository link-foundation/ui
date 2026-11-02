import { parseLinks } from '@link-foundation/ui-core';
for (const t of [
  'liquid.blur:\n  type range\n  default 18\n  apply\n    css-var --x',
  "preset calm\n  label 'Calm'\n  set a 1",
  '(settings (version 2) (liquid.blur 24))',
  "(settings (version 2) (accent '#3390EC') (name 'a b'))",
  '(settings\n  (version 2)\n  (liquid.blur 24))',
  "(preset calm (label 'Calm')\n  (set a 1))",
]) {
  console.log(JSON.stringify(t), '=>', JSON.stringify(parseLinks(t)));
}
