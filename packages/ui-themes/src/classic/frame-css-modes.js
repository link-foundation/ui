import { FRAME_EDGES } from './frame-schema.js';
import { IDS, rule } from './frame-css-geometry.js';

/** A level in frame mode reads its explicit parent's live frame parameters.
 * Own mode restores its ordinary cascade; border mode collapses all extents. */
export function modeRules(ctx, level, declarations) {
  const definition = ctx.frames.get(level);
  const partKeys = declarations
    .map(([name]) => name.slice(ctx.prop(level, '').length))
    .filter((key) =>
      [...IDS, ...FRAME_EDGES].some((id) => key.startsWith(`${id}-`))
    );
  const parent = definition.extends;
  const inherited = parent
    ? partKeys.map((key) => {
        const field = key.slice(key.indexOf('-') + 1);
        const scale = [
          'size',
          'width',
          'height',
          'arm',
          'w',
          'h',
          'gap',
          'extension',
        ].includes(field);
        const value = ctx.variable(parent, key);
        return [
          ctx.prop(level, key),
          scale ? `calc(${value} * ${ctx.variable(level, 'scale')})` : value,
        ];
      })
    : [];
  ctx.enumeration(level, 'mode', ['frame', 'own', 'border'], (mode) => [
    [ctx.prop(level, 'border'), mode === 'border' ? 0 : 1],
    ...(mode === 'frame' ? inherited : []),
  ]);
  if (definition.mode === 'frame' && parent) {
    const attribute = `data-${ctx.prefix}-${level}-mode`;
    ctx.enumCss += rule(
      `:where(${ctx.scope}):not([${attribute}='own']):not([${attribute}='border'])`,
      inherited
    );
  }
}
