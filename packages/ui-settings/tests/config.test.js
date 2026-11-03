import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';

import { bindConfig, defaults } from '../src/index.js';
import { demoSchema } from './helpers.js';

const schema = demoSchema();
const document = () =>
  parse(`(app: document
  (settings: group))`);

describe('bindConfig', () => {
  it('writes values as user overrides of the settings element', () => {
    const config = createConfig({ document: document() });
    const settings = bindConfig(config, schema);
    expect(settings.values()).toEqual(defaults(schema));
    settings.update({ 'liquid.blur': 24, accent: '#000000', evil: 1 });
    expect(config.resolve('settings', 'liquid.blur')).toEqual({
      layer: 'user',
      value: ['24'],
    });
    expect(settings.get('liquid.blur')).toBe(24);
    expect(config.exportPatch()).toBe(`user-overrides: overrides
  layer user
  base app
  set settings liquid.blur 24
  set settings accent '#000000'
`);
  });

  it('sends one change per update and unsets values equal to the layer below', () => {
    const config = createConfig({ document: document() });
    const settings = bindConfig(config, schema);
    const calls = [];
    settings.subscribe((values) => calls.push(values));
    settings.update({ 'liquid.blur': 24, 'theme.mode': 'dark' });
    expect(calls.length).toBe(1);
    expect(calls[0]['theme.mode']).toBe('dark');
    settings.set('liquid.blur', 18);
    expect(config.overrides('user').map((o) => o.name)).toEqual(['theme.mode']);
    settings.reset();
    expect(config.overrides('user')).toEqual([]);
    expect(calls.length).toBe(3);
  });

  it('reads the layers below and ignores invalid overrides', () => {
    const config = createConfig({
      document: document(),
      layers: {
        theme: `(t: overrides (layer theme) (set settings liquid.blur 30))`,
      },
    });
    const settings = bindConfig(config, schema);
    expect(settings.get('liquid.blur')).toBe(30);
    config.set('user', 'settings', 'theme.mode', ['sepia']);
    expect(settings.get('theme.mode')).toBe('auto');
    settings.set('liquid.blur', 30);
    expect(config.valueIn('user', 'settings', 'liquid.blur')).toBeUndefined();
  });

  it('throws when the document has no target element', () => {
    const config = createConfig({ document: document() });
    expect(() => bindConfig(config, schema, { target: 'nope' })).toThrow();
  });
});
