import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { createStore } from '@link-foundation/ui-store';
import { render } from '@link-foundation/ui-dom';
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { CONTROL_KIND_SPECS } from '@link-foundation/ui-components/controls';
import { clientThemes } from '../client-themes.js';

test('CSS-backed client themes preserve rendering and switches for every theme', async () => {
  const themes = new Map();
  for (const id of listThemes()) {
    themes.set(id, await loadTheme(id));
  }
  const client = clientThemes(themes);
  assert.deepEqual([...client.keys()], listThemes());
  assert.ok(
    JSON.stringify([...client], (_key, value) =>
      value instanceof Map ? [...value] : value
    ).length < 30_000,
    'client metadata stays small across all themes'
  );
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  try {
    for (const [id, theme] of themes) {
      assert.deepEqual(client.get(id).templates, theme.templates, id);
      assert.deepEqual(client.get(id).defaults, theme.defaults, id);
      assert.equal(client.get(id).tokens, undefined, id);
      for (const scheme of ['light', 'dark']) {
        const source = parse(`demo: document
  theme ${id}
  scheme ${scheme}
  go: button
    label Go
`);
        const markup = [];
        for (const registry of [themes, client]) {
          const config = createConfig({ document: source });
          const store = createStore({ document: source });
          const handle = render(root, store, {
            kinds: CONTROL_KIND_SPECS,
            config,
            themes: registry,
            adoptStyles: false,
          });
          assert.deepEqual(handle.diagnostics, [], id);
          markup.push(root.innerHTML);
          // The site's theme selector changes configuration synchronously.
          config.set('user', 'demo', 'theme', ['base']);
          config.set('user', 'demo', 'theme', [id]);
          assert.equal(root.firstElementChild.dataset.theme, id);
          assert.equal(root.firstElementChild.dataset.scheme, scheme);
          handle.destroy();
        }
        assert.equal(markup[1], markup[0], `${id} ${scheme}`);
      }
    }
  } finally {
    dom.window.close();
  }
});
