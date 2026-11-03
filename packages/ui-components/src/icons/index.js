/**
 * Icons: the own CC0-1.0 set, the icon registry, the `ui-icon` element and
 * the `icon` kind of the ui-dom renderer. The adapters for Lucide, Tabler
 * and Material Symbols are separate entry points
 * (`@link-foundation/ui-components/icons/adapters/<set>`), so their
 * optional peer packages load only when used.
 */

export {
  PLACEHOLDER_ICON,
  createStaticSource,
  getIconSet,
  iconRecords,
  iconSets,
  onIconSetsChange,
  parseIconRef,
  registerIconSet,
  resolveIcon,
} from './icon-registry.js';
export { DEFAULT_ICON_SET, ICON_NAMES, MIRROR_IN_RTL } from './names.js';
export { iconNodeToSvg, iconToSvg, splitSvg } from './svg.js';
export {
  ICON_ATTRIBUTES,
  ICON_CSS,
  ICON_KIND_TEXT,
  ICON_TAG,
  defineIconElement,
  iconAttributes,
  iconVocabulary,
} from './icon.js';
