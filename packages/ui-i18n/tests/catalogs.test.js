/**
 * The catalogs: locales/ui.lino and the helpers that read and merge them.
 */

import { describe, it, expect } from 'test-anywhere';
import { fileURLToPath } from 'node:url';
import {
  loadCatalogDir,
  loadUiCatalogs,
  mergeCatalogs,
  readCatalogs,
  UI_LOCALES_URL,
} from '@link-foundation/ui-i18n';
import { uiCatalogText } from './helpers.js';

const LOCALES = ['en', 'ru', 'zh', 'hi'];

describe('ui catalogs', () => {
  it('has en, ru, zh and hi with the same keys', () => {
    const catalogs = readCatalogs(uiCatalogText());
    expect(Object.keys(catalogs).sort()).toEqual([...LOCALES].sort());
    const keys = Object.keys(catalogs.en).sort();
    expect(keys.includes('ui.dialog.close')).toBe(true);
    for (const locale of LOCALES) {
      expect(Object.keys(catalogs[locale]).sort()).toEqual(keys);
      for (const key of keys) {
        expect(catalogs[locale][key].length > 0).toBe(true);
      }
    }
  });

  it('translates ui.dialog.close', () => {
    const catalogs = readCatalogs(uiCatalogText());
    expect(catalogs.en['ui.dialog.close']).toBe('Close');
    expect(catalogs.ru['ui.dialog.close']).toBe('Закрыть');
    expect(catalogs.zh['ui.dialog.close']).toBe('关闭');
    expect(catalogs.hi['ui.dialog.close']).toBe('बंद करें');
  });

  it('loads with loadUiCatalogs and loadCatalogDir', async () => {
    const expected = readCatalogs(uiCatalogText());
    expect(await loadUiCatalogs()).toEqual(expected);
    expect(await loadCatalogDir(fileURLToPath(UI_LOCALES_URL))).toEqual(
      expected
    );
  });
});

describe('readCatalogs and mergeCatalogs', () => {
  it('reads plural forms as suffixed keys', () => {
    const catalogs = readCatalogs(
      [
        'en',
        '  files',
        '    one "{count} file"',
        '    other "{count} files"',
      ].join('\n')
    );
    expect(catalogs.en).toEqual({
      files_one: '{count} file',
      files_other: '{count} files',
    });
  });

  it('merges per locale, later catalogs winning', () => {
    const merged = mergeCatalogs(
      { en: { a: '1', b: '2' }, ru: { a: 'один' } },
      { en: { b: 'two' }, zh: { a: '一' } }
    );
    expect(merged).toEqual({
      en: { a: '1', b: 'two' },
      ru: { a: 'один' },
      zh: { a: '一' },
    });
  });
});
