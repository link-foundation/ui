# Classic theme packs

Skins extend `base`; chat and composer axes inherit their enclosing skin. Load a pack with `loadTheme(id)` and apply it with
`theme` on any subtree. The same document can switch themes without remounting.
Chat and composer axes use separate nested boundaries. No fonts are bundled.

## Provenance

Licences verified using the GitHub LICENSE API on 2026-11-03.
Immortality data is pinned to `16a6172c38fc120133485f805c49d980b9850bc4`: IDs and preset axes
come from `app/src/settings.ts`; actual colour values are in `app/src/styles.css`.
Deepcase values follow sections 6–7 of the repository case study. Formal-ai and
meta-sovereign both carry Unlicense LICENSE files; chat tokens reuse the
existing licensed chat-kit data. Konard source code was not read or copied.

| Pack                      | Source repository                                                                           | File or issue                                                                                                     | Source licence | Method                         |
| ------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------ |
| `deepcase-classic`        | [deep-foundation/deepcase](https://github.com/deep-foundation/deepcase)                     | [source](https://github.com/deep-foundation/deepcase/blob/main/imports/theme/theme.tsx)                           | Unlicense      | ported                         |
| `deepcase-dark`           | [deep-foundation/deepcase](https://github.com/deep-foundation/deepcase)                     | [source](https://github.com/deep-foundation/deepcase/blob/main/imports/theme/theme.tsx)                           | Unlicense      | ported                         |
| `deepcase-perception`     | [deep-foundation/perception-imports](https://github.com/deep-foundation/perception-imports) | [source](https://github.com/deep-foundation/perception-imports/blob/main/imports/theme.tsx)                       | Unlicense      | ported                         |
| `deepcase-2025`           | [deep-foundation/deep](https://github.com/deep-foundation/deep)                             | [source](https://github.com/deep-foundation/deep/blob/main/src/theme.tsx)                                         | Unlicense      | ported                         |
| `deepcase-landing`        | [deep-foundation/deepcase.github.io](https://github.com/deep-foundation/deepcase.github.io) | [source](https://github.com/deep-foundation/deepcase.github.io/blob/main/imports/deep-case-frame/deep-frame.tsx)  | Unlicense      | ported                         |
| `glass`                   | [konard/konard.github.io](https://github.com/konard/konard.github.io)                       | [source](https://github.com/konard/konard.github.io/issues/47)                                                    | None           | re-implemented, no code copied |
| `liquid`                  | [konard/konard.github.io](https://github.com/konard/konard.github.io)                       | [source](https://github.com/konard/konard.github.io/issues/47)                                                    | None           | re-implemented, no code copied |
| `futuristic`              | [konard/konard.github.io](https://github.com/konard/konard.github.io)                       | [source](https://github.com/konard/konard.github.io/issues/47)                                                    | None           | re-implemented, no code copied |
| `immortality-mission`     | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-glitchy`     | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-amber`       | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-monochrome`  | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-tron`        | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-ares`        | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-clu`         | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-athena`      | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-aphrodite`   | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-poseidon`    | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-soulextract` | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `immortality-matrix`      | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `poseidon`                | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `arwes`                   | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `quiet`                   | [konard/immortality](https://github.com/konard/immortality)                                 | [source](https://github.com/konard/immortality/blob/16a6172c38fc120133485f805c49d980b9850bc4/app/src/settings.ts) | Unlicense      | ported                         |
| `fa-flat`                 | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `fa-glass`                | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `fa-material`             | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `fa-contrast`             | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `chat-cards`              | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `chat-compact`            | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `chat-bubbles`            | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `composer-flat`           | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `composer-glass-soft`     | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `composer-glass-clear`    | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `composer-bubble`         | [link-assistant/formal-ai](https://github.com/link-assistant/formal-ai)                     | [source](https://github.com/link-assistant/formal-ai/issues/110)                                                  | Unlicense      | ported                         |
| `chat-t3`                 | [link-foundation/meta-sovereign](https://github.com/link-foundation/meta-sovereign)         | [source](https://github.com/link-foundation/meta-sovereign/blob/main/js/src/web/app.css)                          | Unlicense      | ported                         |
| `chat-telegram`           | [link-foundation/meta-sovereign](https://github.com/link-foundation/meta-sovereign)         | [source](https://github.com/link-foundation/meta-sovereign/blob/main/js/src/web/app.css)                          | Unlicense      | ported                         |
| `chat-whatsapp`           | [link-foundation/meta-sovereign](https://github.com/link-foundation/meta-sovereign)         | [source](https://github.com/link-foundation/meta-sovereign/blob/main/js/src/web/app.css)                          | Unlicense      | ported                         |
| `chat-signal`             | [link-foundation/meta-sovereign](https://github.com/link-foundation/meta-sovereign)         | [source](https://github.com/link-foundation/meta-sovereign/blob/main/js/src/web/app.css)                          | Unlicense      | ported                         |

The chrome documents `deepcase-0.1.lino` and `handler-windows.lino` are independently
implemented from the Unlicense DeepCase references. Landing tokens exclude tilt
animation. Graph rules define stroke, arrow preference and per-value colours;
graph rendering and interaction remain the responsibility of graph components.

The corner generator at `src/classic/frames.js` is also re-implemented, no code
copied. It paints one clipped surface so corner and edge transparency cannot
diverge. `size` is a bounded corner proportion from 0 to 48; round uses pixels.
Five border treatments combine with all seven shapes. Generated frames remain
style-rule LiNo. The gallery demonstrates every combination.

Poseidon selects its blue palette and HUD surface; Arwes selects Tron, glass and
cut frames; Quiet selects monochrome and solid plain panels. Glow and scanlines
are static, with no flashing or flicker animation; reduced motion sets all
effect strengths to zero. No `steps(1)` animation is present.

See [the gallery](../../../../../examples/themes/classic.html). Run
`node --test packages/ui-themes/tests/classic-*.test.js` and
`npx playwright test tests/e2e/theme-classic.spec.js --project=chromium`.

## Chrome and frame provenance

| Pack                     | Source repository                                                               | File or issue                                                                  | Source licence | Method                         |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- | ------------------------------ |
| `deepcase-0.1` chrome    | [deep-foundation/deepcase-app](https://github.com/deep-foundation/deepcase-app) | [classic reference](https://github.com/deep-foundation/deepcase-app/issues/76) | Unlicense      | re-implemented                 |
| `handler-windows` chrome | [deep-foundation/deepcase-app](https://github.com/deep-foundation/deepcase-app) | [dark reference](https://github.com/deep-foundation/deepcase-app/issues/299)   | Unlicense      | re-implemented                 |
| `frames`                 | [konard/konard.github.io](https://github.com/konard/konard.github.io)           | [transparency reference](https://github.com/konard/konard.github.io/issues/47) | None           | re-implemented, no code copied |

Formal-ai semantic colours map `js/styles/01-tokens.css` at
`ab3c72a6fbbd4d92587581849dab863888fd5f5f` (card/raised surfaces, body text,
solid accent and dark equivalents). Shared controls use the same semantic set;
material uses the raised surface, glass the 0.78 translucent surface, and contrast
the engine's high-contrast mode. Source-specific application selectors become
component style rules rather than combined root classes.
