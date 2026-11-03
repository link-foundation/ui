/**
 * The `<ui-gauge>` element: a gauge chart (`(id: gauge ...)`) as SVG with
 * `role="img"`, an accessible name and a visually hidden data table twin.
 * The spec is an inline `<script type="text/lino">` child, the `lino` or
 * `spec` property, or the attributes ('label', 'value', 'min', 'max', 'unit', 'description').
 */

import { createSmallChartClass, defineElement } from './element.js';

/** The tag of the element. */
export const GAUGE_TAG = 'ui-gauge';

/**
 * Define `<ui-gauge>` in a window, unless the tag is taken.
 * @param {Window} [win]
 * @returns {CustomElementConstructor}
 */
export const defineGaugeElement = (win = globalThis.window) =>
  defineElement(win, GAUGE_TAG, (w) =>
    createSmallChartClass(w, {
      kind: 'gauge',
      className: 'ui-gauge',
      names: ['label', 'value', 'min', 'max', 'unit', 'description'],
      lists: [],
      tag: 'div',
    })
  );
