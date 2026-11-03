/**
 * Material Symbols (https://fonts.google.com/icons, Apache-2.0): the
 * outlined weight-400 icons of the `@material-symbols/svg-400` npm
 * package, an optional peer dependency. Apache-2.0 asks for the licence
 * text and a notice of the changes to ship with the icons: the icon build
 * writes both to dist/icons/licenses/material-symbols/.
 *
 *   import { registerIconSet } from '@link-foundation/ui-components';
 *   import { createMaterialSymbolsSource } from '@link-foundation/ui-components/icons/adapters/material-symbols';
 *   registerIconSet('material-symbols', createMaterialSymbolsSource());
 */

import {
  createAdapterSource,
  readPackageFile,
  thirdPartyRecord,
} from './shared.js';

/** @type {Readonly<Record<string, string>>} logical name → Material name */
export const MATERIAL_SYMBOLS_NAMES = Object.freeze({
  close: 'close',
  menu: 'menu',
  more: 'more_horiz',
  'chevron-up': 'keyboard_arrow_up',
  'chevron-down': 'keyboard_arrow_down',
  'chevron-left': 'chevron_left',
  'chevron-right': 'chevron_right',
  check: 'check',
  plus: 'add',
  minus: 'remove',
  search: 'search',
  settings: 'settings',
  reset: 'restart_alt',
  copy: 'content_copy',
  paste: 'content_paste',
  send: 'send',
  attach: 'attach_file',
  'drag-handle': 'drag_indicator',
  // Material names the action: dock_to_right draws the panel on the left.
  'dock-left': 'dock_to_right',
  'dock-right': 'dock_to_left',
  'dock-bottom': 'dock_to_bottom',
  float: 'picture_in_picture',
  'zoom-in': 'zoom_in',
  'zoom-out': 'zoom_out',
  fit: 'fit_screen',
  play: 'play_arrow',
  pause: 'pause',
  record: 'fiber_manual_record',
  warning: 'warning',
  error: 'error',
  info: 'info',
  link: 'link',
});

/**
 * The NOTICE shipped with the Material Symbols icons. Upstream has no
 * NOTICE file; Apache-2.0 section 4 asks to keep the attribution and to
 * state the changes made to the files.
 */
export const MATERIAL_SYMBOLS_NOTICE = `Material Symbols
Copyright Google LLC

Licensed under the Apache License, Version 2.0 (see LICENSE in this
folder, or https://www.apache.org/licenses/LICENSE-2.0).

Source: https://github.com/google/material-design-icons
Package: @material-symbols/svg-400 (outlined)

Changes made by @link-foundation/ui-components: the SVG files were
optimised with SVGO, their width and height were removed, and their
colour was set to currentColor so that they follow the text colour.
`;

/**
 * The asset record of a Material Symbols icon.
 * @param {string} name  a Material Symbols name
 */
export const materialSymbolsRecord = (name) =>
  thirdPartyRecord({
    set: 'material-symbols',
    name,
    title: 'Material Symbols',
    license: 'Apache-2.0',
    copyright: 'Google LLC',
    source: `https://fonts.google.com/icons?selected=Material+Symbols+Outlined:${name}`,
    notice:
      'https://github.com/google/material-design-icons/blob/master/LICENSE',
  });

/** @param {string} name */
export const loadMaterialSymbolsSvg = (name) =>
  readPackageFile(`@material-symbols/svg-400/outlined/${name}.svg`);

/** @type {import('./shared.js').IconAdapter} */
export const MATERIAL_SYMBOLS = Object.freeze({
  set: 'material-symbols',
  title: 'Material Symbols',
  packageName: '@material-symbols/svg-400',
  names: MATERIAL_SYMBOLS_NAMES,
  loadSvg: loadMaterialSymbolsSvg,
  record: materialSymbolsRecord,
  licenseFiles: ['LICENSE'],
  notices: { NOTICE: MATERIAL_SYMBOLS_NOTICE },
  // Material Symbols paths have no fill: the SVG default is black.
  defaults: { fill: 'currentColor' },
});

/**
 * @param {import('./shared.js').AdapterOptions} [options]
 */
export const createMaterialSymbolsSource = (options) =>
  createAdapterSource(MATERIAL_SYMBOLS, options);
