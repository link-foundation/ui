/**
 * `mountDevMode` over the sample page in jsdom: open and close, the
 * global handle, the outline, pick mode, live edits, Save, Discard and
 * Reset, and a disabled policy that never loads the inspector.
 */

import { describe, it, expect } from 'test-anywhere';
import { GLOBAL_NAME, mountDevMode } from '../src/index.js';
import {
  createPage,
  key,
  POLICY,
  sample,
  shortcut,
  tick,
  waitFor,
} from './setup.js';

/** The sample page with dev mode mounted (and opened unless `open: false`). */
async function openPage({ policy = POLICY, open = true, url } = {}) {
  const page = createPage({ url });
  const dev = mountDevMode({
    root: page.root,
    config: page.config,
    store: page.store,
    handle: page.handle,
    window: page.window,
    styles: sample('styles'),
    tokens: sample('tokens'),
    animations: sample('animation'),
    policy,
  });
  if (open) {
    expect(await dev.open()).toBe(true);
  }
  const shadow = () =>
    page.document.querySelector('ui-devmode-inspector')?.shadowRoot ?? null;
  const $ = (selector) => shadow().querySelector(selector);
  const row = (name) => $(`tr[data-name="${name}"]`);
  const okButton = () => page.handle.nodeFor('ok').querySelector('button');
  return { ...page, dev, shadow, $, row, okButton };
}

const click = (window, node) =>
  node.dispatchEvent(
    new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
    })
  );

describe('mountDevMode', () => {
  it('opens the inspector and publishes the global handle', async () => {
    const { dev, $, document } = await openPage();
    expect(dev.isOpen).toBe(true);
    const handle = globalThis[GLOBAL_NAME];
    expect(Object.keys(handle)).toEqual([
      'select',
      'getSelection',
      'setProperty',
      'close',
    ]);
    expect($('[role="complementary"]')).not.toBe(null);
    // Each view renders into its tabpanel; the tab buttons hold text only.
    expect($('[role="tab"] *')).toBe(null);
    expect($('[role="tabpanel"][data-view="outline"] [role="tree"]')).not.toBe(
      null
    );
    expect(document.querySelector('ui-devmode-overlay')).not.toBe(null);
    expect($('[data-command="pick"]').getAttribute('aria-pressed')).toBe(
      'true'
    );
    handle.close();
    expect(dev.isOpen).toBe(false);
    expect(globalThis[GLOBAL_NAME]).toBe(undefined);
    expect(document.querySelector('ui-devmode-inspector')).toBe(null);
    expect(document.querySelector('ui-devmode-overlay')).toBe(null);
    dev.destroy();
  });

  it('shows the outline app > body > greeting, ok, synced with the selection', async () => {
    const { dev, $, shadow } = await openPage();
    const items = () => [...shadow().querySelectorAll('[role="treeitem"]')];
    expect(
      items().map((n) => `${n.getAttribute('aria-level')}:${n.dataset.id}`)
    ).toEqual(['1:app', '2:body', '3:greeting', '3:ok']);
    $('[data-id="ok"] .row').click();
    expect(globalThis[GLOBAL_NAME].getSelection()).toEqual({
      id: 'ok',
      type: 'button',
    });
    expect($('[data-id="ok"]').getAttribute('aria-selected')).toBe('true');
    globalThis[GLOBAL_NAME].select('greeting');
    expect($('[data-id="greeting"]').getAttribute('aria-selected')).toBe(
      'true'
    );
    expect($('[data-id="ok"]').getAttribute('aria-selected')).toBe('false');
    dev.destroy();
  });

  it('moves through the outline with the keyboard', async () => {
    const { dev, $, window } = await openPage();
    const tree = $('[role="tree"]');
    const press = (name) =>
      $('[role="treeitem"][aria-selected="true"]').dispatchEvent(
        key(window, { key: name })
      );
    $('[data-id="app"] .row').click();
    press('ArrowDown');
    expect(globalThis[GLOBAL_NAME].getSelection().id).toBe('body');
    press('End');
    expect(globalThis[GLOBAL_NAME].getSelection().id).toBe('ok');
    press('ArrowLeft');
    expect(globalThis[GLOBAL_NAME].getSelection().id).toBe('body');
    press('ArrowLeft');
    expect($('[data-id="body"]').getAttribute('aria-expanded')).toBe('false');
    press('Home');
    expect(globalThis[GLOBAL_NAME].getSelection().id).toBe('app');
    expect(tree.querySelectorAll('[tabindex="0"]').length).toBe(1);
    dev.destroy();
  });

  it('selects on click in pick mode without delivering the press', async () => {
    const { dev, actions, okButton, window, $ } = await openPage();
    click(window, okButton());
    expect(actions).toEqual([]);
    expect(globalThis[GLOBAL_NAME].getSelection()).toEqual({
      id: 'ok',
      type: 'button',
    });
    expect($('[data-command="pick"]').getAttribute('aria-pressed')).toBe(
      'true'
    );
    // Escape leaves pick mode: the app gets its clicks again.
    window.dispatchEvent(key(window, { key: 'Escape' }));
    expect(dev.isOpen).toBe(true);
    click(window, okButton());
    expect(actions.length).toBe(1);
    // A second Escape closes.
    window.dispatchEvent(key(window, { key: 'Escape' }));
    expect(dev.isOpen).toBe(false);
    dev.destroy();
  });
});

