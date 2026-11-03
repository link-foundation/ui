/**
 * `grid`: a thin wrapper of CSS grid.
 *
 *   (page: grid (columns 16rem 1fr) (rows auto 1fr auto) (gap 8px)
 *     (areas 'nav header' 'nav main' 'nav footer')
 *     (header: text ...) (nav: stack ...) (main: stack ...) ...)
 *
 * `columns` and `rows` are track lists: lengths, `fr`, `auto`,
 * `min-content`, `max-content` and the functions `(repeat N TRACK...)`,
 * `(minmax MIN MAX)` and `(fit-content LENGTH)`. A single number `N`
 * means N equal columns. `areas` are the rows of `grid-template-areas`; a
 * child whose id names an area is placed in it. Every value is checked
 * token by token: a value that is not a track is reported and left out,
 * so no other CSS can be written through them.
 */

import { defineKind } from '@link-foundation/ui-dom';
import {
  controllerOf,
  dropController,
  isLive,
  linkId,
  renderedChildren,
  setTypedStyle,
  watchChildren,
} from './dom.js';

const KEYWORDS = new Set([
  'auto',
  'min-content',
  'max-content',
  'auto-fill',
  'auto-fit',
  'none',
]);
const UNITS = ['px', 'rem', 'em', '%', 'fr', 'vw', 'vh', 'ch', 'dvh', 'dvw'];
const FUNCTIONS = { repeat: 2, minmax: 2, 'fit-content': 1 };

/** Whether a text is a plain number (`12`, `0.5`). */
function isNumber(text) {
  return text !== '' && Number.isFinite(Number(text)) && !text.includes('e');
}

/** Whether a text is a length, a flex factor or a keyword (one track). */
export function isTrackAtom(text) {
  if (KEYWORDS.has(text) || text === '0') {
    return true;
  }
  const unit = UNITS.find((u) => text.endsWith(u));
  return (
    unit !== undefined &&
    isNumber(text.slice(0, -unit.length).trim()) &&
    !text.startsWith('-')
  );
}

/** The CSS of one track (`null` when it is not one). */
function trackCss(value) {
  if (typeof value === 'string') {
    return isTrackAtom(value) ? value : null;
  }
  if (!Array.isArray(value) || typeof value[0] !== 'string') {
    return null;
  }
  const [head, ...args] = value;
  if (!Object.hasOwn(FUNCTIONS, head) || args.length < FUNCTIONS[head]) {
    return null;
  }
  const first =
    head === 'repeat' && (isNumber(args[0]) || KEYWORDS.has(args[0]))
      ? args[0]
      : trackCss(args[0]);
  const rest = args.slice(1).map(trackCss);
  if (first === null || rest.includes(null)) {
    return null;
  }
  return rest.length === 0
    ? `${head}(${first})`
    : `${head}(${first}, ${rest.join(' ')})`;
}

/**
 * The CSS track list of `columns` or `rows`: `null` when a value is not a
 * track, `undefined` when the property is missing.
 */
export function trackList(raws) {
  if (raws === undefined || raws.length === 0) {
    return undefined;
  }
  if (raws.length === 1 && typeof raws[0] === 'string' && isNumber(raws[0])) {
    const count = Number(raws[0]);
    return Number.isInteger(count) && count > 0
      ? `repeat(${count}, minmax(0, 1fr))`
      : null;
  }
  const tracks = raws.map(trackCss);
  return tracks.includes(null) ? null : tracks.join(' ');
}

const isAreaName = (name) =>
  name === '.' ||
  [...name].every(
    (c) =>
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c === '-' ||
      c === '_'
  );

/**
 * The areas of the grid: `{ css, names }`, or `null` when a row has a
 * name that is not an area name or rows of different lengths.
 */
export function areaList(raws) {
  if (raws === undefined || raws.length === 0) {
    return undefined;
  }
  const rows = raws.map((row) =>
    typeof row === 'string' ? row.split(' ').filter((n) => n !== '') : null
  );
  if (
    rows.includes(null) ||
    rows.some((row) => row.length !== rows[0].length || !row.every(isAreaName))
  ) {
    return null;
  }
  const names = new Set(rows.flat().filter((n) => n !== '.'));
  return { css: rows.map((row) => `"${row.join(' ')}"`).join(' '), names };
}

/** Set a template property; a bad value is reported and left out. */
function setTemplate(node, css, property, value, ctx) {
  if (value === null) {
    ctx.diagnostic('invalid-value', 'error', { property });
  }
  if (value === null || value === undefined) {
    node.style.removeProperty(css);
  } else {
    node.style.setProperty(css, value);
  }
}

/** Place the children named after an area in it. */
function placeChildren(node, names) {
  for (const child of renderedChildren(node)) {
    if (names.has(linkId(child))) {
      child.style.setProperty('grid-area', linkId(child));
    } else if (child.hasAttribute('data-grid-area')) {
      child.style.removeProperty('grid-area');
    }
    child.toggleAttribute('data-grid-area', names.has(linkId(child)));
  }
}

const areaNames = new WeakMap();

defineKind('grid', {
  tag: 'ui-grid',
  create: (el, ctx) => ctx.document.createElement('ui-grid'),
  update(node, el, changed, ctx) {
    if (changed.includes('columns')) {
      const value = trackList(el.props.get('columns'));
      setTemplate(node, 'grid-template-columns', 'columns', value, ctx);
    }
    if (changed.includes('rows')) {
      const value = trackList(el.props.get('rows'));
      setTemplate(node, 'grid-template-rows', 'rows', value, ctx);
    }
    if (changed.includes('areas')) {
      const areas = areaList(el.props.get('areas'));
      const css = areas === null ? null : areas?.css;
      setTemplate(node, 'grid-template-areas', 'areas', css, ctx);
      areaNames.set(node, areas?.names ?? new Set());
    }
    for (const name of ['gap', 'padding']) {
      if (changed.includes(name)) {
        setTypedStyle(node, el, name, ctx);
      }
    }
    if (isLive(ctx)) {
      const refresh = () => placeChildren(node, areaNames.get(node));
      controllerOf(node, () => watchChildren(node, refresh));
      refresh();
    }
  },
  destroy: (node) => dropController(node),
});
