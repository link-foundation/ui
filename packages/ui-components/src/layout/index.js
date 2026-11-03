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

import './stack.js';
import './grid.js';
import './split.js';
import './panel.js';
import './tab-group.js';
import './window.js';
import './dock.js';
import './app-shell.js';

export { updateFlex } from './stack.js';
export { areaList, isTrackAtom, trackList } from './grid.js';
export { sizesFromLino, sizesToLino, splitSizes } from './split.js';
export { activeTab } from './tab-group.js';
export { clampRect, viewportOf } from './window-frame.js';
export { windowController } from './window.js';
export { dockLayout } from './dock.js';
export {
  appShellMode,
  SHELL_BREAKPOINTS,
  SHELL_MODES,
  shellMode,
} from './app-shell.js';
