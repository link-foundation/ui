/**
 * @link-foundation/ui-settings: settings schemas written in Links Notation,
 * with validation, presets, randomised looks, migrations, diff-only values
 * documents and share links.
 */

export { readSchema, fieldsOf } from './schema.js';
export {
  defineFieldType,
  fieldType,
  fieldTypes,
  BUILT_IN_TYPES,
} from './types.js';
export { coerce, equalValue, formatValue, cssValue } from './coerce.js';
export {
  defaults,
  merge,
  diff,
  isDefault,
  reset,
  countCustomized,
  equalValues,
} from './values.js';
export { applyPreset, activePreset, applySharedLook } from './presets.js';
export { randomize } from './random.js';
export { migrate } from './migrate.js';
export {
  toLino,
  fromLino,
  fromLegacyJson,
  toShareHash,
  fromShareHash,
  MAX_SHARE_HASH,
  SHARE_PARAM,
  LEGACY_SHARE_PARAM,
} from './codec.js';
export {
  applyToRoot,
  paintSnapshot,
  beforePaintScript,
  beforePaintScriptHash,
  attributeName,
  PAINT_STORAGE_KEY,
} from './dom.js';
export { assertEverySettingUsed } from './testing.js';
export { bindConfig } from './config.js';
