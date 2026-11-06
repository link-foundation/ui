import { readAsset as fetchAsset } from './read-asset.browser.js';

/** Native ESM can read package assets from disk; HTTP URLs still use fetch. */
export async function readAsset(url) {
  if (url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    return readFile(url, 'utf8');
  }
  return fetchAsset(url);
}
