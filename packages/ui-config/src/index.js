/**
 * @link-foundation/ui-config: every property of a UI document resolved
 * through the configuration layers defaults < theme < site < user < session,
 * with overrides read and written as Links Notation `overrides` patches.
 */

export { createConfig } from './config.js';
export {
  LAYERS,
  EDITABLE_LAYERS,
  DEFAULT_KEYED_PROPS,
  DOCUMENT_LAYER,
  KEY_SEPARATOR,
  overrideKey,
} from './layers.js';
export {
  readPatch,
  writePatch,
  DEFAULT_MAX_PATCH_SIZE,
  DEFAULT_MAX_PATCH_OPS,
  PATCH_KIND,
} from './patch.js';
export { describeChanges } from './explain.js';
export {
  persistLayer,
  persistUserLayer,
  persistSessionLayer,
  STORAGE_KEYS,
} from './storage.js';
export { bindStore, CONFIG_ORIGIN } from './bind-store.js';
export { ConfigError } from './errors.js';
