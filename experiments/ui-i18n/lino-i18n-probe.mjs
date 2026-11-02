// Probe of lino-i18n 0.5.0 behaviour used by @link-foundation/ui-i18n.
import {
  createI18n,
  parseLinoCatalogs,
  getLocaleDirection,
  determineLocale,
} from 'lino-i18n/browser';

const text = `en
  ui
    dialog
      close "Close"
    files
      one "{count} file"
      other "{count} files"
    greet "Hello, {name}!"
    greet2 "Hello, {{name}}!"
ru
  ui
    dialog
      close "Закрыть"
    files
      one "{count} файл"
      few "{count} файла"
      many "{count} файлов"
      other "{count} файла"
`;
const cats = parseLinoCatalogs(text);
console.log(JSON.stringify(cats, null, 1));
const locales = Object.fromEntries(cats.map((c) => [c.locale, c.translations]));
const missing = [];
const i18n = createI18n({
  locales,
  defaultLocale: 'en',
  fallback: ['en'],
  onMissingKey: (info) => void missing.push(info.key),
});
for (const n of [1, 3, 5, 21]) {
  console.log(n, i18n.t('ui.files', { count: n }, { locale: 'ru' }));
}
console.log(
  i18n.t('ui.greet', { name: 'Ada' }),
  i18n.t('ui.greet2', { name: 'Ada' })
);
console.log(i18n.t('ui.nope', {}, { locale: 'ru' }), missing);
console.log(i18n.t('ui.dialog.close', {}, { locale: 'xx' }));
for (const l of ['ar', 'he', 'en', 'ru', 'zh', 'hi', 'fa', 'ur']) {
  console.log(l, getLocaleDirection(l));
}
console.log(determineLocale(['ru-RU', 'en'], ['en', 'ru', 'zh', 'hi']));
console.log(determineLocale(['de-DE'], ['en', 'ru']));
