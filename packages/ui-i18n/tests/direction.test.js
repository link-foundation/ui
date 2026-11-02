/**
 * Text direction: `localeDirection`, `l.direction()` and the `(dir ...)` and
 * `(lang ...)` that `localizeDocument` adds to the root.
 */

import { describe, it, expect } from 'test-anywhere';
import { format, parse } from '@link-foundation/ui-core';
import {
  createLocalizer,
  localeDirection,
  localizeDocument,
  propAtom,
} from '@link-foundation/ui-i18n';
import { appDocument, catalogs, setup } from './helpers.js';

describe('direction', () => {
  it('gives rtl for ar and he and ltr for en, ru, zh and hi', () => {
    for (const locale of ['ar', 'he', 'ar-EG', 'fa']) {
      expect(localeDirection(locale)).toBe('rtl');
    }
    for (const locale of ['en', 'ru', 'zh', 'hi', 'en-US']) {
      expect(localeDirection(locale)).toBe('ltr');
    }
    expect(localeDirection('not a tag!')).toBe('ltr');
  });

  it('follows the locale of the localizer', () => {
    const { config, localizer } = setup();
    expect(localizer.direction()).toBe('ltr');
    config.set('user', 'app', 'locale', ['he']);
    expect(localizer.locale()).toBe('he');
    expect(localizer.direction()).toBe('rtl');
  });
});

describe('localizeDocument', () => {
  it('adds (dir rtl) and (lang ar) to the root for ar', () => {
    const { config, localizer } = setup();
    config.set('user', 'app', 'locale', ['ar']);
    const doc = localizer.localizeDocument(appDocument());
    const [root] = doc.roots;
    expect(propAtom(root, 'dir')).toBe('rtl');
    expect(propAtom(root, 'lang')).toBe('ar');
    expect(format(doc)).toContain('(dir rtl)');
  });

  it('replaces messages with text and keeps the source document', () => {
    const { config, localizer } = setup();
    config.set('user', 'app', 'locale', ['ru']);
    const source = appDocument();
    const before = format(source);
    const doc = localizer.localizeDocument(source);
    expect(format(source)).toBe(before);
    expect(format(doc)).toBe(
      [
        '(app: document',
        '  (i18n required)',
        '  (lang ru)',
        '  (dir ltr)',
        '  (ok: button',
        '    (label Хорошо))',
        '  (close: button',
        '    (label Закрыть))',
        "  (greeting: text 'Привет, Ada!')",
        "  (count: text '3 файла'))",
        '',
      ].join('\n')
    );
    expect(doc.byId.get('greeting').positional).toEqual(['Привет, Ada!']);
    expect(doc.byId.get('greeting')).toBe(doc.roots[0].children[2]);
  });

  it('reads documents parsed with the default vocabulary', () => {
    const localizer = createLocalizer({
      catalogs: catalogs(),
      locale: 'ru',
      languages: [],
    });
    const source = parse(
      "(app: document (dir rtl) (greeting: text (t greeting (name 'Ada'))))"
    );
    expect(source.diagnostics.map((d) => d.at.head)).toEqual(['dir', 't']);
    const doc = localizeDocument(source, localizer);
    expect(doc.roots[0].children[0].positional).toEqual(['Привет, Ada!']);
    expect(doc.roots[0].children[0].unknown).toEqual([]);
    expect(propAtom(doc.roots[0], 'dir')).toBe('ltr');
    expect(doc.diagnostics.map((d) => d.at.head)).toEqual(['dir']);
  });

  it('marks only the configured root element', () => {
    const localizer = createLocalizer({
      catalogs: catalogs(),
      locale: 'en',
      root: 'ok',
    });
    const doc = localizer.localizeDocument(appDocument());
    expect(propAtom(doc.byId.get('ok'), 'lang')).toBe('en');
    expect(propAtom(doc.roots[0], 'lang')).toBeUndefined();
  });
});
