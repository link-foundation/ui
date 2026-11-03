import { formatLinks, values } from '@link-foundation/ui-core';

const record = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const kebab = (text) => text.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);

/**
 * Convert plain createTheme options without importing MUI. Unmapped paths
 * include unsupported values as well as unknown leaf fields (empty objects too).
 * @param {object} themeOptions
 * @param {{id?: string}} [options]
 * @returns {{lino: string, unmapped: string[]}}
 */
export function muiThemeToLino(themeOptions, options = {}) {
  if (!record(themeOptions)) {
    throw new TypeError('Expected a plain theme options object');
  }
  const tokens = [],
    unmapped = [];
  const add = (path, value, type) =>
    tokens.push([
      'token',
      path,
      String(value),
      ...(type ? [['type', type]] : []),
    ]);
  let dark = false;
  const convertColor = (path, value) => {
    const palette =
      /^palette\.(primary|secondary|error|warning|info|success)\.(main|contrastText)$/u.exec(
        path
      );
    if (
      palette &&
      typeof value === 'string' &&
      values.parseColor(value) !== null
    ) {
      add(
        `color.${palette[2] === 'contrastText' ? 'on-' : ''}${palette[1]}`,
        value
      );
      return true;
    }
    const colors = {
      'palette.background.default': 'background',
      'palette.background.paper': 'surface',
      'palette.text.primary': 'on-surface',
      'palette.text.secondary': 'on-surface-variant',
    };
    if (
      Object.hasOwn(colors, path) &&
      typeof value === 'string' &&
      values.parseColor(value) !== null
    ) {
      add(`color.${colors[path]}`, value);
      return true;
    }
    return false;
  };
  const convert = (path, value) => {
    if (path === 'palette.mode' && ['light', 'dark'].includes(value)) {
      dark = value === 'dark';
      return true;
    }
    if (convertColor(path, value)) {
      return true;
    }
    if (['shape.borderRadius', 'spacing'].includes(path) && finite(value)) {
      add(
        path === 'spacing' ? 'space.unit' : 'shape.corner.small',
        `${value}px`
      );
      return true;
    }
    if (path === 'typography.fontFamily' && typeof value === 'string') {
      add('type.font-family', value, 'fontFamily');
      return true;
    }
    if (
      path.startsWith('breakpoints.values.') &&
      path.split('.').length === 3 &&
      finite(value)
    ) {
      add(`breakpoint.${kebab(path.split('.')[2])}`, `${value}px`);
      return true;
    }
    if (
      path.startsWith('transitions.duration.') &&
      path.split('.').length === 3 &&
      finite(value)
    ) {
      add(`motion.duration.${kebab(path.split('.')[2])}`, `${value}ms`);
      return true;
    }
    return false;
  };
  const visit = (value, path) => {
    if (convert(path, value)) {
      return;
    }
    if (record(value) && Object.keys(value).length) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    } else if (path) {
      unmapped.push(path);
    }
  };
  visit(themeOptions, '');
  // Palette colors belong to the MUI options object's selected scheme.
  const body = dark ? [['mode', 'dark', ...tokens]] : tokens;
  return {
    lino: formatLinks([
      {
        id: options.id ?? 'mui-import',
        values: [
          'theme',
          ['extends', 'material3'],
          ['scheme', dark ? 'dark' : 'light'],
          ...body,
        ],
      },
    ]),
    unmapped: unmapped.sort(),
  };
}
