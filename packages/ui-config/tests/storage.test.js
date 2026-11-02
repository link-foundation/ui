/**
 * persistLayer: the user and session layers in Web Storage (in-memory stub).
 */

import { describe, it, expect } from 'test-anywhere';
import {
  createConfig,
  persistLayer,
  persistSessionLayer,
  persistUserLayer,
  readPatch,
  STORAGE_KEYS,
} from '@link-foundation/ui-config';
import { appDocument, memoryStorage, sample } from './helpers.js';

const newConfig = () => createConfig({ document: appDocument() });

describe('persistLayer', () => {
  it('uses versioned default keys', () => {
    expect(STORAGE_KEYS).toEqual({
      user: 'link-ui.config.user.v1',
      session: 'link-ui.config.session.v1',
    });
  });

  it('restores the layer after a reload', () => {
    const storage = memoryStorage();
    const first = newConfig();
    expect(persistUserLayer(first, storage).diagnostics).toEqual([]);
    first.set('user', 'greeting', 'text', ['Hello, agents']);
    first.set('user', 'material3', 'token', ['#00639B'], 'color.primary');
    expect(storage.data.get('link-ui.config.user.v1')).toBe(
      sample('overrides.lino')
    );

    const second = newConfig();
    expect(persistUserLayer(second, storage).diagnostics).toEqual([]);
    expect(second.resolve('greeting', 'text')).toEqual({
      layer: 'user',
      value: ['Hello, agents'],
    });
    expect(second.overrides('user')).toEqual(first.overrides('user'));
  });

  it('keeps the session layer apart and removes empty layers', () => {
    const storage = memoryStorage();
    const config = newConfig();
    persistLayer(config, 'user', storage);
    const { stop } = persistSessionLayer(config, storage);
    config.set('session', 'ok', 'label', ['Go']);
    expect([...storage.data.keys()]).toEqual(['link-ui.config.session.v1']);
    expect(readPatch(storage.data.get(STORAGE_KEYS.session)).layer).toBe(
      'session'
    );
    config.set('user', 'ok', 'label', ['Go']);
    config.set('session', 'greeting', 'text', ['Hi']);
    expect(
      readPatch(storage.data.get(STORAGE_KEYS.session)).ops.map((o) => o.id)
    ).toEqual(['greeting']);
    config.clear('session');
    expect([...storage.data.keys()]).toEqual(['link-ui.config.user.v1']);
    stop();
    config.set('session', 'ok', 'label', ['Stop']);
    expect(storage.data.has(STORAGE_KEYS.session)).toBe(false);
  });

  it('ignores corrupted stored text with a diagnostic', () => {
    for (const text of [
      '(((',
      '(x: document)',
      '(p: overrides (layer user) (set nope label A))',
      '(p: overrides (layer user) (set ok label A) (explode ok))',
    ]) {
      const storage = memoryStorage({ 'my-key': text });
      const config = newConfig();
      const seen = [];
      const { diagnostics } = persistLayer(config, 'user', storage, 'my-key', {
        onDiagnostic: (d) => seen.push(d.code),
      });
      expect(diagnostics[0].code).toBe('invalid-stored-patch');
      expect(diagnostics[0].at).toEqual({ key: 'my-key' });
      expect(seen).toEqual(diagnostics.map((d) => d.code));
      expect(config.overrides('user')).toEqual([]);
      expect(config.resolve('ok', 'label').layer).toBe('site');
      config.set('user', 'ok', 'label', ['B']);
      expect(readPatch(storage.data.get('my-key')).ops.length).toBe(1);
    }
  });

  it('never throws for missing or failing storage', () => {
    const config = newConfig();
    expect(persistLayer(config, 'user', null).diagnostics[0].code).toBe(
      'no-storage'
    );
    const failing = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('full');
      },
      removeItem() {},
    };
    const { diagnostics } = persistLayer(config, 'session', failing);
    expect(diagnostics.map((d) => d.code)).toEqual(['storage-error']);
    config.set('session', 'ok', 'label', ['Go']);
    expect(diagnostics.map((d) => d.message)).toEqual([
      'Could not read link-ui.config.session.v1: denied',
      'Could not write link-ui.config.session.v1: full',
    ]);
    expect(config.resolve('ok', 'label').value).toEqual(['Go']);
  });

  it('stores only editable layers and finds the browser storages', () => {
    const config = newConfig();
    let error;
    try {
      persistLayer(config, 'site', memoryStorage());
    } catch (e) {
      error = e;
    }
    expect(error instanceof TypeError).toBe(true);
    const saved = {
      localStorage: globalThis.localStorage,
      sessionStorage: globalThis.sessionStorage,
    };
    const local = memoryStorage();
    const session = memoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: local,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: session,
      configurable: true,
    });
    try {
      persistUserLayer(config);
      persistSessionLayer(config);
      config.set('user', 'ok', 'label', ['U']);
      config.set('session', 'ok', 'label', ['S']);
      expect([...local.data.keys()]).toEqual([STORAGE_KEYS.user]);
      expect([...session.data.keys()]).toEqual([STORAGE_KEYS.session]);
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        Object.defineProperty(globalThis, name, { value, configurable: true });
      }
    }
  });
});
