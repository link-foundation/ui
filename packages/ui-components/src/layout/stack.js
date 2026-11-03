/**
 * `stack`: a thin wrapper of CSS flexbox. It replaces the basic stack of
 * ui-dom and accepts the same values, plus `row`/`column` (and their
 * `-reverse` forms), `justify` and `wrap`.
 *
 *   (toolbar: stack (direction row) (gap 8px) (align center)
 *     (justify space-between) (wrap true) ...)
 */

import { defineKind } from '@link-foundation/ui-dom';
import { atomOf, setTypedStyle } from './dom.js';

const DIRECTIONS = {
  vertical: 'column',
  horizontal: 'row',
  row: 'row',
  column: 'column',
  'row-reverse': 'row-reverse',
  'column-reverse': 'column-reverse',
};

const ALIGN = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
};

const WRAP = { true: 'wrap', false: 'nowrap', reverse: 'wrap-reverse' };

/** The CSS property of each enum property and its values. */
const FLEX = [
  ['direction', 'flex-direction', DIRECTIONS],
  ['align', 'align-items', ALIGN],
  ['justify', 'justify-content', JUSTIFY],
  ['wrap', 'flex-wrap', WRAP],
];

/** Set an enum property as CSS; an unknown value is reported. */
function setEnum(node, el, [name, css, map], ctx) {
  const value = atomOf(el, name);
  if (value === undefined) {
    node.style.removeProperty(css);
  } else if (Object.hasOwn(map, value)) {
    node.style.setProperty(css, map[value]);
  } else {
    node.style.removeProperty(css);
    ctx.diagnostic('invalid-value', 'error', { property: name });
  }
}

/** Write the flexbox properties of the element that changed. */
export function updateFlex(node, el, changed, ctx) {
  for (const entry of FLEX) {
    if (changed.includes(entry[0])) {
      setEnum(node, el, entry, ctx);
    }
  }
  for (const name of ['gap', 'padding']) {
    if (changed.includes(name)) {
      setTypedStyle(node, el, name, ctx);
    }
  }
}

defineKind('stack', {
  tag: 'ui-stack',
  attributes: {
    direction: 'string',
    align: 'string',
    justify: 'string',
    wrap: 'string',
  },
  create: (el, ctx) => ctx.document.createElement('ui-stack'),
  update: updateFlex,
});
