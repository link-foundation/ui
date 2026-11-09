import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import {
  readSchema,
  defaults,
  applyPreset,
  applySharedLook,
  randomize,
} from '@link-foundation/ui-settings';
import { buildPanelModel } from '@link-foundation/ui-components/settings';
import { mountField } from '../../ui-components/src/settings/field-control.js';
import {
  createSoundSettingsSchema,
  generateSoundSettings,
  bindSoundConfig,
  createSoundPlayer,
} from '../src/index.js';
import { loadTheme, fakeAudio } from './helpers.js';

const key = 'sound.events.click.voice';
const visible = (schema, values) =>
  buildPanelModel(schema, values).sections.flatMap((s) =>
    s.fields.map((f) => f.key)
  );

describe('sound settings generator', () => {
  it('generates ordered conditional slots, global controls and valid nested LiNo', () => {
    const theme = loadTheme();
    theme.events.click.voices = ['tick'];
    const text = generateSoundSettings(theme, [
      { name: 'click', label: 'Click' },
    ]);
    const { schema, diagnostics } = readSchema(
      `settings: schema\n  version 1\n${text}`
    );
    expect(diagnostics).toEqual([]);
    const values = defaults(schema);
    expect(visible(schema, values).includes(`${key}2`)).toBe(true);
    expect(visible(schema, values).includes(`${key}3`)).toBe(false);
    expect(
      visible(schema, { ...values, [`${key}1`]: 'none' }).includes(`${key}2`)
    ).toBe(false);
    expect(
      visible(schema, { ...values, [`${key}2`]: 'tap' }).includes(`${key}3`)
    ).toBe(true);
    expect(
      visible(schema, { ...values, 'sound.reverb': 0 }).includes('sound.room')
    ).toBe(false);
    expect(
      visible(schema, { ...values, 'sound.stereo': false }).includes(
        'sound.width'
      )
    ).toBe(false);
    expect(schema.fields.get('sound.hoverGap').default).toBe(80);
    expect(schema.fields.get('sound.pitchSpread').max).toBe(100);
    expect([...schema.fields.values()].every((f) => f.comfort)).toBe(true);
  });
  it('preserves every generated key through presets, shared looks and randomizing', () => {
    const schema = createSoundSettingsSchema(loadTheme(), [
      'click',
      'consumer-only',
    ]);
    const values = defaults(schema);
    values['sound.events.click.voice1'] = 'tap';
    values['sound.volume'] = 0.7;
    schema.presets.set('other', {
      id: 'other',
      values: { 'sound.volume': 0.1 },
    });
    for (const result of [
      applyPreset(schema, values, 'other'),
      applySharedLook(schema, values, {}),
      randomize(schema, values, { random: () => 0.8 }),
    ]) {
      expect(result).toEqual(values);
    }
  });
  it('renders character labels while retaining stable voice names as option values', () => {
    const theme = loadTheme();
    theme.voices.tick.source.character = 'Soft tick';
    const schema = createSoundSettingsSchema(theme, ['click'], { slots: 2 });
    const { window } = new JSDOM('<!doctype html><div></div>');
    const field = schema.fields.get(`${key}1`);
    const host = window.document.querySelector('div');
    const control = mountField(host, field, 'tick', () => {}, 'voice');
    expect(host.textContent.includes('Soft tick')).toBe(true);
    control.destroy();
    window.close();
  });
  it('binds generated config to runtime including consumer-only events and opt-in boost', async () => {
    const theme = loadTheme();
    const schema = createSoundSettingsSchema(theme, ['click', 'custom'], {
      maxVolume: 2,
    });
    const config = bindSoundConfig(
      createConfig({ document: parse('settings: box') }),
      { schema }
    );
    const audio = fakeAudio();
    const player = createSoundPlayer({
      theme,
      config,
      maxVolume: 2,
      random: () => 0,
      hasBeenActive: () => true,
      createContext: () => audio,
    });
    config.set('sound.enabled', true);
    config.set('sound.volume', 2);
    config.set('sound.pitchSpread', 0);
    config.set('sound.tone', 'bright');
    config.set('sound.events.custom.voice1', 'tick');
    config.set('sound.events.custom.voice2', 'tap');
    expect(player.play('custom')).toEqual(['tick']);
    expect(player.volume).toBe(2);
    expect(
      audio.nodes.find((n) => n.kind === 'filter').gain.calls.at(-1)[1]
    ).toBe(5);
    config.set('sound.mode', 'layer');
    expect(player.play('custom')).toEqual(['tick', 'tap']);
    config.set('sound.events.custom.voice1', 'none');
    expect(player.play('custom')).toEqual([]);
    await player.dispose();
  });
});

it('supports a theme with no voices and reserved object property event names', async () => {
  const theme = loadTheme();
  theme.voices = Object.create(null);
  theme.events = Object.create(null);
  const schema = createSoundSettingsSchema(theme, ['constructor']);
  const { window } = new JSDOM('<!doctype html><div></div>');
  const field = schema.fields.get('sound.events.constructor.voice1');
  const control = mountField(
    window.document.querySelector('div'),
    field,
    'none',
    () => {},
    'empty'
  );
  expect(window.document.body.textContent.includes('None')).toBe(true);
  const player = createSoundPlayer({ theme });
  expect(player.play('toString')).toEqual([]);
  expect(player.play('constructor')).toEqual([]);
  await player.dispose();
  control.destroy();
  window.close();
});
