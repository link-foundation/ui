# @link-foundation/ui-i18n

Localisation of [`@link-foundation/ui-core`](../ui-core/README.md) documents
with [lino-i18n](https://github.com/link-foundation/lino-i18n) (pinned to
0.5.0). Documents refer to catalog messages with `(t KEY)`; the locale is the
root prop `locale`, resolved through the
[`@link-foundation/ui-config`](../ui-config/README.md) layers, so a language
picker is one user-layer override. Plurals, interpolation, fallbacks and the
text direction come from lino-i18n.

```js
import { format, parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import {
  createLocalizer,
  i18nVocabulary,
  loadUiCatalogs,
  message,
} from '@link-foundation/ui-i18n';

const document = parse(
  `(app: document
  (i18n required)
  (close: button (label (t ui.dialog.close))))`,
  { vocabulary: i18nVocabulary() }
);
const config = createConfig({ document });
const l = createLocalizer({ config, catalogs: await loadUiCatalogs() });

config.set('user', 'app', 'locale', ['ru']); // what a language picker does
l.text({ type: 'message', key: 'ui.dialog.close' }); // 'Закрыть'
l.direction(); // 'ltr'
format(l.localizeDocument(document));
// (app: document
//   (i18n required)
//   (lang ru)
//   (dir ltr)
//   (close: button
//     (label Закрыть)))

config.clear('user'); // back to the platform language, then en
```

The complete example, with plurals and a right-to-left locale, is
`examples/ui-i18n-basics.mjs` in the repository.

Requires Node.js 22.11 or later (the `engines` of lino-i18n 0.5.0), Bun or
Deno. Everything except `loadCatalogDir` and `loadUiCatalogs` on `file:` URLs
runs in browsers.

## Writing messages: `(t ...)`

A message stands where literal text would:

| Form                                        | Meaning                                           |
| ------------------------------------------- | ------------------------------------------------- |
| `(label (t ui.dialog.close))`               | the prop `label` is the message `ui.dialog.close` |
| `(t greeting (name 'Ada'))`                 | params, interpolated as `{name}` or `{{name}}`    |
| `(t files (count 3))`                       | `count` picks the CLDR plural form                |
| `(t greeting (name (t ui.settings.title)))` | a param may be a message too                      |
| `(greeting: text (t greeting))`             | `t` on an element: its first positional value     |

Keys are dotted paths of the catalog. Number atoms of params are numbers;
anything else is text. `parseMessage` reads a raw link
(`{ type: 'message', key, params }`), `message(key, params)` creates one and
`messageRaw` writes one back; `typeValue` is ui-core `values.typeValue` with
the `message` type (a malformed `(t)` is an `invalid-value` error with
`expected: 'message'`).

ui-core reads documents with a fixed vocabulary. With the default one, `(t ...)`
on an element and `(locale ...)`, `(dir ...)` and `(i18n ...)` on the root are
kept as unknown sublinks (with a warning) and this package still reads them.
Parse with `i18nVocabulary()` to make them props: then there are no warnings and
ui-config sees `(locale ...)` of the document as a `site` value.

| Root prop                   | Meaning                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `(locale ru)`               | the locale of the document (a ui-config prop)                |
| `(i18n required\|optional)` | `required`: literal text is an error (`check:i18n`)          |
| `(dir ltr\|rtl)`            | written by `localizeDocument`; any earlier value is replaced |

## Choosing the locale

`l.locale()` is the first of:

1. the root prop `locale` resolved through the config layers (session, user,
   site, theme, defaults), on `options.root` (default `config.base`);
2. `options.locale` or the last `setLocale` (without a config);
3. `determineLocale(navigator.languages, approved)` (`options.languages`
   replaces `navigator.languages`; pass `[]` for deterministic tests);
4. `defaultLocale` (`en`).

The result is matched to the approved locales (default: the locales of the
catalogs), so `ru-RU` becomes `ru`; a locale that is not approved is kept as
is, and its messages fall back to `defaultLocale`.

