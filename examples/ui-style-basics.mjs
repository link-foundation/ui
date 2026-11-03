// Usage of @link-foundation/ui-style: read style rules, write them as CSS for
// the DOM renderer, and resolve the style of one element for a native
// renderer in a state and a viewport.
// Run: node examples/ui-style-basics.mjs
import { parse, values } from '@link-foundation/ui-core';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import {
  compileCss,
  readStyles,
  resolveStyle,
} from '@link-foundation/ui-style';

const { rules, diagnostics } = readStyles(`
button-style: style
  selector
    type button
    variant filled
  background
    token color.primary
  radius
    token shape.corner.medium
  state hover
    elevation 2
  media
    max-width 640px
    padding
      token space.small
`);
console.log(diagnostics); // []

console.log(compileCss(rules));
// ui-button[variant='filled'] {
//   background-color: var(--color-primary);
//   border-radius: var(--shape-corner-medium);
// }
// ui-button[variant='filled']:hover {
//   box-shadow: var(--elevation-2);
// }
// @media (max-width: 640px) {
//   ui-button[variant='filled'] {
//     padding: var(--space-small);
//   }
// }

const { sets } = readTokens(`
material3: theme
  token color.primary '#6750A4'
  token shape.corner.medium 12px
  token space.small 8px
`);
const tokens = resolveTokens(sets, 'material3');
const doc = parse(`ok: button
  label OK
  variant filled`);
const ok = doc.byId.get('ok');

const { style, sources } = resolveStyle(rules, tokens, ok, [], {
  states: ['hover'],
  viewport: { width: 400 },
});
for (const [property, value] of Object.entries(style)) {
  console.log(property, values.formatValue(value), `(${sources[property]})`);
}
// background '#6750A4' (button-style)
// radius 12px (button-style)
// elevation 2 (button-style)
// padding 8px (button-style)

// CSS syntax in a bare value is a diagnostic, never accepted. The bad input
// is kept on one line, as it would be typed.
const bad = readStyles(
  '(b: style (selector (type button)) (state :hover (elevation 2)))'
);
console.log(bad.diagnostics.map((d) => d.code)); // ['css-syntax']
