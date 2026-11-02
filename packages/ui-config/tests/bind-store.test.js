/**
 * bindStore: the resolved configuration applied to a ui-store store.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';
import { CONFIG_ORIGIN, createConfig } from '@link-foundation/ui-config';
import { appDocument, fixture } from './helpers.js';

function bound(setup = () => {}) {
  const config = createConfig({ document: appDocument() });
  setup(config);
  const store = createStore({ document: appDocument() });
  const entries = [];
  store.subscribe((events, entry) => entries.push({ entry, events }));
  const unbind = config.bindStore(store);
  return { config, store, entries, unbind };
}

const tokens = (store) =>
  store
    .get('material3')
    .properties.filter((p) => p.name === 'token')
    .map((p) => p.values);

describe('bindStore', () => {
  it('applies a change as one transaction with the origin config', () => {
    const { config, store, entries } = bound();
    expect(entries).toEqual([]);
    config.loadLayer('user', fixture('user.lino'));
    expect(entries.length).toBe(1);
    expect(CONFIG_ORIGIN).toBe('config');
    expect(entries[0].entry.origin).toBe('config');
    expect(entries[0].entry.label).toBe('Apply configuration');
    expect(entries[0].events.every((e) => e.origin === 'config')).toBe(true);
    expect(store.get('greeting').positional).toEqual(['Hello, agents']);
    expect(tokens(store)[0]).toEqual(['color.primary', '#00639B']);
    expect(tokens(store).length).toBe(5);
    expect(store.get('body').properties).toEqual([
      { name: 'direction', values: ['vertical'] },
      { name: 'gap', values: [['token', 'space.medium']] },
      { name: 'padding', values: ['16px'] },
    ]);
    expect(store.canUndo()).toBe(true);
  });

  it('applies the existing overrides when it is bound', () => {
    const { store, entries } = bound((config) =>
      config.set('user', 'ok', 'label', ['Save'])
    );
    expect(entries.length).toBe(1);
    expect(entries[0].entry.origin).toBe('config');
    expect(store.get('ok').properties[0]).toEqual({
      name: 'label',
      values: ['Save'],
    });
  });

  it('keeps ids, children and order when the positional values change', () => {
    const { config, store } = bound();
    const roots = store.roots();
    const children = store.children('body');
    config.set('session', 'greeting', 'text', ['Hi']);
    expect(store.roots()).toEqual(roots);
    expect(store.children('body')).toEqual(children);
    expect(store.get('greeting').positional).toEqual(['Hi']);
    expect(store.get('greeting').parentId).toBe('body');
  });

  it('falls back to the lower layers when overrides go away', () => {
    const { config, store, entries } = bound();
    config.set('user', 'greeting', 'text', ['Hello, agents']);
    config.set('session', 'greeting', 'text', ['Hi']);
    config.unset('session', 'greeting', 'text');
    expect(store.get('greeting').positional).toEqual(['Hello, agents']);
    config.unset('user', 'greeting', 'text');
    expect(store.get('greeting').positional).toEqual(['Hello, links']);
    config.set('user', 'ok', 'disabled', ['true']);
    expect(store.get('ok').properties.at(-1)).toEqual({
      name: 'disabled',
      values: ['true'],
    });
    config.clear('user');
    expect(store.get('ok').properties.some((p) => p.name === 'disabled')).toBe(
      false
    );
    config.set('user', 'material3', 'token', ['1px'], 'space.tiny');
    expect(tokens(store).at(-1)).toEqual(['space.tiny', '1px']);
    config.clear('user');
    expect(tokens(store).length).toBe(5);
    expect(entries.length).toBe(8);
    expect(store.undo()).toBe(true);
    expect(tokens(store).at(-1)).toEqual(['space.tiny', '1px']);
  });

  it('stops following the configuration after unbind', () => {
    const { config, store, entries, unbind } = bound();
    unbind();
    config.set('user', 'ok', 'label', ['Save']);
    expect(entries).toEqual([]);
    expect(store.get('ok').properties[0].values).toEqual(['OK']);
  });

  it('takes the origin and label from the options', () => {
    const config = createConfig({ document: appDocument() });
    const store = createStore({ document: appDocument() });
    config.bindStore(store, { origin: 'theme', label: null });
    config.set('user', 'ok', 'label', ['Save']);
    expect(store.log().map((e) => [e.origin, e.label])).toEqual([
      ['theme', null],
    ]);
  });
});
