# @link-foundation/ui-themes

Theme packages written in Links Notation. The initial collection contains
`base`, with light, dark, high contrast and reduced motion tokens, contrast
pairs, scoped styles and a button part template.

```js
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';

listThemes(); // base plus the classic theme collection
const base = await loadTheme('base');
const css = compileThemeCss(base);
```

`loadTheme(id)` asynchronously reads the shipped `.lino` file in Node or
fetches it relative to this module in the browser. Unknown IDs reject with a
`RangeError`. No build step or separate dark stylesheet is needed.

Pass `{ themes: [base] }` to `mountDocument` from `@link-foundation/ui-dom`.
The native button from `@link-foundation/ui-components/controls` consumes the
template at mount time. See [the theme contract](../../docs/spec/themes.md)
and [the runnable example](../../examples/themes/README.md).

The [classic collection](themes/classic/README.md) ships 38 DeepCase, konard,
immortality, formal-ai and meta-sovereign themes. Chat and composer packs define
only their own axis, so colours inherit from the enclosing skin. Open the
[classic gallery](../../examples/themes/classic.html) for all five families.

```js
import { frameStyle } from '@link-foundation/ui-themes/classic/frames';
const frame = frameStyle({ corner: 'cut', line: 'accent', size: 12 });
// frame is nested style-rule LiNo; pass it to ui-style.readStyles.
```
