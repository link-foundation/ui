import { SOUND_GLOBAL_KEYS } from './settings.js';
import { readSchema, bindConfig } from '@link-foundation/ui-settings';

/** Register these comfort fields in the application's settings schema. */
export const SOUND_SETTINGS_LINO = `sound-settings: schema
  version 1
sound.enabled:
  type toggle
  default false
  (comfort)
sound.volume:
  type range
  default 0.5
  min 0
  max 1
  step 0.01
  (comfort)
`;
export const SOUND_COMFORT_KEYS = Object.freeze([
  'sound.enabled',
  'sound.volume',
  ...SOUND_GLOBAL_KEYS,
]);
export const soundSettingsSchema = () => readSchema(SOUND_SETTINGS_LINO).schema;

/** A ui-config settings element, using the existing #18 user layer. */
export function bindSoundConfig(
  config,
  { target = 'settings', schema = soundSettingsSchema() } = {}
) {
  return Object.assign(bindConfig(config, schema, { target, layer: 'user' }), {
    schema,
  });
}
