import { FRAME_CORNERS, FRAME_EDGES } from './frame-schema.js';
import { rule } from './frame-css-geometry.js';

function inheritsChoice(definition, key) {
  const corner = FRAME_CORNERS.find((id) => key.startsWith(`${id}-`));
  if (corner) {
    return (
      definition.corners[corner]?.[key.slice(corner.length + 1)] === undefined
    );
  }
  const edge = FRAME_EDGES.find((id) => key.startsWith(`${id}-`));
  if (edge) {
    const field = key.slice(edge.length + 1);
    return (
      definition.edges[edge]?.[field] === undefined &&
      !(field === 'style' && definition.style !== undefined)
    );
  }
  return definition[key] === undefined;
}
/** Rebind enum expressions on inheriting levels so their own widths/colors
 * remain live, using expressions bound to the child level. */
export function enumRules(ctx) {
  let css = '';
  const depth = (level) => {
    let count = 0;
    while (ctx.frames.get(level)?.extends) {
      level = ctx.frames.get(level).extends;
      count++;
    }
    return count;
  };
  for (const entry of [...ctx.enumerations].sort(
    (a, b) => depth(a.level) - depth(b.level)
  )) {
    const { level, key, choices, declarations } = entry;
    const descendants = [...ctx.frames.keys()].filter((child) => {
      if (child === level) {
        return false;
      }
      while (child !== level) {
        const definition = ctx.frames.get(child);
        if (!definition.extends || !inheritsChoice(definition, key)) {
          return false;
        }
        child = definition.extends;
      }
      return true;
    });
    for (const choice of choices) {
      const own = declarations(choice);
      const inherited = descendants.flatMap((child) =>
        own.map(([name, value]) => [
          name.replace(ctx.prop(level, ''), ctx.prop(child, '')),
          String(value).replaceAll(ctx.prop(level, ''), ctx.prop(child, '')),
        ])
      );
      css += rule(
        `:where(${ctx.scope})[data-${ctx.prefix}-${level}-${key}='${choice}']`,
        [...own, ...inherited]
      );
    }
  }
  return css;
}
