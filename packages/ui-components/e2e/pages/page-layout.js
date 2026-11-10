/* global document, window, localStorage */
import { parse } from '@link-foundation/ui-core';
import { mountDocument } from '@link-foundation/ui-dom';
import { createConfig, persistLayer } from '@link-foundation/ui-config';
import { bindConfig, readSchema } from '@link-foundation/ui-settings';
import {
  layoutVocabulary,
  PREF_SWITCHES_SCHEMA,
} from '../../src/layout/index.js';

const config = createConfig({
  document: parse('preferences: document\n  settings: group\n'),
});
persistLayer(config, 'user', localStorage, 'page-layout-prefs');
const target = bindConfig(config, readSchema(PREF_SWITCHES_SCHEMA).schema);
const diagnostics = [];
const text = `app: stack
  direction vertical
  align stretch
  bar: app-bar 'Links UI'
    pages: nav-strip
      label Pages
      active research
      wrap-below 600px
      home: nav-link Home
        href /home
      projects: nav-link Projects
        href /projects
      research: nav-link Research
        href /research
      publications: nav-link Publications
        href /publications
      contact: nav-link Contact
        href /contact
      resources: nav-link Resources
        href /resources
  content: stack
    direction vertical
    align stretch
    sections: section-nav
      label Sections
      back-to-top '#intro'
      back-label 'Back to top'
      intro-link: nav-link Introduction
        href '#intro'
      work-link: nav-link Work
        href '#work'
    prefs: pref-switches
    intro: titled-section Introduction
      kicker 'BUILT WITH LINKS'
      introduction: text 'Reusable page navigation, sections and preferences.'
    cards: link-cards
      docs: link-card Documentation
        href '#work'
        glyph '↗'
        summary 'Explore the framework and its building blocks.'
      source: link-card Source
        href 'https://github.com/link-foundation/ui'
        glyph '◇'
        summary 'Read and contribute to the public domain project.'
    work: titled-section Work
      details: text 'Section links move keyboard focus to this target.'
`;
const result = mountDocument(document.getElementById('app'), text, {
  parseOptions: { vocabulary: layoutVocabulary() },
  layout: {
    preferences: {
      target,
      languages: [
        { locale: 'en', label: 'English' },
        { locale: 'ru', label: 'Русский' },
      ],
      message(key, params) {
        if (target.get('locale') === 'ru' && key === 'theme') {
          const names = { system: 'система', light: 'светлая', dark: 'тёмная' };
          return `Тема: ${names[params.current]}, далее ${names[params.next]}`;
        }
      },
    },
  },
  onDiagnostic: (d) => diagnostics.push(d),
});
window.pageLayout = { ...result, target, diagnostics };
document.body.dataset.ready = 'true';
