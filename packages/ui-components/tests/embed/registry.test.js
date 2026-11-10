import { describe, it, expect } from 'test-anywhere';
import {
  registerEmbedProvider,
  getEmbedProvider,
} from '../../src/embed/registry.js';
import { loadEmbedScript } from '../../src/embed/script.js';
import { createDom } from '../support/dom.js';

describe('embed registry and shared script loader', () => {
  it('requires an explicit trusted HTTPS adapter', () => {
    expect(() =>
      registerEmbedProvider('bad', { script: 'javascript:alert(1)' })
    ).toThrow();
    const adapter = {
      script: null,
      validate: () => true,
      url: () => 'https://example.com',
      render: () => {},
    };
    const remove = registerEmbedProvider('test', adapter);
    expect(getEmbedProvider('test').validate({ id: '1' })).toBe(true);
    remove();
    expect(getEmbedProvider('test')).toBe(undefined);
  });

  it('shares one request and evicts failures for retry', async () => {
    const { document, window } = createDom();
    const url = 'https://example.com/widget.js';
    const first = loadEmbedScript(document, url);
    expect(loadEmbedScript(document, url)).toBe(first);
    expect(document.scripts.length).toBe(1);
    document.scripts[0].dispatchEvent(new window.Event('error'));
    expect(await first.catch((error) => error.message)).toBe(
      'Embed script failed or timed out'
    );
    expect(document.scripts.length).toBe(0);
    const retry = loadEmbedScript(document, url);
    document.scripts[0].dispatchEvent(new window.Event('load'));
    await retry;
    expect(loadEmbedScript(document, url)).toBe(retry);
    window.close();
  });
});
