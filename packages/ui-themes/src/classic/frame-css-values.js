import { modeRules } from './frame-css-modes.js';
import {
  FRAME_CORNERS,
  FRAME_EDGES,
  FRAME_STYLES,
  resolveFrame,
} from './frame-schema.js';
import { IDS } from './frame-css-geometry.js';
import { cornerValues } from './frame-css-corners.js';
import { edgeValues, edgeStyle } from './frame-css-edges.js';

function inheritedCorner(definition, frame, id, field) {
  const name = FRAME_CORNERS[IDS.indexOf(id)];
  const raw = definition.corners[name] ?? {};
  const explicit = raw[field] !== undefined && raw[field] !== 'auto';
  if (['size', 'arm'].includes(field)) {
    return [!explicit, true];
  }
  if (['width', 'height'].includes(field)) {
    return [!explicit && frame.corners[name][field] !== undefined, true];
  }
  if (['wf', 'hf'].includes(field) || /^[xy]\d+$/u.test(field)) {
    return [raw.shape === undefined, false];
  }
  if (['stroke', 'color'].includes(field)) {
    return [raw[field] === undefined, false];
  }
  if (field === 'visible') {
    return [raw.line === undefined, false];
  }
  return [false, false];
}
function inheritedEdge(definition, side, field) {
  if (['image', 'mask', 'across'].includes(field)) {
    return false;
  }
  const raw = definition.edges[side] ?? {};
  const dependency =
    { visible: 'line', mask: 'line', image: 'style' }[field] ?? field;
  return (
    raw[dependency] === undefined &&
    !(field === 'image' && definition.style !== undefined) &&
    !(field === 'stroke' && definition.stroke !== undefined)
  );
}
export function inheritValues(ctx, level, frame, declarations) {
  const definition = ctx.frames.get(level);
  if (!definition.extends) {
    return declarations;
  }
  return declarations.map(([name, value]) => {
    const key = name.slice(ctx.prop(level, '').length);
    const corner = IDS.find((id) => key.startsWith(`${id}-`));
    const edge = FRAME_EDGES.find((id) => key.startsWith(`${id}-`));
    let inherit,
      scaled = false;
    if (corner) {
      [inherit, scaled] = inheritedCorner(
        definition,
        frame,
        corner,
        key.slice(corner.length + 1)
      );
    } else if (edge) {
      inherit = inheritedEdge(definition, edge, key.slice(edge.length + 1));
    } else {
      inherit =
        definition[key] === undefined &&
        !['threshold', 'border', 'scale'].includes(key);
    }
    const parent = ctx.variable(definition.extends, key);
    return [
      name,
      inherit
        ? scaled
          ? `calc(${parent} * ${ctx.variable(level, 'scale')})`
          : parent
        : value,
    ];
  });
}
function levelValues(ctx, level, frame, patch) {
  const declarations = [];
  const changed = (key) => !patch || patch[key] !== undefined;
  if (changed('stroke')) {
    declarations.push(
      ctx.set(
        level,
        'stroke',
        `${frame.stroke === 'auto' ? 1 : frame.stroke}px`
      )
    );
  }
  if (changed('opacity')) {
    declarations.push(
      ctx.set(level, 'opacity', frame.opacity, '<number>', '1')
    );
  }
  if (changed('layer')) {
    declarations.push(
      ctx.set(level, 'layer', frame.layer === 'above' ? 2 : 0, '<number>', '2')
    );
  }
  if (changed('mode')) {
    declarations.push([
      ctx.prop(level, 'border'),
      frame.mode === 'border' ? 0 : 1,
    ]);
  }
  if (!patch) {
    declarations.push(
      ctx.set(level, 'threshold', 1, '<number>', '1'),
      ctx.set(
        level,
        'scale',
        ctx.frames.get(level).scale ?? 1,
        '<number>',
        '1',
        false
      ),
      ctx.set(level, 'fitScale', frame.fitScale, '<number>', '0.5')
    );
    for (const key of ['min-width', 'max-width', 'min-height', 'max-height']) {
      declarations.push(
        ctx.set(level, key, frame[key], '<number>', '0', false)
      );
    }
    ctx.enumeration(level, 'layer', ['above', 'below'], (layer) => [
      [ctx.prop(level, 'layer'), layer === 'above' ? 2 : 0],
    ]);
    ctx.enumeration(level, 'style', FRAME_STYLES, (style) =>
      FRAME_EDGES.flatMap((side) => edgeStyle(ctx, level, side, style))
    );
  }
  return declarations;
}
export function frameValues(ctx, level, frame, patch = null) {
  if (!patch && ctx.frames.get(level).mode === 'frame') {
    const ownFrames = new Map(ctx.frames);
    ownFrames.set(level, { ...ctx.frames.get(level), mode: 'own' });
    frame = resolveFrame(ownFrames, level);
  }
  const declarations = [
    ...levelValues(ctx, level, frame, patch),
    ...IDS.flatMap((id) => cornerValues(ctx, level, frame, id, patch)),
    ...FRAME_EDGES.flatMap((side) =>
      edgeValues(ctx, level, frame, side, patch)
    ),
  ];
  if (patch) {
    return declarations;
  }
  const inherited = inheritValues(ctx, level, frame, declarations);
  modeRules(ctx, level, inherited);
  return inherited;
}
