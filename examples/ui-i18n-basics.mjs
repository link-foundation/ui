// Usage of @link-foundation/ui-i18n: a document that refers to catalog
// messages with (t KEY), the locale as the root prop `locale` resolved through
// the ui-config layers, plurals, right-to-left direction and the hard-coded
// text check that `npm run check:i18n` runs in CI.
// Run: node examples/ui-i18n-basics.mjs
import { format, parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import {
  checkHardcodedText,
  createLocalizer,
  i18nVocabulary,
  loadUiCatalogs,
  mergeCatalogs,
  message,
  readCatalogs,
} from '@link-foundation/ui-i18n';

const appCatalogs = readCatalogs(`en
  files
    one "{count} file"
    other "{count} files"
ru
  files
    one "{count} файл"
    few "{count} файла"
    many "{count} файлов"
    other "{count} файла"
ar
  ui
    dialog
      close "إغلاق"
`);
const catalogs = mergeCatalogs(await loadUiCatalogs(), appCatalogs);

const document = parse(
  `(app: document
  (i18n required)
  (close: button (label (t ui.dialog.close)))
  (count: text (t files (count 3))))`,
  { vocabulary: i18nVocabulary() }
);
const config = createConfig({ document });
const l = createLocalizer({ config, catalogs, languages: ['de-DE', 'en'] });

console.log(l.locale(), l.text(message('ui.dialog.close')));
// en Close

l.subscribe((locale, previous) =>
  console.log(`locale: ${previous} -> ${locale}`)
);
config.set('user', 'app', 'locale', ['ru']); // what a language picker does
// locale: en -> ru
console.log(l.text({ type: 'message', key: 'ui.dialog.close' }));
// Закрыть
console.log([1, 3, 5].map((count) => l.text(message('files', { count }))));
// [ '1 файл', '3 файла', '5 файлов' ]

console.log(format(l.localizeDocument(document)));
// (app: document
//   (i18n required)
//   (lang ru)
//   (dir ltr)
//   (close: button
//     (label Закрыть))
//   (count: text '3 файла'))

l.setLocale('ar');
// locale: ru -> ar
console.log(l.direction(), l.text(message('ui.dialog.close')));
// rtl إغلاق

config.clear('user');
// locale: ar -> en

console.log(
  checkHardcodedText(
    `(app: document (i18n required) (ok: button (label 'OK')))`
  )
);
// [ { code: 'hardcoded-text', severity: 'error', message: …, at: { element: 'ok', property: 'label' }, value: 'OK' } ]
