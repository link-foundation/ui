# Page navigation and quick preferences

Import `@link-foundation/ui-components/layout` and its `layout.css`. Parse with
`layoutVocabulary()` (combined with other vocabularies as needed). The kinds also
work through the DOM, React and Vue renderers.

```lino
header: app-bar 'My site'
  pages: nav-strip
    label Pages
    active docs
    wrap-below 600px
    home: nav-link Home
      href /
    docs: nav-link Documentation
      href /docs
```

`nav-strip` renders a native labelled navigation landmark, list and anchors.
Set `active` to a child ID or its href when the route changes. Only the first
matching link receives `aria-current="page"`; ordinary Tab order is preserved.
The overflowing current link is centred without moving page scroll or focus.
`nav[data-more]` contains logical `start`, `end`, or both, with a 1px tolerance.
Passive scroll and resize update it. The mask follows those edges in LTR and
RTL. Override `--ui-nav-fade` (default `2rem`) and `--ui-nav-gap` as tokens.
`wrap-below` accepts a CSS length in px, rem or em; below it, the strip occupies
a full row in its app-bar slot.

```lino
sections: section-nav
  label 'On this page'
  back-to-top '#introduction'
  back-label 'Back to top'
  intro-link: nav-link Introduction
    href '#introduction'
introduction: titled-section Introduction
  kicker Welcome
  level 2
  body: text 'Page content.'
cards: link-cards
  min 240px
  guide: link-card Guide
    href /guide
    glyph '↗'
    summary 'Start building with Links UI.'
```

`section-nav` shares scrolling and fades, uses `aria-current="location"`, and
moves keyboard focus to local anchor targets (native IDs or store IDs). Its
optional back link has a configurable accessible name. `titled-section` renders
a labelled native section, an optional kicker and a heading (`level` 1–6,
default 2). `link-cards` uses auto-fill columns, with a minimum of 240px by
default, constrained to the available width. Each `link-card` contains one
anchor with one accessible name from its title and summary. `glyph` (also `icon`) is a
text icon slot, hidden from the accessible name. Links use the controls' URL
policy and cancelable `ui-navigate` event, including modifier-click semantics.
Lift on hover and keyboard focus is disabled under reduced motion.

## Preferences

Use `createPrefSwitches(options)` directly or put a `pref-switches` in an
`app-bar` and pass `options.layout.preferences` to the renderer:

```js
const { schema } = readSchema(PREF_SWITCHES_SCHEMA);
const target = bindConfig(config, schema, { target: 'settings' });
persistLayer(config, 'user', localStorage);
const preferences = {
  target,
  localizer, // ui-i18n createLocalizer; setLocale is called on locale changes
  languages: [
    { locale: 'en', label: 'English' },
    { locale: 'ru', label: 'Русский' },
  ],
  scope: document.documentElement,
  message: (key, params) => translatePreferenceLabel(key, params),
};
// mountDocument(container, text, { layout: { preferences }, ... });
```

The exported schema defines comfort fields `locale`, `sound.enabled`,
`motion.mode` (`auto` → `on` → `off`) and `theme.mode`
(`system` → `light` → `dark`). Merge these fields into an application's larger
schema and share its binding with the sound adapter; no competing storage is
created by the switches. The host owns `persistLayer` and stops it at teardown.
A missing target gives an in-memory preview, useful for component stories.

Language labels carry `lang`, and their buttons carry `aria-pressed`. The sound
button has separate on/off icons and an explicit pressed state. Auto motion
tracks the system media query live; the scope receives effective `data-motion`
`on`/`off`. Theme writes effective `data-scheme` and native `color-scheme`.
`onChange(values)` lets a host forward choices to its renderer/theme boundary
or animation player. Labels use `message('theme', {current, next})`,
`message('motion', {current, next})`, and `message('sound', {enabled})`;
return localized strings, including translated state names. English fallbacks
include “Theme: system, next light”. `label` and `languageLabel` name groups.
Config subscriptions reflect external edits. Call `destroy()` to release the
binding subscription and media listeners when using the factory directly.

The browser fixture at `packages/ui-components/e2e/pages/page-layout.html`
demonstrates wrapping, anchor focus, cards and persistent preferences. Run
`npx playwright test packages/ui-components/e2e/page-layout.e2e.mjs --workers 1`.
