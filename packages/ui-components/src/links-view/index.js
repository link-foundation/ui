/**
 * Single link visualisation (`link-view`), from links-visuals: pure link
 * geometry, marker shapes shared by the SVG and Canvas renderers, zoom and
 * pan per element, and an animator that runs no frame while nothing moves.
 */

export {
  POINT_COUNT,
  DEFAULT_LOOP_RADIUS,
  linkGeometry,
  pointAtLength,
  angleAtLength,
  endAngles,
  cubicPoint,
  cubicDerivative,
  segmentLength,
  pathLength,
  catmullRomTangents,
  catmullRomToCubics,
  controlPoints,
  selfLoopPoints,
  pathBounds,
  pathToSvgD,
} from './geometry.js';
export {
  MARKERS,
  MARKER_IDS,
  MARKER_BOX,
  DEFAULT_ENDS,
  getMarker,
  markerElementId,
  svgMarkerDefs,
  drawMarker,
} from './markers.js';
export {
  LINK_TOKENS,
  COLOR_TOKENS,
  linkColors,
  colorVariables,
} from './tokens.js';
export {
  GRID_SPACING,
  STROKE_FRACTION,
  RADIUS_FRACTION,
  BLUEPRINT_DASH,
  buildScene,
  gridLines,
  visibleArea,
  sceneBounds,
  fitView,
} from './scene.js';
export { renderLinkSvg, drawnMarkers } from './render-svg.js';
export { drawLinkCanvas } from './render-canvas.js';
export { createZoomPan, wheelFactor, wheelDelta } from './zoom-pan.js';
export { createAnimator, prefersReducedMotion } from './animator.js';
export {
  FREE_END_MARKER,
  readLinkView,
  parseLinkView,
  accessibleName,
} from './model.js';
export {
  LINK_VIEW_TAG,
  LINK_VIEW_ATTRIBUTES,
  KEY_ZOOM_STEP,
  KEY_PAN_STEP,
  FALLBACK_SIZE,
  linkViewGeometry,
  defineLinkView,
  linkViewKind,
  registerLinkViewKind,
} from './link-view.js';
export {
  buildNetwork,
  networkIds,
  networkInput,
  networkEdges,
  networkNeighbours,
} from './network-model.js';
export {
  NETWORK_LAYOUTS,
  circle,
  grid,
  hex,
  spiral,
  force,
  layered,
} from './layouts/index.js';
export { createForceSimulation } from './layouts/force.js';
export { createLayoutRunner } from './create-layout-runner.js';
export { visibleLabels } from './labels.js';
export { networkToSvg, networkToPng, networkToRaster } from './export.js';
export {
  LINKS_NETWORK_TAG,
  defineLinksNetwork,
  linksNetworkKind,
  registerLinksNetworkKind,
} from './links-network.js';

export { networkVocabulary } from './network-vocabulary.js';

export { linoToNetwork, networkToLino } from './lino-to-network.js';
export { LINO_NETWORK_TAG, defineLinoNetwork } from './lino-network.js';

export { createNetworkPresentation } from './presentation.js';
export { createSolverJob, installSolverWorker } from './solver-job.js';
