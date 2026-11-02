---
'@link-foundation/ui-i18n': minor
---

Add `@link-foundation/ui-i18n`: localisation with lino-i18n 0.5.0. Documents refer to catalog messages with `(t KEY (PARAM VALUE) ...)`; `createLocalizer({ config, catalogs, approved, defaultLocale })` reads the root prop `locale` through the ui-config layers (falling back to `determineLocale(navigator.languages, approved)`, then `en`), resolves text with interpolation, CLDR plurals, fallbacks and `onMissing`, gives the direction from `getLocaleDirection` and `localizeDocument` writes `(lang ...)` and `(dir ...)` on the root. `locales/ui.lino` holds the framework messages in en, ru, zh and hi, and `npm run check:i18n` checks key parity with `lino-i18n check` and reports hard-coded text in documents with `(i18n required)`.
