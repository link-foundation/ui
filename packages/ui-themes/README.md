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

### Adaptive effect governor

`createEffectGovernor` from `@link-foundation/ui-themes/classic/materials`
shares a frame scheduler across host artwork effects. Existing
`draw(time, state)` callbacks remain supported; `time` is the animation-frame
clock in milliseconds. The third argument is elapsed seconds since that effect's
last draw (initially zero, capped at 0.25); the fourth is `{scale, fps}`.
Return `true` to continue animating; any other return removes an animated effect.

```js
const governor = createEffectGovernor({
  watchVisibility: true,
  watchReducedMotion: true,
});
const remove = governor.add(
  'background',
  (time, state, elapsedSeconds, quality) => {
    paintBackground(elapsedSeconds, quality.scale);
    return true;
  },
  { fps: 30, onQualityChange: ({ scale }) => resizeBackingStore(scale) }
);
governor.set({ motion: 'auto' });
// After a resize or option change, repaint once even if motion is off:
governor.invalidate('background');
// Read a detached snapshot at any time while the effect is registered:
console.log(governor.getQuality('background'));
remove();
governor.dispose();
```

Each effect watches all animation frames, including frames skipped by its cap.
Gaps above 45 ms are slow; gaps at or below zero or above 1000 ms are ignored.
Windows close after 30 valid gaps or 1000 accumulated milliseconds. The first
window is warm-up. A strict slow majority lowers quality once per window:
resolution multiplies by `scaleFactor` (default 0.7, rounded to three decimals)
until `minScale` (0.4), then frame-rate share multiplies by `fpsFactor` (0.5)
until `minFps` (0.25). Quality never increases. These four per-effect options
accept positive numbers up to one; factors must be below one. `resolution: false`
keeps scale at one and lowers only frame rate.

An optional `fps` target of 5..60 throttles draws to
`1000 / (fps * quality.fps)` milliseconds; omitting it preserves drawing on every
animation frame at full quality, with a 60 fps base when quality lowers the
frame-rate share. `onQualityChange` receives a detached snapshot once per step,
before drawing, allowing a backing store to resize only when necessary.

Motion defaults to off. `auto` follows reduced motion, `on` overrides reduced
motion explicitly, and `off` never animates. Legacy booleans still work: `true`
follows reduced motion and `false` pauses. Hidden pages always pause. Pause and
resume reset timestamps and start a new warm-up window, retaining quality.
`invalidate` coalesces requests into one next-frame draw with elapsed zero,
bypasses the cap, and preserves a paused effect regardless of its return value.
It never enables motion. Unknown IDs are ignored. Removing/replacing an effect
starts a new quality session; an old removal callback cannot remove a replacement.

Automatic visibility and reduced-motion subscriptions are opt-in. Tests or hosts
can inject `document` and `matchMedia` alongside `requestFrame` and `cancelFrame`.
Without browser sources, the governor still works with manual `set` inputs.
`dispose` cancels pending frames and removes both listeners. Sound remains
controlled independently by `sound`, `volume`, and visibility.
