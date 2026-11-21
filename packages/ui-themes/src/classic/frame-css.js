import { FRAME_EDGES, FRAME_LEVELS, resolveFrame } from './frame-schema.js';
import {
  geometryDeclarations,
  POINTS,
  IDS,
  rule,
} from './frame-css-geometry.js';
import { createCssContext } from './frame-css-controls.js';
import { frameValues } from './frame-css-values.js';
import { stateCss } from './frame-css-states.js';

const validSelector = (s) =>
  typeof s === 'string' && s.length > 0 && !/[{};]/u.test(s);
function validateOptions({
  prefix,
  scope,
  boundaryAttribute,
  levels,
  selected,
}) {
  if (!/^[a-zA-Z][\w-]*$/u.test(prefix) || !validSelector(scope)) {
    throw new TypeError('Invalid frame scope or prefix');
  }
  if (boundaryAttribute && !/^data-[\w-]+$/u.test(boundaryAttribute)) {
    throw new TypeError('Invalid frame boundary attribute');
  }
  for (const [level, selectors] of Object.entries(levels)) {
    if (
      !FRAME_LEVELS.includes(level) ||
      !Array.isArray(selectors) ||
      !selectors.length ||
      !selectors.every(validSelector)
    ) {
      throw new TypeError(`Invalid frame selectors: ${level}`);
    }
  }
  if (
    selected &&
    (!Array.isArray(selected) ||
      !selected.length ||
      !selected.every(validSelector))
  ) {
    throw new TypeError('Invalid selected selectors');
  }
}
/** Static decoration markup, inserted before content in a transparent host.
 * The separate size containers preserve intrinsic host layout and stacking. */
export function frameLayers() {
  const material =
    '<span data-frame-paint data-frame-surface aria-hidden="true"><span data-frame-material></span></span>';
  const corners = IDS.map(
    (id) => `<span data-frame-corner="${id}"></span>`
  ).join('');
  const edges = FRAME_EDGES.map(
    (id) => `<span data-frame-edge="${id}"></span>`
  ).join('');
  return `${material}<span data-frame-paint data-frame-strokes aria-hidden="true">${corners}${edges}</span>`;
}
function baseCss(prefix, geometry) {
  return (
    rule('[data-frame-paint]', [
      ['position', 'absolute'],
      ['inset', '0'],
      ['container-type', 'size'],
      ['pointer-events', 'none'],
    ]) +
    rule('[data-frame-surface]', [['z-index', '-1']]) +
    rule('[data-frame-strokes]', [
      ['z-index', `var(--${prefix}-stacking, 2)`],
    ]) +
    rule('[data-frame-paint] > *', [
      ['position', 'absolute'],
      ['inset', '0'],
      ['pointer-events', 'none'],
    ]) +
    rule('[data-frame-material]', [
      ['background', 'var(--frame-material, transparent)'],
    ]) +
    rule(':where([data-frame-paint] ~ :not([data-frame-paint]))', [
      ['position', 'relative'],
      ['z-index', '1'],
    ]) +
    rule('[data-frame-paint] > *', Object.entries(geometry.fit)) +
    rule('[data-frame-material]', Object.entries(geometry.material)) +
    partCss('corner', geometry.corners) +
    partCss('edge', geometry.edges)
  );
}
function partCss(name, parts) {
  return Object.entries(parts)
    .map(([id, values]) =>
      rule(`[data-frame-${name}='${id}']`, Object.entries(values))
    )
    .join('');
}
function geometryAliases(ctx, level) {
  const keys = ['opacity', 'layer', 'threshold', 'border'];
  for (const id of IDS) {
    keys.push(
      ...[
        'w',
        'h',
        'stroke',
        'color',
        'visible',
        'gap',
        'extension',
        'paint',
      ].map((key) => `${id}-${key}`)
    );
    for (let i = 0; i <= POINTS; i++) {
      keys.push(`${id}-x${i}`, `${id}-y${i}`);
    }
  }
  for (const side of FRAME_EDGES) {
    keys.push(
      ...[
        'stroke',
        'color',
        'visible',
        'image',
        'mask',
        'across',
        'inset-start',
        'inset-end',
      ].map((key) => `${side}-${key}`)
    );
  }
  return keys.map((key) => {
    const name = `--${ctx.prefix}-g-${key}`;
    const inherited = ctx.registrations.get(ctx.prop(level, key));
    const numeric =
      ['opacity', 'layer', 'threshold', 'border'].includes(key) ||
      /-(?:visible|[xy]\d+)$/u.test(key);
    const color = /-(?:paint|color)$/u.test(key);
    const image = /-(?:image|mask)$/u.test(key);
    const syntax =
      inherited?.syntax ??
      (image
        ? '<image> | none'
        : color
          ? '<color>'
          : numeric
            ? '<number>'
            : '<length>');
    const initial =
      inherited?.initial ??
      (image ? 'none' : color ? 'black' : numeric ? '0' : '0px');
    if (!key.endsWith('-image') && !key.endsWith('-across')) {
      ctx.register(name, syntax, initial, false);
    }
    return [name, ctx.variable(level, key)];
  });
}
function levelCss(ctx, level, selectors, aliases) {
  const hosts = selectors.map((s) => `:where(${s})`);
  const target = (suffix = '') =>
    hosts
      .map(
        (s) => `${s}${suffix}${ctx.paint ? ' > [data-frame-paint] > *' : ''}`
      )
      .join(', ');
  let css = '';
  if (ctx.paint) {
    css = rule(hosts.join(', '), [
      ['position', 'relative'],
      ['isolation', 'isolate'],
      [`--${ctx.prefix}-stacking`, ctx.variable(level, 'layer')],
    ]);
    css += rule(target(), Object.entries(aliases));
  }
  css += stateCss(ctx, level, hosts);
  return {
    css,
    fit: rule(target(`[data-${ctx.prefix}-fit='outside']`), [
      [
        ctx.paint
          ? `--${ctx.prefix}-g-threshold`
          : ctx.prop(level, 'threshold'),
        ctx.variable(level, 'fitScale'),
      ],
    ]),
  };
}
function nestedCss(ctx, levels, blockAliases) {
  if (!levels.panel || !blockAliases) {
    return { css: '', fit: '' };
  }
  const panel = `:is(${levels.panel.join(', ')})`;
  const chunk = levelCss(
    ctx,
    'block',
    [`:scope ${panel} ${panel}`, `:scope${panel} ${panel}`],
    blockAliases
  );
  const boundary = ctx.boundaryAttribute ? `[${ctx.boundaryAttribute}]` : null;
  const wrap = (rules) =>
    !boundary
      ? `@scope (${ctx.scope}) {\n${rules}}\n`
      : `@scope (${ctx.scope}) to (${boundary}) {\n${rules}}\n@scope (${boundary}) to (${boundary}) {\n${rules}}\n`;
  return { css: wrap(chunk.css), fit: wrap(chunk.fit) };
}
/** Deterministic build-time CSS. Load properties, base, levels, fit in order.
 * @param {Map<string, import('./frames.js').FrameDefinition>} frames
 * @param {import('./frames.js').FramesCssOptions} [options]
 */
