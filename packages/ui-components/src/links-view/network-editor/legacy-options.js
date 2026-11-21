import { parseNested } from '@link-foundation/ui-core';

const aliases = Object.freeze({
  placement: 'layout',
  middleGapStart: 'middleBefore',
  middleGapEnd: 'middleAfter',
  monoColor: 'color',
  background: 'background.type',
  bgColor: 'background.color',
  bgColor2: 'background.color2',
  bgAngle: 'background.angle',
  cardColor: 'card.color',
  cardOpacity: 'card.opacity',
  borderStyle: 'card.border',
  borderColor: 'card.borderColor',
  border: 'card.width',
  radius: 'card.radius',
  inset: 'card.inset',
  caption: 'caption.mode',
  captionText: 'caption.text',
  captionColor: 'caption.color',
  captionSize: 'caption.size',
  captionFont: 'caption.font',
  captionPosition: 'caption.position',
  notation: 'caption.notation',
  solveDebug: 'debug',
});
const markerAliases = Object.freeze(
  Object.fromEntries(
    ['start', 'end', 'middle'].flatMap((part) => [
      [part, `${part}.shape`],
      ...['Size', 'Angle', 'Offset', 'Across', 'Rotation'].map((field) => [
        part + field,
        `${part}.${field.toLowerCase()}`,
      ]),
    ])
  )
);
export const legacyOptionKeys = Object.freeze(
  Object.keys(aliases).concat(
    Object.keys(markerAliases),
    'card',
    'colors',
    'gaps'
  )
);

const legacyDefaults = Object.freeze({
  palette: 'site',
  color: '#e6edf7',
  forceCollision: 0.6,
  strokeWidth: 1.3,
  width: 2048,
  height: 2048,
  'middle.angle': 30,
  'background.type': 'solid',
  'background.color': '#000000',
  'background.color2': '#1e1b4b',
  'background.angle': 135,
  'caption.notation': 'L',
  'caption.size': 6,
  'caption.color': '#7d8aa3',
});
const legacyCard = Object.freeze({
  'card.color': '#0d1220',
  'card.opacity': 0.8,
  'card.border': 'solid',
  'card.borderColor': '#2b3b57',
  'card.width': 0.6,
  'card.radius': 10,
  'card.inset': 3,
});
const enabled = (value) => value === 'true' || value === '1';
export const legacyAngle = (value) => {
  const number = Number(value);
  return number > 180 && number <= 359 ? number - 360 : value;
};

export function hasLegacyOptions(params) {
  const turns = params.get('turns');
  const rotation = params.get('rotation');
  return (
    legacyOptionKeys.some((key) => params.has(key)) ||
    (turns !== null && turns !== '' && !turns.includes(':')) ||
    legacyAngle(rotation) !== rotation
  );
}

export function legacyRows(value) {
  return value.split(',').map((row) => {
    try {
      return parseNested(row).flatMap((link) =>
        (link.id === null ? link.values : [link]).map(({ id }) => {
          const number = Number(id);
          return Number.isFinite(number) ? number : null;
        })
      );
    } catch {
      return [];
    }
  });
}

export function readLegacyOptions(params, legacy) {
  if (!legacy) {
    return {};
  }
  const raw = { ...legacyDefaults };
  for (const [old, key] of Object.entries({ ...aliases, ...markerAliases })) {
    if (params.has(old)) {
      raw[key] = params.get(old);
    }
  }
  if (raw.layout === 'square') {
    raw.layout = 'grid';
  }
  raw['background.angle'] = legacyAngle(raw['background.angle']);
  if (enabled(params.get('card'))) {
    for (const [key, value] of Object.entries(legacyCard)) {
      raw[key] ??= value;
    }
  } else {
    raw['card.opacity'] = 0;
    raw['card.border'] = 'none';
    raw['card.inset'] = 0;
  }
  if (params.has('gaps')) {
    raw.linkGaps = legacyRows(params.get('gaps'));
  }
  if (params.has('colors')) {
    raw.linkColors = params
      .get('colors')
      .split(',')
      .map((color) => color.trim());
  }
  return raw;
}
