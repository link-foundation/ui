/**
 * The `<ui-stat-tile>` element: a stat-tile chart (`(id: stat-tile ...)`) as SVG with
 * `role="img"`, an accessible name and a visually hidden data table twin.
 * The spec is an inline `<script type="text/lino">` child, the `lino` or
 * `spec` property, or the attributes ('label', 'value', 'unit', 'delta', 'trend', 'description').
 */

import { createSmallChartClass, defineElement } from './element.js';

/** The tag of the element. */
export const STAT_TILE_TAG = 'ui-stat-tile';

/**
 * Define `<ui-stat-tile>` in a window, unless the tag is taken.
 * @param {Window} [win]
 * @returns {CustomElementConstructor}
 */
export const defineStatTileElement = (win = globalThis.window) =>
  defineElement(win, STAT_TILE_TAG, (w) =>
    createSmallChartClass(w, {
      kind: 'stat-tile',
      className: 'ui-stat-tile',
      names: ['label', 'value', 'unit', 'delta', 'trend', 'description'],
      lists: ['trend'],
      tag: 'div',
    })
  );
