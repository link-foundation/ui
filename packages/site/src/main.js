/* global document, window */
import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import { createConfig, persistUserLayer } from '@link-foundation/ui-config';
import { render } from '@link-foundation/ui-dom';
import { mountDevMode } from '@link-foundation/ui-devmode';
import themes from 'virtual:site-themes';
import { registerSiteKinds, siteVocabulary } from './kinds.js';
import { languageHref } from './routes.js';

registerSiteKinds();
const data = JSON.parse(document.getElementById('site-document').textContent);
const source = parse(data.text, { vocabulary: siteVocabulary() });
const config = createConfig({ document: source });
let storage;
try {
  storage = window.localStorage;
} catch {
  /* Storage may be disabled. */
}
persistUserLayer(config, storage ?? null, 'link-ui.site.user.v1');
// The URL is authoritative for the language, including after following a link.
config.set('user', 'site', 'locale', [data.language]);
const store = createStore({ document: source });
config.bindStore(store);
const root = document.getElementById('app');
root.replaceChildren();
const handle = render(root, store, {
  config,
  themeRegistry: themes,
  themes,
  setTitle: true,
});
function syncChoices() {
  for (const [control, prop] of [
    ['theme-choice', 'theme'],
    ['scheme-choice', 'scheme'],
  ]) {
    store.setProp(control, 'value', config.resolve('site', prop).value);
  }
  handle.flush();
}
syncChoices();
config.subscribe(syncChoices);
root.addEventListener('ui-change', ({ detail }) => {
  const { source, value } = detail;
  if (source === 'language' && data.languages.includes(value)) {
    config.set('user', 'site', 'locale', [value]);
    window.location.assign(languageHref(data.page, value));
  }
  const prop =
    source === 'theme-choice'
      ? 'theme'
      : source === 'scheme-choice'
        ? 'scheme'
        : null;
  const choices =
    prop === 'theme' ? [...themes.keys()] : ['light', 'dark', 'system'];
  if (prop && choices.includes(value)) {
    config.set('user', 'site', prop, [value]);
  }
});
mountDevMode({ root, config, store, handle, vocabulary: siteVocabulary() });
document.body.dataset.ready = 'true';
