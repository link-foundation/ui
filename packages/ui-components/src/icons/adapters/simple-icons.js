/** Optional Simple Icons adapter. Register with registerIconSet('brand', source). */
import {
  createAdapterSource,
  readPackageFile,
  thirdPartyRecord,
} from './shared.js';

export const SIMPLE_ICONS_TRADEMARK_NOTICE =
  'Simple Icons is distributed under CC0-1.0. Brand names and marks are trademarks of their respective owners; CC0 does not grant trademark rights. See the Simple Icons disclaimer and each brand’s guidelines.';

export const simpleIconsRecord = (name) => ({
  ...thirdPartyRecord({
    set: 'brand',
    name,
    title: 'Simple Icons',
    license: 'CC0-1.0',
    copyright: 'Simple Icons contributors',
    source: `https://simpleicons.org/?q=${encodeURIComponent(name)}`,
    notice:
      'https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md',
  }),
  attributionText: `Simple Icons "${name}" (CC0-1.0). ${SIMPLE_ICONS_TRADEMARK_NOTICE}`,
});

export const SIMPLE_ICONS = Object.freeze({
  set: 'brand',
  title: 'Simple Icons',
  packageName: 'simple-icons',
  names: Object.freeze({ github: 'github' }),
  defaults: { fill: 'currentColor' },
  loadSvg: (name) => readPackageFile(`simple-icons/icons/${name}.svg`),
  record: simpleIconsRecord,
  licenseFiles: ['LICENSE.md', 'DISCLAIMER.md'],
});

/** Missing/withdrawn marks are diagnosed by name; the registry supplies a placeholder. */
export const createSimpleIconsSource = (options) =>
  createAdapterSource(SIMPLE_ICONS, options);
