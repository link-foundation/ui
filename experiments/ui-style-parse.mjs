import { parse, parseLinks } from '@link-foundation/ui-core';
const texts = [
  `(button-style: style
  (selector (type button) (variant filled))
  (background (token color.primary))
  (state hover (elevation 2))
  (state pressed (scale 0.98)))`,
  `(a: style (selector (type button)) (state :hover (elevation 2)))`,
  `(a: style (selector (type button)) (background red:hover))`,
  `(a: style (selector (type button)) (media (max-width 640px) (padding 1px)))`,
  `(a: style (selector (type button)) (media max-width: 640px (padding 1px)))`,
];
for (const t of texts) {
  try {
    console.log(JSON.stringify(parseLinks(t)));
  } catch (e) {
    console.log('ERR', e.message);
  }
  const d = parse(t);
  console.log(
    JSON.stringify(d.roots),
    JSON.stringify(d.diagnostics.map((x) => x.code))
  );
}
