/**
 * config.exportPatch: diff-only patches of the editable layers.
 */

import { describe, it, expect } from 'test-anywhere';
import { createConfig, readPatch } from '@link-foundation/ui-config';
import { appDocument, errorCode, fixture, sample } from './helpers.js';

const opsOf = (text) => readPatch(text).ops;

describe('config.exportPatch', () => {
  it('reproduces the sample overrides patch', () => {
    const config = createConfig({ document: appDocument() });
    config.set('user', 'greeting', 'text', ['Hello, agents']);
    config.set('user', 'material3', 'token', ['#00639B'], 'color.primary');
    const text = config.exportPatch();
    expect(text).toBe(sample('overrides.lino'));
    expect(opsOf(text)).toEqual(opsOf(sample('overrides.lino')));
  });

  it('exports no set line for a user value equal to the site value', () => {
    const config = createConfig({ document: appDocument() });
    config.set('user', 'greeting', 'text', ['Hello, links']);
    config.set('user', 'material3', 'token', ['#6750A4'], 'color.primary');
    config.set('user', 'ok', 'label', ['OK']);
    const text = config.exportPatch();
    expect(text.includes('(set ')).toBe(false);
    expect(readPatch(text)).toEqual({
      name: 'user-overrides',
      layer: 'user',
      base: 'app',
      ops: [],
      diagnostics: [],
    });
  });

  it('compares with the layer given in `against`', () => {
    const config = createConfig({ document: appDocument() });
    config.loadLayer('site', fixture('site.lino'));
    config.set('user', 'ok', 'variant', ['filled']);
    expect(opsOf(config.exportPatch()).map((o) => o.values)).toEqual([
      ['filled'],
    ]);
    config.set('user', 'ok', 'variant', ['text']);
    expect(opsOf(config.exportPatch())).toEqual([]);
    config.clear('site');
    expect(opsOf(config.exportPatch()).map((o) => o.values)).toEqual([
      ['text'],
    ]);
    config.set('user', 'ok', 'variant', ['filled']);
    expect(opsOf(config.exportPatch({ against: 'defaults' })).length).toBe(1);
  });

  it('exports the session value over the user value, once', () => {
    const config = createConfig({ document: appDocument() });
    config.set('user', 'ok', 'label', ['Save']);
    config.set('session', 'ok', 'label', ['Send']);
    config.set('session', 'greeting', 'text', ['Hi']);
    expect(opsOf(config.exportPatch()).map((o) => [o.id, o.values])).toEqual([
      ['ok', ['Send']],
      ['greeting', ['Hi']],
    ]);
    const session = config.exportPatch({
      layers: ['session'],
      against: 'user',
      name: 'mine',
    });
    expect(readPatch(session).name).toBe('mine');
    expect(readPatch(session).layer).toBe('session');
    config.set('session', 'ok', 'label', ['Save']);
    expect(
      opsOf(config.exportPatch({ layers: ['session'], against: 'user' })).map(
        (o) => o.id
      )
    ).toEqual(['greeting']);
  });

  it('round-trips through importPatch', () => {
    const config = createConfig({ document: appDocument() });
    config.loadLayer('user', fixture('user.lino'));
    const copy = createConfig({ document: appDocument() });
    expect(copy.importPatch(config.exportPatch()).ok).toBe(true);
    expect(copy.overrides('user')).toEqual(
      config.overrides('user').filter((o) => o.values !== null)
    );
    expect(copy.exportPatch()).toBe(config.exportPatch());
  });

  it('checks the layer names', () => {
    const config = createConfig({ document: appDocument() });
    expect(errorCode(() => config.exportPatch({ layers: ['cloud'] }))).toBe(
      'unknown-layer'
    );
    expect(errorCode(() => config.exportPatch({ against: 'cloud' }))).toBe(
      'unknown-layer'
    );
  });
});