describe('mountDevMode edits', () => {
  it('applies a label edit at once, saves it to user and resets it to site', async () => {
    const { dev, row, $, okButton, config } = await openPage();
    const handle = globalThis[GLOBAL_NAME];
    handle.select('ok');
    expect(row('label').dataset.layer).toBe('site');
    expect(row('label').classList.contains('is-changed')).toBe(false);

    handle.setProperty('ok', 'label', 'Okay');
    await tick(30);
    expect(okButton().textContent).toBe('Okay');
    expect(row('label').dataset.layer).toBe('session');
    expect(row('label').classList.contains('is-changed')).toBe(true);

    $('[data-command="save"]').click();
    await tick(30);
    expect(row('label').dataset.layer).toBe('user');
    expect(config.overrides('session')).toEqual([]);
    expect(okButton().textContent).toBe('Okay');

    const reset = row('label').querySelector('button');
    expect(reset.getAttribute('aria-label')).toBe('Reset label');
    reset.click();
    await tick(30);
    expect(row('label').dataset.layer).toBe('site');
    expect(okButton().textContent).toBe('OK');
    expect(row('label').querySelector('button').disabled).toBe(true);
    dev.destroy();
  });

  it('edits through the typed editor of the grid', async () => {
    const { dev, row, okButton, window, $ } = await openPage();
    globalThis[GLOBAL_NAME].select('ok');
    const input = row('label').querySelector('input');
    input.value = 'Go';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await tick(30);
    expect(okButton().textContent).toBe('Go');
    const variant = row('variant').querySelector('select');
    variant.value = 'outlined';
    variant.dispatchEvent(new window.Event('change', { bubbles: true }));
    await tick(30);
    expect(row('variant').dataset.layer).toBe('session');
    $('[data-command="discard"]').click();
    await tick(30);
    expect(okButton().textContent).toBe('OK');
    expect(row('label').dataset.layer).toBe('site');
    expect(row('variant').dataset.layer).toBe('site');
    dev.destroy();
  });

  it('fills the Styles, Tokens, Animations and Source views', async () => {
    const { dev, $ } = await openPage();
    globalThis[GLOBAL_NAME].select('ok');
    expect($('[role="tabpanel"][data-view="source"] pre').textContent).toBe(
      'ok: button\n  label OK\n  variant filled\n  on press\n    navigate home'
    );
    expect(
      $('[role="tabpanel"][data-view="styles"]').textContent.length > 0
    ).toBe(true);
    expect(
      $('[role="tabpanel"][data-view="tokens"]').textContent.length > 0
    ).toBe(true);
    expect(
      $('[role="tabpanel"][data-view="animations"]').textContent.length > 0
    ).toBe(true);
    dev.destroy();
  });

  it('keeps locked elements read-only', async () => {
    const { dev, row, $ } = await openPage({
      policy: '(p: dev-mode (locked-elements body))',
    });
    globalThis[GLOBAL_NAME].select('ok');
    expect(row('label').classList.contains('is-locked')).toBe(true);
    expect(row('label').querySelector('input').disabled).toBe(true);
    expect($('[role="tabpanel"][data-view="properties"] .note')).not.toBe(null);
    expect(() =>
      globalThis[GLOBAL_NAME].setProperty('ok', 'label', 'X')
    ).toThrow();
    dev.destroy();
  });
});

describe('mountDevMode entry points', () => {
  it('toggles with the shortcut and opens with ?ui-dev', async () => {
    const { dev, window } = await openPage({ open: false });
    expect(dev.isOpen).toBe(false);
    window.dispatchEvent(shortcut(window));
    await waitFor(() => dev.isOpen);
    expect(globalThis[GLOBAL_NAME]).not.toBe(undefined);
    window.dispatchEvent(shortcut(window));
    expect(dev.isOpen).toBe(false);
    dev.destroy();

    const viaUrl = await openPage({
      open: false,
      url: 'http://localhost/?ui-dev',
    });
    await waitFor(() => viaUrl.dev.isOpen);
    expect(viaUrl.dev.isOpen).toBe(true);
    viaUrl.dev.destroy();
    expect(globalThis[GLOBAL_NAME]).toBe(undefined);
  });

  it('stays inert with a disabled policy', async () => {
    const { dev, window, document } = await openPage({
      policy: '(p: dev-mode (enabled false))',
      open: false,
      url: 'http://localhost/?ui-dev',
    });
    expect(await dev.open()).toBe(false);
    window.dispatchEvent(shortcut(window));
    await tick(30);
    expect(dev.isOpen).toBe(false);
    expect(globalThis[GLOBAL_NAME]).toBe(undefined);
    expect(document.querySelector('ui-devmode-inspector')).toBe(null);
    dev.destroy();
  });
});