export function framesCss(frames, options = {}) {
  const config = {
    prefix: 'frame',
    scope: ':root',
    paint: true,
    ...options,
    levels:
      options.levels ??
      Object.fromEntries(
        [...frames.keys()].map((id) => [id, [`[data-frame='${id}']`]])
      ),
  };
  validateOptions(config);
  const ctx = createCssContext(frames, config);
  const levels = {};
  const geometry = { ...geometryDeclarations(ctx.prefix), levels: {} };
  let fit = '';
  for (const level of frames.keys()) {
    const frame = resolveFrame(frames, level);
    levels[level] = rule(
      `:where(${ctx.scope})`,
      frameValues(ctx, level, frame)
    );
    geometry.levels[level] = Object.fromEntries(geometryAliases(ctx, level));
    if (config.levels[level]) {
      const chunk = levelCss(
        ctx,
        level,
        config.levels[level],
        geometry.levels[level]
      );
      levels[level] += chunk.css;
      fit += chunk.fit;
    }
  }
  const nested = nestedCss(ctx, config.levels, geometry.levels.block);
  ctx.renderEnums();
  ctx.register(`--${ctx.prefix}-g-fit`, '<number>', '1', false);
  for (const id of IDS) {
    for (let i = 0; i < (POINTS + 3) * 2; i++) {
      for (const axis of [0, 1]) {
        ctx.register(
          `--${ctx.prefix}-point-${id}-${i}-${axis}`,
          '<length>',
          '0px',
          false
        );
      }
    }
  }
  for (const side of FRAME_EDGES) {
    for (let i = 0; i < 4; i++) {
      for (const axis of [0, 1]) {
        ctx.register(
          `--${ctx.prefix}-edge-${side}-${i}-${axis}`,
          '<length>',
          '0px',
          false
        );
      }
    }
  }
  return {
    properties: ctx.properties(),
    base:
      (ctx.paint ? baseCss(ctx.prefix, geometry) : '') +
      ctx.enumCss +
      nested.css,
    geometry,
    levels,
    fit: fit + nested.fit,
    controls: [...ctx.controls.values()],
  };
}
