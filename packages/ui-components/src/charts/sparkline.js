/**
 * The `<ui-sparkline>` element: a sparkline chart (`(id: sparkline ...)`) as SVG with
 * `role="img"`, an accessible name and a visually hidden data table twin.
 * The spec is an inline `<script type="text/lino">` child, the `lino` or
 * `spec` property, or the attributes ('label', 'values', 'mark', 'description').
 */

import { createSmallChartClass, defineElement } from './element.js';

/** The tag of the element. */
export const SPARKLINE_TAG = 'ui-sparkline';

/**
 * Define `<ui-sparkline>` in a window, unless the tag is taken.
 * @param {Window} [win]
 * @returns {CustomElementConstructor}
 */
export const defineSparklineElement = (win = globalThis.window) =>
  defineElement(win, SPARKLINE_TAG, (w) =>
    createSmallChartClass(w, {
      kind: 'sparkline',
      className: 'ui-sparkline',
      names: ['label', 'values', 'mark', 'description'],
      lists: ['values'],
      tag: 'span',
    })
  );
