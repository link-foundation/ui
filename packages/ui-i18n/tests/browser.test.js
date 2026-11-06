import { describe, it, expect } from 'test-anywhere';
import * as browser from '@link-foundation/ui-i18n/browser';
import * as node from '@link-foundation/ui-i18n';
import { uiCatalogText } from './helpers.js';

describe('browser entry', () => {
  it('shares runtime helpers without exposing filesystem loaders', () => {
    expect(browser.createLocalizer).toBe(node.createLocalizer);
    expect(browser.readCatalogs).toBe(node.readCatalogs);
    expect('loadCatalogDir' in browser).toBe(false);
    expect('UI_LOCALES_URL' in browser).toBe(false);
  });

  it('loads the bundled catalog through injected fetch', async () => {
    const catalogs = await browser.loadUiCatalogs({
      fetch: async (url) => {
        expect(url).toBe(browser.UI_CATALOG_URL);
        return { ok: true, text: async () => uiCatalogText() };
      },
    });
    expect(catalogs.en['ui.dialog.close']).toBe('Close');
  });

  it('reports unsuccessful catalog responses', async () => {
    const error = await browser
      .loadUiCatalogs({ fetch: async () => ({ ok: false, status: 404 }) })
      .catch((error) => error);
    expect(error.message).toContain('HTTP 404');
  });
});
