import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createLocalizer } from '@link-foundation/ui-i18n';
import { createConfig } from '@link-foundation/ui-config';
import { bindConfig, readSchema } from '@link-foundation/ui-settings';
import { mountLayout, flush } from './helpers.js';
import {
  PREF_SWITCHES_SCHEMA,
  createPrefSwitches,
} from '../../src/layout/index.js';

describe('page layout', () => {
  it('renders native navigation and updates one current link without changing Tab order', async () => {
    const page = await mountLayout(`pages: nav-strip
  label Pages
  active second
  first: nav-link First
    href /first
  second: nav-link Second
    href /second
`);
    await new Promise((resolve) => page.window.requestAnimationFrame(resolve));
    const nav = page.node('pages').querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Pages');
    expect(nav.querySelectorAll('ul > li > a').length).toBe(2);
    expect(nav.querySelector('[aria-current]').textContent).toBe('Second');
    page.store.setProp('pages', 'active', ['first']);
    await flush();
    expect(nav.querySelectorAll('[aria-current]').length).toBe(1);
    expect(nav.querySelector('[aria-current]').textContent).toBe('First');
    expect([...nav.querySelectorAll('a')].map((a) => a.tabIndex)).toEqual([
      0, 0,
    ]);
    page.close();
  });

  it('names sections and cards, refuses unsafe links and focuses anchor targets', async () => {
    const page = await mountLayout(`app: stack
  sections: section-nav
    label Sections
    back-to-top '#intro'
    back-label 'Back to top'
    jump: nav-link Introduction
      href '#intro'
  intro: titled-section Introduction
    kicker Welcome
    level 3
    body: text Hello
  cards: link-cards
    card: link-card Documentation
      href /docs
      glyph '↗'
      summary 'Learn the framework'
    unsafe: link-card Unsafe
      href 'javascript:alert(1)'
`);
    expect(
      page
        .node('intro')
        .querySelector('section')
        .getAttribute('aria-labelledby')
    ).toBe(page.node('intro').querySelector('h3').id);
    expect(page.node('card').querySelectorAll('a').length).toBe(1);
    expect(page.node('unsafe').querySelector('a').hasAttribute('href')).toBe(
      false
    );
    const top = page.node('sections').querySelector('[data-part="back"] a');
    expect(top.getAttribute('aria-label')).toBe('Back to top');
    page.node('jump').querySelector('a').click();
    expect(page.document.activeElement).toBe(page.node('intro'));
    page.close();
  });

  it('mounts quick preferences in the app-bar slot and releases its config subscription', async () => {
    const config = createConfig({
      document: parse('app: document\n  settings: group\n'),
    });
    const target = bindConfig(config, readSchema(PREF_SWITCHES_SCHEMA).schema);
    const page = await mountLayout(
      `bar: app-bar Preferences
  prefs: pref-switches
`,
      { layout: { preferences: { target } } }
    );
    const header = page.node('bar').querySelector('header');
    const button = header.querySelector(
      '[aria-label="Theme: system, next light"]'
    );
    expect(button).not.toBe(null);
    button.click();
    expect(target.get('theme.mode')).toBe('light');
    target.update({ 'theme.mode': 'dark' });
    expect(button.getAttribute('aria-label')).toBe('Theme: dark, next system');
    page.close();
    target.update({ 'theme.mode': 'system' });
    expect(button.getAttribute('aria-label')).toBe('Theme: dark, next system');
  });

  it('binds all preference comfort fields, calls setLocale and restores config values', async () => {
    const page = await mountLayout('x: stack');
    const { schema, diagnostics } = readSchema(PREF_SWITCHES_SCHEMA);
    expect(diagnostics).toEqual([]);
    const config = createConfig({
      document: parse('app: document\n  settings: group\n'),
    });
    const target = bindConfig(config, schema);
    const localizer = createLocalizer({
      catalogs: { en: {}, ru: {} },
      locale: 'en',
    });
    const prefs = createPrefSwitches({
      document: page.document,
      target,
      localizer,
      languages: [
        { locale: 'en', label: 'English' },
        { locale: 'ru', label: 'Русский' },
      ],
    });
    page.document.body.append(prefs.element);
    const buttons = prefs.element.querySelectorAll('button');
    buttons[1].click();
    buttons[2].click();
    buttons[3].click();
    buttons[4].click();
    expect(localizer.locale()).toBe('ru');
    expect(target.get('sound.enabled')).toBe(true);
    expect(target.get('motion.mode')).toBe('on');
    expect(buttons[4].getAttribute('aria-label')).toBe(
      'Theme: light, next dark'
    );
    expect(config.comfortProperties().length).toBe(4);
    const restored = createConfig({
      document: parse('app: document\n  settings: group\n'),
      layers: { user: config.exportPatch() },
    });
    expect(bindConfig(restored, schema).values()).toEqual(target.values());
    prefs.destroy();
    page.close();
  });
});

it('renders sections, navigation and cards as static HTML', async () => {
  const { renderToHTML } = await import('@link-foundation/ui-dom');
  const { layoutVocabulary } = await import('../../src/layout/index.js');
  const html = renderToHTML(
    parse(
      `app: stack
  pages: nav-strip
    label Pages
    one: nav-link One
      href /one
  section: titled-section Title
    level 3
  prefs: pref-switches
  cards: link-cards
    card: link-card Card
      href /card
      summary Details
`,
      { vocabulary: layoutVocabulary() }
    )
  );
  expect(html).toContain('<nav aria-label="Pages">');
  expect(html).toContain('<li');
  expect(html).toContain('>One</a>');
  expect(html).toContain('<h3');
  expect(html).toContain('Details');
  expect(html).toContain('Theme: system, next light');
});
