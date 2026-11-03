/**
 * The layout elements of ui-components: pure models (layer manager, split
 * and dock), the layout vocabulary and the ui-dom kinds (registered when
 * this module is imported).
 */

export { createLayerManager, LAYERS } from './layer-manager.js';
export {
  collapsePane,
  normalizeSizes,
  paneLimits,
  resizeSplit,
  restorePane,
  sum,
} from './split-model.js';
export {
  activatePanel,
  closePanel,
  dockLayoutFromLinks,
  dockLayoutFromNode,
  dockLayoutToLino,
  findPanel,
  FLOAT_DEFAULTS,
  floatPanel,
  movePanel,
  openPanelIds,
  panelIds,
  restorePanel,
  SIDES,
  updateRegion,
} from './dock-model.js';
export { LAYOUT_VOCABULARY_TEXT, layoutVocabulary } from './vocabulary.js';
