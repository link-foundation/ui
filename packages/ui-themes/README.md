# @link-foundation/ui-themes

Theme packages written in Links Notation. The collection contains `base`, `hig`, `hig-ios` and `hig-macos`, with light, dark, high contrast and reduced motion tokens, contrast
pairs, scoped styles and a button part template.

```js
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';

listThemes(); // ['base', 'hig', 'hig-ios', 'hig-macos']
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

The HIG themes are guided by the Apple Human Interface Guidelines and are not affiliated with or endorsed by Apple. They use system font names and our own values, with no bundled Apple assets. See [HIG tokens, controls and SwiftUI mapping](../../docs/themes/hig.md) and the [gallery](../../examples/themes/hig.html).