`l.setLocale('ru')` writes the user layer (`options.layer` for `session`),
`l.setLocale(null)` removes the override. `l.subscribe((locale, previous) => …)`
is called once per change of the locale, whatever changed it.

## Text

`l.text(value, params?)` (and `resolveText(value, l, params?)`):

- strings are returned unchanged;
- messages and raw `(t ...)` links are looked up in the locale, then in
  `defaultLocale`;
- a key missing in every locale returns the key and calls
  `onMissing(key, locale)`.

`l.localizeDocument(doc)` returns a copy of a parsed document with every
message replaced by its text and the root marked with `(lang …)` and
`(dir …)`, ready for a renderer. The source document is not changed.

## Right-to-left locales

`l.direction()` and `localeDirection(locale)` are lino-i18n
`getLocaleDirection`: `rtl` for Arabic, Hebrew, Persian, Urdu and other
right-to-left scripts, `ltr` otherwise (and for an invalid tag).
`localizeDocument` writes it as `(dir rtl)` on the root; renderers map it to
`dir="rtl"` and should use logical CSS properties (`margin-inline-start`, not
`margin-left`) so that layouts mirror.

## Catalogs

`locales/ui.lino` holds the messages of the framework itself (`ui.dialog.close`,
`ui.dialog.ok`, `ui.dialog.cancel`, `ui.settings.title`, `ui.settings.reset`,
`ui.locale.label`) in en, ru, zh and hi, in the lino-i18n format:

```
en
  ui
    dialog
      close "Close"
ru
  ui
    dialog
      close "Закрыть"
```

Plural keys list their CLDR forms (`one`, `few`, `many`, `other`, …):

```
ru
  files
    one "{count} файл"
    few "{count} файла"
    many "{count} файлов"
    other "{count} файла"
```

`readCatalogs(text)` reads a catalog, `loadCatalogDir(dir)` every catalog of a
directory, `loadUiCatalogs()` the framework catalog (from the file system, or
with `fetch` in browsers) and `mergeCatalogs(...)` merges them per locale, later
ones winning: `mergeCatalogs(await loadUiCatalogs(), appCatalogs)`.

### Adding a locale

1. Add a top-level block for the locale (a BCP 47 tag: `ar`, `pt-BR`) to
   `locales/ui.lino` with **every** key of `en`.
2. Run `npm run check:i18n`: it fails on any missing or extra key.
3. Ask a native speaker to review the text. For a right-to-left locale, check
   the rendered `(dir rtl)` too.

## `npm run check:i18n`

`scripts/check-i18n.mjs` runs in CI and fails when:

- **key parity**: `lino-i18n check --dir packages/ui-i18n/locales --reference en`
  finds a locale with missing or extra keys;
- **hard-coded text**: `checkHardcodedText` finds literal text in a `.lino`
  document whose root says `(i18n required)` (every `.lino` file of the
  repository except `node_modules`, `.git` and `locales` directories).

```
node packages/ui-i18n/scripts/check-i18n.mjs [--dir DIR] [--reference LOCALE] [FILE_OR_DIR ...]
```

`checkHardcodedText(text, { textProps, kinds, vocabulary })` reads the document
with ui-core `parse` (never a regular expression) and reports a
`hardcoded-text` error for every string with a letter in the text props
(`label`, `title`, `placeholder`, `description`) or in the positional values of
`text` elements and of kinds whose positional values are text props:

```
(app: document (i18n required) (ok: button (label 'OK')))         one error
(app: document (i18n required) (ok: button (label (t ok.label)))) none
```

Numbers and symbols (`'42'`, `'✓'`) are not language and pass.

The script calls the lino-i18n CLI through its real path: behind the npm bin
symlink, `npx lino-i18n` prints nothing and exits 0
(link-foundation/lino-i18n#39).

## License

[Unlicense](LICENSE)
