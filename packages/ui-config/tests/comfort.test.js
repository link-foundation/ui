import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '../src/index.js';

const makeConfig = () =>
  createConfig({
    document: parse(`app: document
  settings: group
  theme: theme
    token volume 0.5
    token color.primary blue
  title: text Hello
`),
    layers: {
      site: `base: overrides
  set settings sound.enabled false
  set settings sound.volume 0.5
  set settings accent blue
`,
    },
  });

const look = `shared: overrides
  layer session
  set settings sound.enabled true
  unset settings sound.volume
  set settings accent red
  set theme token volume 1
  set theme token color.primary red
  set title text Shared
`;

describe('viewer-owned configuration properties', () => {
  it('registers and discovers canonical targets without changing values or emitting events', () => {
    const config = makeConfig();
    const events = [];
    config.subscribe((batch) => events.push(batch));
    config.registerComfort('settings', 'sound.enabled');
    config.registerComfort('settings', 'sound.enabled');
    config.registerComfort('theme', 'token', 'volume');
    expect(config.isComfort('settings', 'sound.enabled')).toBe(true);
    expect(config.isComfort('settings', 'sound.volume')).toBe(false);
    expect(config.isComfort('missing', 'sound.enabled')).toBe(false);
    expect(config.isComfort('theme', 'token', 'color.primary')).toBe(false);
    expect(config.comfortProperties()).toEqual([
      { id: 'settings', name: 'sound.enabled', key: null, mode: 'prop' },
      { id: 'theme', name: 'token', key: 'volume', mode: 'keyed' },
    ]);
    const targets = config.comfortProperties();
    targets.pop();
    expect(config.comfortProperties().length).toBe(2);
    expect(events).toEqual([]);
    expect(config.overrides('user')).toEqual([]);
    expect(() => config.registerComfort('missing', 'volume')).toThrow();
    expect(() => config.registerComfort('theme', 'token')).toThrow();
    expect(makeConfig().comfortProperties()).toEqual([]);
  });

  it('keeps comfort set/unset values and lower-layer defaults when importing looks', () => {
    for (const layer of ['user', 'session']) {
      const config = makeConfig();
      config.registerComfort('settings', 'sound.enabled');
      config.registerComfort('settings', 'sound.volume');
      config.registerComfort('theme', 'token', 'volume');
      config.registerComfort('title', 'text');
      config.set(layer, 'settings', 'sound.volume', ['0.2']);
      const events = [];
      config.subscribe((batch) => events.push(batch));
      expect(config.importLook(look, layer).ok).toBe(true);
      expect(config.resolve('settings', 'sound.enabled').value).toEqual([
        'false',
      ]);
      expect(config.resolve('settings', 'sound.volume').value).toEqual(['0.2']);
      expect(config.resolve('theme', 'token', 'volume').value).toEqual(['0.5']);
      expect(config.resolve('title', 'text').value).toEqual(['Hello']);
      expect(config.resolve('settings', 'accent').value).toEqual(['red']);
      expect(events.length).toBe(1);
      expect(events[0].map((event) => event.name)).toEqual(['accent', 'token']);
      expect(config.importPatch(look, layer).ok).toBe(true);
      expect(config.resolve('settings', 'sound.enabled').value).toEqual([
        'true',
      ]);
      config.set(layer, 'settings', 'sound.enabled', ['false']);
      config.unset(layer, 'settings', 'sound.volume');
      expect(config.resolve('settings', 'sound.volume').value).toEqual(['0.5']);
    }
  });

  it('imports comfort-only looks without emitting changes and permits restoration', () => {
    const config = makeConfig();
    config.registerComfort('settings', 'sound.enabled');
    const events = [];
    config.subscribe((batch) => events.push(batch));
    const text = `look: overrides
  layer user
  set settings sound.enabled true
  unset settings sound.enabled
`;
    expect(config.importLook(text).ok).toBe(true);
    expect(events).toEqual([]);
    expect(
      config.loadLayer(
        'user',
        `saved: overrides
  set settings sound.enabled true
`
      ).ok
    ).toBe(true);
    expect(config.resolve('settings', 'sound.enabled').value).toEqual(['true']);
    config.clear('user');
    expect(config.resolve('settings', 'sound.enabled').value).toEqual([
      'false',
    ]);
  });

  it('validates the whole look before writing and uses its declared layer', () => {
    const config = makeConfig();
    expect(config.importLook(`${look}  set missing accent bad\n`).ok).toBe(
      false
    );
    expect(config.overrides('session')).toEqual([]);
    expect(config.importLook(look).ok).toBe(true);
    expect(config.resolve('settings', 'accent').layer).toBe('session');
    expect(
      config.importLook('x: overrides\n  set settings accent blue').ok
    ).toBe(false);
    expect(config.importLook('x: overrides\n  layer theme').ok).toBe(false);
  });
});
