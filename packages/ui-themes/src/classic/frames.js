import { formatLinks } from '@link-foundation/ui-core';

export const corners = [
  'square',
  'cut',
  'tall',
  'wide',
  'round',
  'scoop',
  'notch',
];
export const lines = ['none', 'gap', 'line', 'accent', 'bracket'];

/** A single clipped surface paints corners and edges together: no opaque overlays.
 * @param {{corner?: string, line?: string, size?: number}} options
 * @returns {string} style-rule LiNo, accepted by ui-style
 */
export function frameStyle({
  corner = 'square',
  line = 'line',
  size = 12,
} = {}) {
  if (!corners.includes(corner) || !lines.includes(line)) {
    throw new RangeError('Unknown frame corner or line');
  }
  if (!Number.isFinite(size) || size < 0 || size > 48) {
    throw new RangeError('Frame size must be a number from 0 to 48 pixels');
  }
  // Percentages keep small panels valid; size is a bounded corner proportion.
  const s = size;
  const polygons = {
    square: 'inset(0px)',
    cut: `polygon(${s}% 0%, ${100 - s}% 0%, 100% ${s}%, 100% ${100 - s}%, ${100 - s}% 100%, ${s}% 100%, 0% ${100 - s}%, 0% ${s}%)`,
    tall: `polygon(${s / 2}% 0%, ${100 - s / 2}% 0%, 100% ${s}%, 100% ${100 - s}%, ${100 - s / 2}% 100%, ${s / 2}% 100%, 0% ${100 - s}%, 0% ${s}%)`,
    wide: `polygon(${s}% 0%, ${100 - s}% 0%, 100% ${s / 2}%, 100% ${100 - s / 2}%, ${100 - s}% 100%, ${s}% 100%, 0% ${100 - s / 2}%, 0% ${s / 2}%)`,
    round: `inset(0px round ${s}px)`,
    scoop: `polygon(${s}% 0%, ${100 - s}% 0%, ${100 - s}% ${s}%, 100% ${s}%, 100% ${100 - s}%, ${100 - s}% ${100 - s}%, ${100 - s}% 100%, ${s}% 100%, ${s}% ${100 - s}%, 0% ${100 - s}%, 0% ${s}%, ${s}% ${s}%)`,
    notch: `polygon(0% 0%, ${s}% 0%, ${s}% ${s / 2}%, ${s * 2}% ${s / 2}%, ${s * 2}% 0%, 100% 0%, 100% 100%, 0% 100%)`,
  };
  return formatLinks([
    {
      id: `frame-${corner}-${line}`,
      values: [
        'style',
        ['selector', ['type', 'panel']],
        ['clip-path', polygons[corner]],
        ['radius', '0px'],
        ['background', ['token', 'color.surface']],
        ['border-color', ['token', 'color.primary']],
        [
          'border-style',
          {
            none: 'none',
            gap: 'dashed',
            line: 'solid',
            accent: 'solid',
            bracket: 'double',
          }[line],
        ],
        [
          'border-width',
          line === 'none'
            ? '0px'
            : line === 'accent'
              ? '3px'
              : line === 'bracket'
                ? '4px'
                : '1px',
        ],
        ['opacity', ['token', 'surface.opacity']],
      ],
    },
  ]);
}

export {
  FRAME_LEVELS,
  FRAME_CORNERS,
  FRAME_EDGES,
  readFrames,
  resolveFrame,
  frameGeometry,
} from './frame-schema.js';
