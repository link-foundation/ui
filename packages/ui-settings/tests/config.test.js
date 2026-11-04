import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';

import { bindConfig, defaults, readSchema } from '../src/index.js';
import { SOUND_SETTINGS_LINO } from '../../ui-sound/src/comfort.js';
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

it('registers schema comfort flags at the bound target and keeps ordinary editing', () => {
  const config = createConfig({ document: document() });
  const settings = bindConfig(config, schema);
  const expected = [...schema.fields.values()]
    .filter((field) => field.comfort)
    .map((field) => field.key);
  expect(config.comfortProperties().map((property) => property.name)).toEqual(
    expected
  );
  settings.set('motion.reduce', true);
  expect(
    config.importLook(`look: overrides
  layer session
  set settings motion.reduce false
  set settings liquid.blur 24
`).ok
  ).toBe(true);
  expect(settings.get('motion.reduce')).toBe(true);
  expect(settings.get('liquid.blur')).toBe(24);
  settings.reset(['motion.reduce']);
  expect(settings.get('motion.reduce')).toBe(false);
});

it('discovers sound comfort from the schema at a custom target', () => {
  const config = createConfig({ document: parse('preferences: group') });
  const { schema: sound } = readSchema(SOUND_SETTINGS_LINO);
  const settings = bindConfig(config, sound, {
    target: 'preferences',
    layer: 'session',
  });
  expect(config.comfortProperties().map(({ id, name }) => [id, name])).toEqual([
    ['preferences', 'sound.enabled'],
    ['preferences', 'sound.volume'],
  ]);
  settings.update({ 'sound.enabled': true, 'sound.volume': 0.2 });
  config.importLook(`look: overrides
  layer session
  set preferences sound.enabled false
  set preferences sound.volume 1
`);
  expect(settings.values()).toEqual({
    'sound.enabled': true,
    'sound.volume': 0.2,
  });
  settings.set('sound.volume', 0.3);
  expect(settings.get('sound.volume')).toBe(0.3);
});
