import { lines } from './frame-vocabulary.js';
import { FRAME_STYLES } from './frame-schema.js';
import { colorCss } from './frame-color.js';

export function edgeStyle(ctx, level, name, style) {
  const color = ctx.variable(level, `${name}-color`);
  const stroke = ctx.variable(level, `${name}-stroke`);
  const horizontal = name === 'top' || name === 'bottom';
  const direction = horizontal ? 'to right' : 'to bottom';
  const across = horizontal ? 'to bottom' : 'to right';
  const dash =
    style === 'dotted'
      ? `max(1px, ${stroke})`
      : `max(1px, calc(${stroke} * 3))`;
  const images = {
    solid: `linear-gradient(${color}, ${color})`,
    double: `linear-gradient(${across}, ${color} 0% 33.333%, transparent 33.333% 66.667%, ${color} 66.667%)`,
    dashed: `repeating-linear-gradient(${direction}, ${color} 0px ${dash}, transparent ${dash} calc(${dash} * 2))`,
    dotted: `repeating-linear-gradient(${direction}, ${color} 0px ${dash}, transparent ${dash} calc(${dash} * 2))`,
  };
  return [
    [ctx.prop(level, `${name}-image`), images[style]],
    [ctx.prop(level, `${name}-across`), style === 'double' ? stroke : '100%'],
  ];
}
export function edgeLine(ctx, level, name, line) {
  const direction =
    name === 'top' || name === 'bottom' ? 'to right' : 'to bottom';
  const gap = ctx.variable(level, `${name}-gap`);
  const mask =
    line === 'bracket'
      ? `linear-gradient(${direction}, black 0px ${gap}, transparent ${gap} calc(100% - ${gap}), black calc(100% - ${gap}))`
      : line === 'gap'
        ? `repeating-linear-gradient(${direction}, black 0px ${gap}, transparent ${gap} calc(${gap} * 2))`
        : 'linear-gradient(black, black)';
  return [
    [ctx.prop(level, `${name}-visible`), line === 'none' ? 0 : 1],
    [ctx.prop(level, `${name}-mask`), mask],
  ];
}
function autoStroke(frames, level, side) {
  const entry = frames.get(level);
  const stroke = entry.edges[side]?.stroke;
  if (stroke !== undefined) {
    return stroke === 'auto';
  }
  return entry.extends ? autoStroke(frames, entry.extends, side) : true;
}
function edgePaint(ctx, level, side, edge, patch, raw) {
  const declarations = [];
  if (
    !patch ||
    ['style', 'color', 'stroke'].some((key) => raw?.[key] !== undefined) ||
    patch.style !== undefined ||
    patch.stroke !== undefined
  ) {
    declarations.push(...edgeStyle(ctx, level, side, edge.style));
  }
  if (!patch || raw?.line !== undefined || raw?.gap !== undefined) {
    declarations.push(...edgeLine(ctx, level, side, edge.line));
  }
  return declarations;
}
export function edgeValues(ctx, level, frame, side, patch) {
  const edge = frame.edges[side];
  const raw = patch?.edges[side];
  const declarations = [];
  const changed = (key) => !patch || raw?.[key] !== undefined;
  const set = (key, value, ...type) =>
    ctx.set(level, `${side}-${key}`, value, ...type);
  if (changed('stroke') || patch?.stroke !== undefined) {
    const auto = patch
      ? raw?.stroke === 'auto'
      : autoStroke(ctx.frames, level, side);
    declarations.push(
      set('stroke', auto ? ctx.variable(level, 'stroke') : `${edge.stroke}px`)
    );
  }
  if (changed('color')) {
    declarations.push(ctx.color(level, `${side}-color`, colorCss(edge.color)));
  }
  if (changed('gap')) {
    declarations.push(set('gap', `${edge.gap}px`));
  }
  declarations.push(...edgePaint(ctx, level, side, edge, patch, raw));
  if (!patch && !colorCss(edge.color).includes('currentColor')) {
    ctx.register(ctx.prop(level, `${side}-image`), '<image> | none', 'none');
  }
  ctx.register(ctx.prop(level, `${side}-mask`), '<image> | none', 'none');
  if (!patch) {
    ctx.enumeration(level, `${side}-style`, FRAME_STYLES, (style) =>
      edgeStyle(ctx, level, side, style)
    );
    ctx.enumeration(level, `${side}-line`, lines, (line) =>
      edgeLine(ctx, level, side, line)
    );
  }
  return declarations;
}
