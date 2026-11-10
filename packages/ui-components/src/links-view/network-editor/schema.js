import { parseNested } from '@link-foundation/ui-core';

/** Canonical editor schema: key type default min max step section availability. */
export const networkSchemaLino = `
layout choice auto 'auto circle grid hex spiral dice cards force layered' layout always
layoutAspect number 1 0.3 3 0.1 layout always
columns number 0 0 30 1 layout grid
spread number 1 0 100 0.1 layout always
rotation number 0 -180 180 1 layout always
free number 1 0 10 0.1 geometry free
loop number 1 0 10 0.1 geometry loop
bulge number 0 -180 180 1 geometry always
loopBend number 0 -180 180 1 geometry loop
angles choice fixed 'fixed mirror' geometry referenced
sourceAngle number 30 -180 180 1 geometry fixed
targetAngle number 30 -180 180 1 geometry fixed
tension number 0.4 0 2 0.01 geometry always
startGap number 0.08 0 1 0.01 gaps always
endGap number 0.08 0 1 0.01 gaps always
middleBefore number 0 0 30 0.1 gaps always
middleAfter number 0 0 30 0.1 gaps always
padding number 9 0 48 1 geometry always
strokeWidth number 1 0.5 10 0.1 line always
color color '#202b3d' line always
palette choice default 'default custom' palette always
dash choice solid 'solid dashed dotted dashdot long' line always
linecap choice round 'butt round square' line always
opacity number 1 0.1 1 0.01 line always
glow number 0 0 12 0.1 line always
arrowJoin choice miter 'miter round bevel' line arrow
balanceArrows boolean true line arrow
background.type choice transparent 'transparent solid linear radial' background always
background.color color '#ffffff' background background
background.color2 color '#dbeafe' background gradient
background.angle number 0 -180 180 1 background linear
card.color color '#ffffff' card card
card.opacity number 0 0 1 0.01 card always
card.border choice none 'solid dashed dotted double none' card always
card.borderColor color '#202b3d' card border
card.width number 1 0.1 6 0.1 card border
card.radius number 0 0 50 1 card card
card.inset number 0 0 30 1 card card
caption.mode choice none 'none theory pairs number links custom' caption always
caption.text text '' caption customCaption
caption.font choice mono 'mono sans serif' caption caption
caption.size number 5 3 14 0.1 caption caption
caption.color color '#202b3d' caption caption
width number 640 64 4096 1 size always
height number 640 64 4096 1 size always
clearance number 1 0 10 0.1 solver always
solveRange number 180 0 180 1 solver always
solveStep number 1 1 30 1 solver always
solveGaps boolean true solver always
solveGapRange number 0.2 0 1 0.01 solver solveGaps
solveMiddleRange number 0 0 15 0.1 solver solveGaps
passes number 3 1 10 1 solver always
debug boolean false solver always
`;

function readField(link) {
  const [key, type, initial, ...rest] = link.values.map((v) => v.id);
  const section = rest.at(-2);
  const availability = rest.at(-1);
  return {
    key,
    type,
    section,
    availability,
    default:
      type === 'number'
        ? Number(initial)
        : type === 'boolean'
          ? initial === 'true'
          : initial,
    ...(type === 'number'
      ? { min: Number(rest[0]), max: Number(rest[1]), step: Number(rest[2]) }
      : {}),
    ...(type === 'choice' ? { choices: rest[0].split(' ') } : {}),
  };
}

const markerFields = (part) => {
  const initial = {
    start: ['bar', 2.5, 70, 2.5],
    end: ['arrow', 3.5, 45, 0],
    middle: ['dot', 2, 45, 0],
  }[part];
  return [
    {
      key: 'shape',
      type: 'choice',
      default: initial[0],
      choices: [
        'bar',
        'arrow',
        'triangle',
        'tail',
        'dot',
        'circle',
        'square',
        'diamond',
        'none',
      ],
    },
    ...[
      ['size', initial[1], 0.5, 15, 0.1],
      ['angle', initial[2], 5, 85, 1],
      ['offset', initial[3], -20, 20, 0.1],
      ['across', 0, -20, 20, 0.1],
      ['rotation', 0, -180, 180, 1],
    ].map(([key, value, min, max, step]) => ({
      key,
      type: 'number',
      default: value,
      min,
      max,
      step,
    })),
  ].map((field) => ({
    ...field,
    key: `${part}.${field.key}`,
    section: part,
    availability:
      field.key === 'shape' ? 'always' : `marker:${part}:${field.key}`,
  }));
};

export const networkOptionSchema = Object.freeze(
  [
    ...parseNested(networkSchemaLino).map(readField),
    ...['start', 'end', 'middle'].flatMap(markerFields),
  ].map(Object.freeze)
);

/** Whether this control can affect the current network or style. */
export function optionAvailable(field, links, options) {
  const rule = field.availability;
  const self = links.some((pair, i) => pair.includes(i + 1));
  const referenced = links.some((pair, i) =>
    pair.some((v) => v !== 0 && v !== i + 1)
  );
  const predicates = {
    always: true,
    free: links.some((pair) => pair.includes(0)),
    loop: self,
    referenced,
    fixed: referenced && options.angles === 'fixed',
    grid: ['grid', 'cards'].includes(options.layout),
    circle: options.layout === 'circle',
    background: options['background.type'] !== 'transparent',
    gradient: ['linear', 'radial'].includes(options['background.type']),
    linear: options['background.type'] === 'linear',
    card: options['card.opacity'] > 0 || options['card.border'] !== 'none',
    border: options['card.border'] !== 'none',
    caption: options['caption.mode'] !== 'none',
    customCaption: options['caption.mode'] === 'custom',
    solveGaps: options.solveGaps,
    arrow: ['start', 'end', 'middle'].some((part) =>
      ['arrow', 'triangle', 'tail'].includes(options[`${part}.shape`])
    ),
  };
  if (!rule.startsWith('marker:')) {
    return predicates[rule] ?? false;
  }
  const [, part, key] = rule.split(':');
  const shape = options[`${part}.shape`];
  if (shape === 'none') {
    return false;
  }
  if (key === 'angle') {
    return ['arrow', 'triangle', 'tail'].includes(shape);
  }
  return key !== 'rotation' || !['dot', 'circle'].includes(shape);
}

/** Structured fields are edited by the link cards or supplied by a solver. */
export const networkOverrideSchema = Object.freeze(
  [
    {
      key: 'turns',
      type: 'per-link-vector',
      min: -180,
      max: 180,
      step: 1,
      default: '0 0',
      section: 'links',
      availability: 'always',
    },
    {
      key: 'linkGaps',
      type: 'per-link-vector',
      min: '0 0 0 0',
      max: '1 1 30 30',
      step: 0.01,
      default: '~ ~ ~ ~',
      section: 'links',
      availability: 'always',
    },
    {
      key: 'linkColors',
      type: 'per-link-color',
      default: '~',
      section: 'links',
      availability: 'always',
    },
    {
      key: 'frame',
      type: 'vector',
      min: '0.000000001 -1000000 -1000000',
      max: '60 1000000 1000000',
      default: '~',
      section: 'geometry',
      availability: 'always',
    },
    {
      key: 'order',
      type: 'permutation',
      min: 1,
      default: '~',
      section: 'layout',
      availability: 'circle',
    },
  ].map(Object.freeze)
);
