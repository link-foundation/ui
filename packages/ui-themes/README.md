# @link-foundation/ui-themes

Theme packages written in Links Notation. The collection contains `base` and `fluent2`, with light, dark, high contrast and reduced motion tokens, contrast
pairs, scoped styles and a button part template.

```js
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';

listThemes(); // ['base', 'fluent2']
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

[Fluent 2](../../docs/themes/fluent2.md) supplies Microsoft token aliases,
a 16-stop brand-ramp helper and a Fluent UI React v9 migration mapping. Its
MIT token notice ships in `themes/fluent2/LICENSE.txt`; Fluent is a development
dependency only.
