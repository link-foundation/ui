/** Shipped themes remain LiNo data, loaded in browsers or Node without a build. */
import { readThemeFile } from './mapping.js';
import { FLUENT_FILES } from './fluent2/names.js';
export { fluentThemeFromBrand, fluentBrandRamp } from './fluent2/brand.js';
export { loadMapping, mappingMarkdown } from './mapping.js';
export { readMapping } from './mapping.js';
export { getMuiMapping } from './material3/mapping.js';
export { materialThemeFromSeed } from './material3/seed.js';
export { muiThemeToLino } from './material3/mui.js';
import { classicThemes } from './classic/catalog.js';
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';

export function listThemes() {
  return [
    'base',
    'material3',
    'fluent2',
    'hig',
    'hig-ios',
    'hig-macos',
    ...classicThemes.map((t) => t.id),
  ];
}

// Share source reads within one runtime, while resolving a fresh theme per caller.
let registryPromise;
async function registry() {
  const paths = [
    'base/theme.lino',
    ...FLUENT_FILES.map((name) => `fluent2/${name}.lino`),
    ...[
      'colors',
      'type',
      'shape',
      'elevation',
      'motion',
      'styles',
      'templates',
      'theme',
    ].map((name) => `material3/${name}.lino`),
    ...[
      'colors',
      'type',
      'shape',
      'spacing',
      'motion',
      'materials',
      'styles',
      'templates',
      'theme',
    ].map((name) => `hig/${name}.lino`),
    'hig-ios/theme.lino',
    'hig-macos/theme.lino',
    ...new Set(classicThemes.map((t) => t.path)),
  ];
  const texts = await Promise.all(paths.map(readThemeFile));
  const { themes, diagnostics } = loadThemes(texts.join('\n'));
  if (diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(diagnostics.map((d) => d.message).join('; '));
  }
  return new Map(themes.map((t) => [t.id, t]));
}
/** @param {string} id @returns {Promise<import('@link-foundation/ui-tokens/themes').Theme>} */
export async function loadTheme(id) {
  if (!listThemes().includes(id)) {
    throw new RangeError(`Unknown theme: ${id}`);
  }
  registryPromise ??= registry().catch((error) => {
    registryPromise = undefined;
    throw error;
  });
  return resolveTheme(await registryPromise, id);
}

/** SwiftUI view/modifier rows in the shared mapping format. */
export async function getSwiftuiMapping() {
  const { readMapping } = await import('./mapping.js');
  return readMapping(await readThemeFile('hig/swiftui-mapping.lino'));
}
