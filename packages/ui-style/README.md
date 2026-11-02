# @link-foundation/ui-style

Style rules of the associative UI framework, written in Links Notation. The
package reads the rules, matches them to UI elements and resolves token
references through
[`@link-foundation/ui-tokens`](../ui-tokens/README.md). It produces one of
two results from the same rules:

- `compileCss(rules)`: a CSS stylesheet for the DOM renderer.
- `resolveStyle(rules, tokens, node, ancestors, env)`: the resolved style of
  one element in a given state and environment, for renderers without CSS
  (React Native, SwiftUI, Compose).

Its runtime dependencies are `@link-foundation/ui-core` and
`@link-foundation/ui-tokens`. Rules are parsed only by ui-core `parse`, which
uses the official `links-notation` parser.

```js
import { parse, values } from '@link-foundation/ui-core';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import {
  compileCss,
  readStyles,
  resolveStyle,
} from '@link-foundation/ui-style';

const { rules, diagnostics } = readStyles(`
(button-style: style
  (selector (type button) (variant filled))
  (background (token color.primary))
  (color (token color.on-primary))
  (radius (token shape.corner.medium))
  (state hover (elevation 2))
  (state pressed (scale 0.98)))
`);

console.log(compileCss(rules));
// ui-button[variant='filled'] {
//   background-color: var(--color-primary);
//   color: var(--color-on-primary);
//   border-radius: var(--shape-corner-medium);
// }
// ui-button[variant='filled']:hover {
//   box-shadow: var(--elevation-2);
// }
// ui-button[variant='filled']:active {
//   transform: scale(0.98);
// }

const { sets } = readTokens(`
(material3: theme
  (token color.primary '#6750A4')
  (token color.on-primary '#FFFFFF')
  (token shape.corner.medium 12px))
`);
const tokens = resolveTokens(sets, 'material3');
const ok = parse('(ok: button (label OK) (variant filled))').byId.get('ok');
const { style, sources } = resolveStyle(rules, tokens, ok, [], {
  states: ['hover'],
});
values.toHex(style.background); // '#6750A4'
style.elevation; // { type: 'number', value: 2 }
sources.elevation; // 'button-style'
```

The complete example is `examples/ui-style-basics.mjs` in the repository.

## Grammar

A rule is a `style` element with an id. It has one selector, declarations,
and blocks that apply in a state or under a condition:

```lino
(card-style: style
  (selector (type card) (within (type dialog)))
  (padding (token space.medium))
  (media (max-width 640px)
    (padding (token space.small))
    (state hover (opacity 0.92)))
  (container (min-width 400px)
    (direction horizontal))
  (media (prefers-color-scheme dark) (prefers-reduced-motion reduce)
    (border-color (token color.outline)))
  (state disabled (opacity 0.38)))
```

