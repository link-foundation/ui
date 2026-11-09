import { normalize, networkOptionSchema } from './options.js';

export const networkSizePresets = Object.freeze(
  [
    [512, 512],
    [1024, 1024],
    [2048, 2048],
    [1080, 1080],
    [1200, 630],
    [1600, 900],
    [1080, 1920],
  ].map(Object.freeze)
);
/** Looks are framework-owned values; none are copied from a consumer site. */
export const networkLooks = Object.freeze(
  Object.fromEntries(
    Object.entries({
      card: {
        'background.type': 'solid',
        'background.color': '#e5e7eb',
        'card.opacity': 1,
        'card.radius': 8,
        'card.inset': 6,
      },
      black: {
        'background.type': 'solid',
        'background.color': '#000000',
        color: '#ffffff',
        'caption.color': '#ffffff',
      },
      transparent: { 'background.type': 'transparent' },
      paper: {
        'background.type': 'solid',
        'background.color': '#fffaf0',
        color: '#473c2d',
        'caption.mode': 'pairs',
      },
      blueprint: {
        'background.type': 'solid',
        'background.color': '#102b53',
        color: '#ffffff',
        dash: 'dashed',
      },
      neon: {
        'background.type': 'solid',
        'background.color': '#111827',
        color: '#22ffbb',
        glow: 4,
      },
      social: {
        width: 1200,
        height: 630,
        'background.type': 'linear',
        'card.opacity': 1,
        'card.inset': 6,
        'card.radius': 6,
      },
    }).map(([key, value]) => [key, Object.freeze(value)])
  )
);
export function replaceStyle(current, style) {
  const preserved = Object.fromEntries(
    networkOptionSchema
      .filter((f) => ['solver', 'gaps'].includes(f.section))
      .map((f) => [f.key, current[f.key]])
  );
  return normalize({
    ...normalize(style),
    ...preserved,
    turns: current.turns,
    linkGaps: current.linkGaps,
    linkColors: current.linkColors,
    order: current.order,
    frame: null,
  });
}
