/**
 * Lucide (https://lucide.dev, ISC; icons derived from Feather are also
 * MIT): the icon data comes from the official `lucide` npm package, an
 * optional peer dependency.
 *
 *   import { registerIconSet } from '@link-foundation/ui-components';
 *   import { createLucideSource } from '@link-foundation/ui-components/icons/adapters/lucide';
 *   registerIconSet('lucide', createLucideSource());
 */

import { iconNodeToSvg } from '../svg.js';
import { createAdapterSource, thirdPartyRecord } from './shared.js';

const NOTICE = 'https://github.com/lucide-icons/lucide/blob/main/LICENSE';

/** @type {Readonly<Record<string, string>>} logical name → Lucide name */
export const LUCIDE_NAMES = Object.freeze({
  close: 'x',
  menu: 'menu',
  more: 'ellipsis',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  check: 'check',
  plus: 'plus',
  minus: 'minus',
  search: 'search',
  settings: 'settings',
  reset: 'rotate-ccw',
  copy: 'copy',
  paste: 'clipboard',
  send: 'send',
  attach: 'paperclip',
  'drag-handle': 'grip-vertical',
  'dock-left': 'panel-left',
  'dock-right': 'panel-right',
  'dock-bottom': 'panel-bottom',
  float: 'picture-in-picture-2',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
  fit: 'maximize',
  play: 'play',
  pause: 'pause',
  record: 'circle-dot',
  warning: 'triangle-alert',
  error: 'circle-x',
  info: 'info',
  link: 'link',
});

/**
 * The mapped Lucide icons that the Lucide LICENSE lists as derived from
 * Feather (MIT, Cole Bemis), under their current Lucide names
 * (`alert-triangle` is now `triangle-alert`). The icon tests check this
 * list against the LICENSE of the installed package.
 */
export const FEATHER_DERIVED = Object.freeze(
  new Set([
    'x',
    'ellipsis',
    'chevron-up',
    'chevron-down',
    'chevron-left',
    'chevron-right',
    'check',
    'plus',
    'minus',
    'search',
    'clipboard',
    'panel-left',
    'zoom-in',
    'zoom-out',
    'maximize',
    'triangle-alert',
    'circle-x',
    'info',
    'link',
  ])
);

/** The root attributes of every Lucide icon (lucide/dist/esm/defaultAttributes.mjs). */
export const LUCIDE_ATTRIBUTES = Object.freeze({
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
});

/**
 * The asset record of a Lucide icon.
 * @param {string} name  a Lucide name
 * @param {{featherDerived?: boolean}} [options]
 */
export function lucideRecord(
  name,
  { featherDerived = FEATHER_DERIVED.has(name) } = {}
) {
  return thirdPartyRecord({
    set: 'lucide',
    name,
    title: 'Lucide',
    license: featherDerived ? 'ISC AND MIT' : 'ISC',
    copyright: featherDerived
      ? 'Lucide Icons and Contributors; Cole Bemis'
      : 'Lucide Icons and Contributors',
    source: `https://lucide.dev/icons/${name}`,
    notice: NOTICE,
  });
}

/**
 * The SVG document of a Lucide icon, built from the icon node the
 * package exports (`lucide/dist/esm/icons/<name>.mjs`).
 * @param {string} name
 */
export async function loadLucideSvg(name) {
  const module = await import(`lucide/dist/esm/icons/${name}.mjs`);
  return iconNodeToSvg(module.default, LUCIDE_ATTRIBUTES);
}

/** @type {import('./shared.js').IconAdapter} */
export const LUCIDE = Object.freeze({
  set: 'lucide',
  title: 'Lucide',
  packageName: 'lucide',
  names: LUCIDE_NAMES,
  loadSvg: loadLucideSvg,
  record: (name) => lucideRecord(name),
  licenseFiles: ['LICENSE'],
});

/**
 * @param {import('./shared.js').AdapterOptions} [options]
 */
export const createLucideSource = (options) =>
  createAdapterSource(LUCIDE, options);
