# @link-foundation/ui-themes

Theme packages written in Links Notation. The collection contains `base`, `material3`, `fluent2`, `hig`, `hig-ios` and `hig-macos`, with light, dark, high contrast and reduced motion tokens, contrast
pairs, scoped styles and a button part template.

```js
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';

listThemes(); // base, material3, fluent2, hig, hig-ios, hig-macos and the classic collection
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

[Fluent 2](../../docs/themes/fluent2.md) supplies Microsoft token aliases,
a 16-stop brand-ramp helper and a Fluent UI React v9 migration mapping. Its
MIT token notice ships in `themes/fluent2/LICENSE.txt`; Fluent is a development
dependency only.

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
The HIG themes are guided by the Apple Human Interface Guidelines and are not affiliated with or endorsed by Apple. They use system font names and our own values, with no bundled Apple assets. See [HIG tokens, controls and SwiftUI mapping](../../docs/themes/hig.md) and the [gallery](../../examples/themes/hig.html).

## Independent frames and optical materials

`readFrames`, `resolveFrame` and `frameGeometry` from `./classic/frames` support
independent corners, edges, state overrides and explicit level inheritance.
`./classic/materials` supplies material parameters, appearance presets and a
shared opt-in animation/sound governor. See the
[frame and material contract](../../docs/spec/frames.md) and the
[original optical example](../../examples/themes/optical-frames/README.md).
