# @link-foundation/ui-themes

Theme packages written in Links Notation. The initial collection contains
`base`, with light, dark, high contrast and reduced motion tokens, contrast
pairs, scoped styles and a button part template.

```js
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';

listThemes(); // ['base', 'material3']
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

Material 3 includes generated light, dark and high-contrast color schemes,
type, shape, elevation, motion and state tokens, and control styles/templates.
See [the Material 3 API and generated MUI mapping](../../docs/themes/material3.md)
and [the gallery](../../examples/themes/material3.html).

`materialThemeFromSeed` uses `@material/material-color-utilities` **0.3.0**
(Apache-2.0, Google LLC), pinned because 0.4.0 has broken published ESM imports
([upstream #195](https://github.com/material-foundation/material-color-utilities/issues/195)).
Its [source and license](https://github.com/material-foundation/material-color-utilities)
remain upstream; no Material Web, MUI, fonts or icons are bundled.
Regenerate colors with `node packages/ui-themes/scripts/generate-material3.mjs`.
