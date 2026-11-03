# @link-foundation/ui-components

Components of the associative UI framework. For now it has icons:

- a public-domain (CC0-1.0) icon set of our own;
- the `ui-icon` element and the `icon` kind of
  [`@link-foundation/ui-dom`](../ui-dom/README.md);
- adapters for Lucide, Tabler and Material Symbols. Every icon they supply
  carries its licence record.

```js
import { registerIconSet, resolveIcon } from '@link-foundation/ui-components';
import { createLucideSource } from '@link-foundation/ui-components/icons/adapters/lucide';

await resolveIcon('close'); // {viewBox, body, mirrorInRtl, record, set: 'own'}
registerIconSet('lucide', createLucideSource());
await resolveIcon({ set: 'lucide', name: 'check' }); // record: ISC, Lucide
```

```html
<ui-icon name="close"></ui-icon>
<!-- decorative: aria-hidden -->
<ui-icon set="lucide" name="check" label="Done"></ui-icon>
<!-- role="img", named "Done" -->
```

```lino
(app: document
  (icon close)
  (ok: icon (set lucide) (name check) (label 'Done')))
```

The complete example is `examples/ui-components-icons.mjs`. The gallery
`examples/icons.html` shows every set in light and dark themes and in both
text directions. To serve it, run `node scripts/build-icons.mjs` and then
`node scripts/serve-static.mjs`, and open
`/packages/ui-components/examples/icons.html`.

## The own set

[`assets/icons/own/`](../../assets/icons/own/) holds 32 icons, each with a
record in [`assets/assets.lino`](../../assets/assets.lino) (CC0-1.0, copyright
`none`). They follow these rules:

- a 24×24 grid with a 2 px stroke;
- round caps and joins;
- `currentColor`, so an icon takes the colour of the text around it and
  follows the theme.

The names are `ICON_NAMES`: `close`, `menu`, `more`, the chevrons, `check`,
`plus`, `minus`, `search`, `settings`, `reset`, `copy`, `paste`, `send`,
`attach`, `drag-handle`, the dock icons, `float`, `zoom-in`, `zoom-out`, `fit`,
`play`, `pause`, `record`, `warning`, `error`, `info` and `link`. `send`
and `reset` point in the reading direction (`MIRROR_IN_RTL`), so they are
mirrored in right-to-left text.

## The registry

| Export                                                       | Meaning                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `registerIconSet(set, source)`                               | add or replace a set. It returns a function that unregisters the set. Rendered icons of the set redraw.                                   |
| `resolveIcon(ref)`                                           | resolves `close`, `lucide:check` or `{set, name}` to `IconData`. A missing name falls back to the own set and then to `PLACEHOLDER_ICON`. |
| `iconRecords(sets?)`                                         | the asset records of the registered sets, for attribution screens                                                                         |
| `createStaticSource(module)`                                 | a source over a module built by `scripts/build-icons.mjs` (`dist/icons/<set>.js`)                                                         |
| `parseIconRef`, `iconSets`, `getIconSet`, `onIconSetsChange` | helpers                                                                                                                                   |

`IconData` is `{viewBox, body, mirrorInRtl, record}`. `body` is SVG markup
drawn in `currentColor`. `record` is the asset record, in the format of
[docs/licensing.md](../../docs/licensing.md).

## The element

`ui-icon` is defined on import in browsers. In other windows, such as jsdom,
call `defineIconElement(window)`. It has these attributes:

- `name`;
- `set` (the default is `own`);
- `label`;
- `mirror` (`true` or `false`, which overrides `MIRROR_IN_RTL`).

Without a label the icon is decorative (`aria-hidden="true"`). With a label it
is `role="img"`, and the label is its accessible name. The default size is
1.5em; `--ui-icon-size` changes it. Markup from a source is cleaned before it
is shown: scripts, `foreignObject`, event handlers and external `href`s are
removed.

ui-core `ui-dialect/0` has no `icon` kind yet; see
[docs/spec/open-questions.md](../../docs/spec/open-questions.md). To read
`(icon ...)` without warnings, parse with `iconVocabulary()`.

## Adapters

| Entry point                       | Package (optional peer)              | Licence                                                   |
| --------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `icons/adapters/lucide`           | `lucide` (≥ 1.0)                     | ISC, or `ISC AND MIT` for icons derived from Feather      |
| `icons/adapters/tabler`           | `@tabler/icons` (≥ 3.0)              | MIT                                                       |
| `icons/adapters/material-symbols` | `@material-symbols/svg-400` (≥ 0.40) | Apache-2.0. Its LICENSE and a NOTICE ship with the icons. |

Install a package only if you use its set. Each adapter maps the logical names
to library names and reads the SVG files through the module resolver: a
`file:` URL in Node, Bun and Deno, or `fetch` with a browser import map. Pass
`{load}` to read from your own copy instead. Records give the source, the SPDX
licence, the copyright and a link to the notice. Every record has
`(attribution required)`.

## Building

`node scripts/build-icons.mjs` (also `npm run build:icons`) writes
`packages/ui-components/dist/icons/`:

- `<set>.js` and a `<set>.svg` sprite for each set (`<symbol
id="<set>-<name>">`);
- `NOTICE.lino`, with every shipped record;
- `ATTRIBUTION.md`;
- `licenses/<set>/`.

SVGO cleans every icon, and fixed colours become `currentColor`. The build
fails, and writes nothing, when:

- a used icon has no record;
- a licence is not on the allow list;
- a record or a dependency names Remix Icon or SF Symbols (see
  [docs/licensing.md](../../docs/licensing.md)).

`--check` validates without writing, and fails when `src/icons/own-icons.js` is
stale. CI runs it in the Licensing workflow.

## Licence

The code is [Unlicense](LICENSE). The own icons are CC0-1.0. Third-party icons
keep their licences, as recorded above.