| Link                               | Meaning                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `(selector PART...)`               | The elements of the rule. All parts must match. Exactly one per rule.                                         |
| `(PROPERTY VALUE...)`              | A declaration (see [Properties](#properties)). When a property is declared twice, the later declaration wins. |
| `(state STATE BODY...)`            | Declarations that apply while the element is in `STATE` (see [States](#states)).                              |
| `(media CONDITION... BODY...)`     | Declarations that apply while every condition holds (see [Conditions](#conditions)).                          |
| `(container CONDITION... BODY...)` | Declarations that apply while every condition holds for the nearest size container.                           |

A block's `BODY` is made of declarations and further blocks, so a `state` can
sit inside a `media` block and the other way round. A rule with no id is read
as `style-N` and reported as `anonymous-rule`.

Selector parts:

| Part               | Matches                                                                                  | CSS                |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------ |
| `(type KIND)`      | elements of the kind `KIND` (`button`, `card`)                                           | `ui-KIND`          |
| `(id ID)`          | the element with the id `ID`                                                             | `#ID`              |
| `(PROP VALUE)`     | elements whose property `PROP` has the single value `VALUE`                              | `[PROP='VALUE']`   |
| `(within PART...)` | elements with an ancestor that matches `PART...`. `within` can nest and can be repeated. | `ANCESTOR ELEMENT` |

The first `within` is written as a descendant combinator. Each further one is
written as `:is(ANCESTOR *)`, which has the same specificity. Arbitrary CSS
selectors, other combinators and pseudo-elements are not part of the grammar.

### CSS syntax is not accepted

In Links Notation, `:` separates an id from a link. CSS syntax therefore
cannot be written in bare values: `(state :hover)` reads as a link with an
id, and `(media (max-width: 640px))` reads as a link whose id is
`max-width`. Such links, and any value that contains `:` (such as
`'button:hover'`), are reported as `css-syntax` errors and skipped. A bare
`red:hover` is already a syntax error of the parser, which is reported as
`syntax-error`. Write the structured links instead: `(state hover)` and
`(media (max-width 640px))`.

## Properties

Every value is a typed value of ui-core (`values.typeValue`), a token
reference `(token PATH)`, or a fallback `(or (token PATH) VALUE)`.
`(param ...)`, element references and free text are rejected as
`invalid-value`, so CSS such as `url(...)` can never reach the stylesheet.

| Property       | CSS                | Value                                             | Tokens                 |
| -------------- | ------------------ | ------------------------------------------------- | ---------------------- |
| `background`   | `background-color` | colour                                            | `color`                |
| `color`        | `color`            | colour                                            | `color`                |
| `radius`       | `border-radius`    | 1 to 4 dimensions                                 | `dimension`            |
| `padding`      | `padding`          | 1 to 4 dimensions                                 | `dimension`            |
| `gap`          | `gap`              | 1 or 2 dimensions                                 | `dimension`            |
| `opacity`      | `opacity`          | number from 0 to 1                                | `number`               |
| `elevation`    | `box-shadow`       | whole number from 0, written `var(--elevation-N)` | none                   |
| `scale`        | `transform`        | number, written `scale(N)`                        | `number`               |
| `font-size`    | `font-size`        | dimension                                         | `dimension`            |
| `font-weight`  | `font-weight`      | number from 1 to 1000                             | `fontWeight`, `number` |
| `border-width` | `border-width`     | dimension                                         | `dimension`            |
| `border-color` | `border-color`     | colour                                            | `color`                |
| `direction`    | `flex-direction`   | `horizontal` (`row`) or `vertical` (`column`)     | none                   |

Colours are any colour of ui-core (`'#6750A4'`, `(oklch 0.5 0.1 300)`, ...).
Dimensions are numbers with a unit (`12px`, `1rem`) or `0`, and they must not
be negative. In CSS a token reference is written `var(--PATH)`, following the
naming rule of ui-tokens `cssVariable` (`color.on-primary` gives
`var(--color-on-primary)`). A fallback is written `var(--a, VALUE)`.

## States

| State      | CSS                                                  |
| ---------- | ---------------------------------------------------- |
| `hover`    | `:hover`                                             |
| `focus`    | `:focus-visible`                                     |
| `pressed`  | `:active`                                            |
| `disabled` | `:is(:disabled, [disabled], [aria-disabled='true'])` |
| `selected` | `[aria-selected='true']`                             |
| `checked`  | `[aria-checked='true']`                              |

The names follow the Material 3 interaction states. In `resolveStyle`, the
current states are given as `env.states`.

## Conditions

| Block       | Condition                         | CSS                                       | Holds in `resolveStyle` when                    |
| ----------- | --------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `media`     | `(min-width W)`                   | `@media (min-width: W)`                   | `env.viewport.width >= W`                       |
| `media`     | `(max-width W)`                   | `@media (max-width: W)`                   | `env.viewport.width <= W`                       |
| `media`     | `(prefers-color-scheme dark)`     | `@media (prefers-color-scheme: dark)`     | `env.colorScheme` is `dark` (default `light`)   |
| `media`     | `(prefers-reduced-motion reduce)` | `@media (prefers-reduced-motion: reduce)` | `env.reducedMotion` is `true` (default `false`) |
| `container` | `(min-width W)`                   | `@container (min-width: W)`               | `env.container.width >= W`                      |
| `container` | `(max-width W)`                   | `@container (max-width: W)`               | `env.container.width <= W`                      |

Widths are in `px`, `rem` or `em`. `resolveStyle` converts `rem` and `em` with
a root font size of 16px. A width condition never holds when the width is
not given. `light` and `no-preference` are accepted as well. Several
conditions in one block are joined with `and`.

## Cascade

For each property, `resolveStyle` takes the declaration that applies with the
highest specificity. Among declarations with equal specificity, it takes the
later one. This is the same order that a browser applies to the stylesheet
written by `compileCss`, so both results agree.

- Specificity is `[ids, properties + states, types]`, counted over the
  selector and its `within` parts, as CSS counts the written selector. Media
  and container blocks add none.
- Rules come in source order. A rule's own declarations come before its
  blocks, and blocks come depth-first in source order.

So `(id ok)` beats `(type button) (variant filled)`, which beats
`(type button)`. A `state` block beats a later `media` block with the same
selector.

## API

| Function                                              | Result                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `readStyles(text)`                                    | `{ rules, diagnostics }`: every `style` element of the text. Other elements are skipped.                                  |
| `compileCss(rules, { tagFor, prefix })`               | The stylesheet. `tagFor(kind)` gives the element selector (default `ui-KIND`). `prefix` is the ui-tokens variable prefix. |
| `resolveStyle(rules, tokens, node, ancestors, env)`   | `{ style, sources, diagnostics }`: typed values per property and the id of the winning rule per property.                 |
| `matches(selector, node, ancestors)`                  | Whether an element matches. `ancestors` go from the root to the parent.                                                   |
| `specificity(selector, states)`, `compareSpecificity` | The specificity tuple and its order.                                                                                      |
| `flatten(rules)`                                      | Every rule and block as one entry, in cascade order.                                                                      |

`tokens` is the result of ui-tokens `resolveTokens`, or any `Map` from a
token path to a typed value. `env` is
`{ states, viewport: { width }, container: { width }, colorScheme, reducedMotion }`.
All of its fields are optional. Identifiers in the CSS are escaped as by
`CSS.escape`, and property values are written as quoted CSS strings.

## Diagnostics

| Code                                       | When                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `css-syntax`                               | CSS syntax in a value: `(state :hover)`, `(media (max-width: 640px))`, `'a:b'`.          |
| `unknown-property`                         | A declaration whose name is not in the table above.                                      |
| `invalid-value`                            | A value of the wrong type, out of range, or with too many parts.                         |
| `unknown-state`, `invalid-condition`       | A state outside the list, or a missing, unknown or invalid condition.                    |
| `missing-selector`, `invalid-selector`     | A rule with no selector (the rule is dropped), or a selector part that cannot be read.   |
| `duplicate-selector`, `misplaced-selector` | A second selector (the last one is used), or a selector inside a block.                  |
| `anonymous-rule`, `unexpected-value`       | A rule without an id, or a value that is not a link in a rule body.                      |
| `unknown-token`, `type-mismatch`           | From `resolveStyle`: a missing token, or a token of a type the property does not accept. |

Parser diagnostics of ui-core, such as `syntax-error`, are passed through.

## Tests

```bash
node --test packages/ui-style/tests/*.test.js
UPDATE_GOLDEN=1 node --test packages/ui-style/tests/   # rewrite tests/golden/*.css
```

`tests/golden/styles.css` is the stylesheet of the issue-1 sample
`docs/case-studies/issue-1/samples/styles.lino`. The CSS tests also parse
every stylesheet with `postcss`, which is a development dependency only.

## License

Unlicense.
