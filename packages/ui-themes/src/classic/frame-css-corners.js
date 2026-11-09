import { corners, lines } from './frame-vocabulary.js';
import { FRAME_CORNERS, FRAME_EDGES } from './frame-schema.js';
import { IDS, shapePoints } from './frame-css-geometry.js';
import { colorCss } from './frame-color.js';

export function cornerShape(ctx, level, id, shape) {
  const p = (key) => ctx.prop(level, `${id}-${key}`);
  return [
    [p('wf'), shape === 'tall' ? 0.5 : 1],
    [p('hf'), shape === 'wide' ? 0.5 : 1],
    ...shapePoints(shape).flatMap(([x, y], i) => [
      [p(`x${i}`), x],
      [p(`y${i}`), y],
    ]),
  ];
}
export function cornerLine(ctx, level, id, line) {
  const p = (key) => ctx.prop(level, `${id}-${key}`);
  const v = (key) => ctx.variable(level, key);
  return [
    [p('visible'), ['none', 'gap'].includes(line) ? 0 : 1],
    [p('gap'), line === 'gap' ? v(`${id}-arm`) : '0px'],
    [p('extension'), line === 'bracket' ? v(`${id}-arm`) : '0px'],
    [
      p('paint'),
      v(
        line === 'line'
          ? `${FRAME_EDGES[IDS.indexOf(id)]}-color`
          : `${id}-color`
      ),
    ],
  ];
}
function automaticStroke(frames, level, name) {
  const definition = frames.get(level);
  const stroke = definition.corners[name]?.stroke;
  if (stroke !== undefined) {
    return stroke === 'auto';
  }
  return definition.extends
    ? automaticStroke(frames, definition.extends, name)
    : true;
}
function cornerStroke(ctx, level, name, id, corner, raw) {
  const auto =
    raw?.stroke === undefined
      ? automaticStroke(ctx.frames, level, name)
      : raw.stroke === 'auto';
  if (raw && raw.stroke === undefined && !auto) {
    return [];
  }
  return [
    ctx.set(
      level,
      `${id}-stroke`,
      auto
        ? ctx.variable(level, `${FRAME_EDGES[IDS.indexOf(id)]}-stroke`)
        : `${corner.stroke}px`
    ),
  ];
}
function strokeChanged(patch, raw, adjacent) {
  return (
    !patch ||
    raw?.stroke !== undefined ||
    patch.stroke !== undefined ||
    adjacent?.stroke !== undefined
  );
}
function cornerPaint(ctx, level, id, corner, { patch, raw, adjacent }) {
  const values = cornerLine(ctx, level, id, corner.line);
  if (!patch || raw?.line !== undefined) {
    return values;
  }
  return raw?.color !== undefined || adjacent?.color !== undefined
    ? [values.at(-1)]
    : [];
}
export function cornerValues(ctx, level, frame, id, patch) {
  const name = FRAME_CORNERS[IDS.indexOf(id)];
  const c = frame.corners[name];
  const raw = patch?.corners[name];
  const p = (key) => ctx.prop(level, `${id}-${key}`);
  const v = (key) => ctx.variable(level, `${id}-${key}`);
  const set = (key, value, ...type) =>
    ctx.set(level, `${id}-${key}`, value, ...type);
  const declarations = [];
  const changed = (key) => !patch || raw?.[key] !== undefined;
  for (const key of ['size', 'arm']) {
    if (changed(key)) {
      declarations.push(set(key, `${c[key]}px`));
    }
  }
  for (const key of ['width', 'height']) {
    if (changed(key) || changed('size')) {
      declarations.push(
        set(key, c[key] === undefined ? v('size') : `${c[key]}px`)
      );
    }
  }
  const adjacent = patch?.edges[FRAME_EDGES[IDS.indexOf(id)]];
  if (strokeChanged(patch, raw, adjacent)) {
    declarations.push(...cornerStroke(ctx, level, name, id, c, raw));
  }
  if (changed('color')) {
    declarations.push(ctx.color(level, `${id}-color`, colorCss(c.color)));
  }
  if (changed('shape')) {
    declarations.push(...cornerShape(ctx, level, id, c.shape));
  }
  // Derived values are recomputed on a state host so inherited scope values
  // cannot retain stale dimensions or paint when a state changes one input.
  declarations.push(
    [p('w'), `calc(${v('width')} * ${v('wf')})`],
    [p('h'), `calc(${v('height')} * ${v('hf')})`]
  );
  declarations.push(
    ...cornerPaint(ctx, level, id, c, { patch, raw, adjacent })
  );
  ctx.register(p('w'));
  ctx.register(p('h'));
  if (!patch) {
    ctx.enumeration(level, `${name}-shape`, corners, (shape) =>
      cornerShape(ctx, level, id, shape)
    );
    ctx.enumeration(level, `${name}-line`, lines, (line) =>
      cornerLine(ctx, level, id, line)
    );
  }
  return declarations;
}
