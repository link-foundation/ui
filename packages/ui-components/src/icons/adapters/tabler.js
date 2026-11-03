/**
 * Tabler Icons (https://tabler.io/icons, MIT): the outline icons of the
 * official `@tabler/icons` npm package, an optional peer dependency.
 *
 *   import { registerIconSet } from '@link-foundation/ui-components';
 *   import { createTablerSource } from '@link-foundation/ui-components/icons/adapters/tabler';
 *   registerIconSet('tabler', createTablerSource());
 */

import {
  createAdapterSource,
  readPackageFile,
  thirdPartyRecord,
} from './shared.js';

/** @type {Readonly<Record<string, string>>} logical name → Tabler name */
export const TABLER_NAMES = Object.freeze({
  close: 'x',
  menu: 'menu-2',
  more: 'dots',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  check: 'check',
  plus: 'plus',
  minus: 'minus',
  search: 'search',
  settings: 'settings',
  reset: 'rotate',
  copy: 'copy',
  paste: 'clipboard',
  send: 'send',
  attach: 'paperclip',
  'drag-handle': 'grip-vertical',
  'dock-left': 'layout-sidebar',
  'dock-right': 'layout-sidebar-right',
  'dock-bottom': 'layout-bottombar',
  float: 'picture-in-picture',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
  fit: 'maximize',
  play: 'player-play',
  pause: 'player-pause',
  record: 'player-record',
  warning: 'alert-triangle',
  error: 'circle-x',
  info: 'info-circle',
  link: 'link',
});

/**
 * The asset record of a Tabler icon.
 * @param {string} name  a Tabler name
 */
export const tablerRecord = (name) =>
  thirdPartyRecord({
    set: 'tabler',
    name,
    title: 'Tabler Icons',
    license: 'MIT',
    copyright: 'Paweł Kuna',
    source: `https://tabler.io/icons/icon/${name}`,
    notice: 'https://github.com/tabler/tabler-icons/blob/main/LICENSE',
  });

/** @param {string} name */
export const loadTablerSvg = (name) =>
  readPackageFile(`@tabler/icons/outline/${name}.svg`);

/** @type {import('./shared.js').IconAdapter} */
export const TABLER = Object.freeze({
  set: 'tabler',
  title: 'Tabler Icons',
  packageName: '@tabler/icons',
  names: TABLER_NAMES,
  loadSvg: loadTablerSvg,
  record: tablerRecord,
  licenseFiles: ['LICENSE'],
});

/**
 * @param {import('./shared.js').AdapterOptions} [options]
 */
export const createTablerSource = (options) =>
  createAdapterSource(TABLER, options);
