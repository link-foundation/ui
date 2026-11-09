import { edgeGeometryCss } from './frame-css-edge-geometry.js';

/** Shared responsive geometry. All lengths resolve against the decoration layer,
 * never a layout containment boundary on the host. Quadratics are sampled at
 * sixteen equal parameter intervals (maximum deviation at 128px: 0.18px).
 */
export const POINTS = 16;
export const IDS = ['tl', 'tr', 'br', 'bl'];
export const SIDES = ['top', 'right', 'bottom', 'left'];
export function shapePoints(shape) {
  return Array.from({ length: POINTS + 1 }, (_, i) => {
    const t = i / POINTS;
    if (shape === 'round') {
      return [t * t, (1 - t) ** 2];
    }
    if (shape === 'scoop') {
      return [2 * t - t * t, 1 - t * t];
    }
    if (shape === 'notch') {
      const points = [
        [0, 1],
        [0.5, 1],
        [0.5, 0.5],
        [1, 0.5],
        [1, 0],
      ];
      const j = Math.min(3, Math.floor(t * 4));
      const f = t * 4 - j;
      return points[j].map((v, k) => v + (points[j + 1][k] - v) * f);
    }
    if (shape === 'square') {
      return t <= 0.5 ? [0, 1 - 2 * t] : [2 * t - 1, 0];
    }
    return [t, 1 - t];
  });
}
const rule = (selector, declarations) =>
  `${selector} {\n${declarations.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
export { rule };

export function geometryCss(prefix) {
  const v = (name) => `var(--${prefix}-g-${name})`;
  const prop = (name) => `--${prefix}-g-${name}`;
  const declarations = [];
  // Length division preserves container-unit ratios in both browser engines.
  // Denominators stay positive, including a completely square frame.
  const ratios = [
    ['100cqw', 'tl-w', 'tr-w'],
    ['100cqw', 'bl-w', 'br-w'],
    ['100cqh', 'tl-h', 'bl-h'],
    ['100cqh', 'tr-h', 'br-h'],
  ].map(
    ([extent, a, b]) =>
      `calc(${extent} / max(0.000001px, calc(${v(a)} + ${v(b)})))`
  );
  declarations.push([prop('fit'), `min(1, ${ratios.join(', ')})`]);
  const at = (id, i, inset = false) => {
    const x = `calc(${v(`${id}-x${i}`)} * ${v(`${id}-${id === 'tr' || id === 'bl' ? 'h' : 'w'}`)} * ${v('fit')} * ${v('threshold')} * ${v('border')})`;
    const y = `calc(${v(`${id}-y${i}`)} * ${v(`${id}-${id === 'tr' || id === 'bl' ? 'w' : 'h'}`)} * ${v('fit')} * ${v('threshold')} * ${v('border')})`;
    const offset = inset ? `calc(${v(`${id}-stroke`)} / 2)` : '0px';
    // The local axes rotate clockwise for odd corners, matching frameGeometry.
    const local = id === 'tr' || id === 'bl' ? [y, x] : [x, y];
    return [
      id === 'tr' || id === 'br'
        ? `calc(100cqw - ${local[0]} - ${offset})`
        : `calc(${local[0]} + ${offset})`,
      id === 'br' || id === 'bl'
        ? `calc(100cqh - ${local[1]} - ${offset})`
        : `calc(${local[1]} + ${offset})`,
    ];
  };
  const contour = IDS.flatMap((id) =>
    Array.from({ length: POINTS + 1 }, (_, i) => at(id, i).join(' '))
  );
  let css = rule('[data-frame-paint] > *', declarations);
  css += rule('[data-frame-material]', [
    ['clip-path', `polygon(${contour.join(', ')})`],
  ]);
  for (const id of IDS) {
    const points = Array.from({ length: POINTS + 1 }, (_, i) => at(id, i));
    const extension = `calc(${v(`${id}-extension`)} * ${v('fit')} * ${v('threshold')} * ${v('border')})`;
    const extra = (point, axis, sign) =>
      point.map((value, j) =>
        j === axis ? `calc(${value} + ${sign} * ${extension})` : value
      );
    const startAxes = [1, 0, 1, 0],
      endAxes = [0, 1, 0, 1];
    const index = IDS.indexOf(id);
    const outside = [
      extra(points[0], startAxes[index], [1, -1, -1, 1][index]),
      ...points,
      extra(points.at(-1), endAxes[index], [1, 1, -1, -1][index]),
    ];
    // Parallel-offset sample normals. This also handles horizontal/vertical
    // notch segments, and keeps stroke widths independent of corner fitting.
    const inside = outside.map((point, i) => {
      const a = outside[Math.max(0, i - 1)];
      const b = outside[Math.min(outside.length - 1, i + 1)];
      const dx = `calc(${b[0]} - ${a[0]})`;
      const dy = `calc(${b[1]} - ${a[1]})`;
      const length = `max(0.000001px, hypot(${dx}, ${dy}))`;
      return [
        `calc(${point[0]} - (${dy} / ${length}) * ${v(`${id}-stroke`)} / 2)`,
        `calc(${point[1]} + (${dx} / ${length}) * ${v(`${id}-stroke`)} / 2)`,
      ];
    });
    // Stroke is centered on the contour, as in the fixed-size SVG reference.
    const outer = outside.map((p, i) =>
      p.map((value, axis) => `calc(${value} * 2 - ${inside[i][axis]})`)
    );
    const pointDeclarations = [];
    const polygon = [...outer, ...inside.reverse()].map((p, i) =>
      p
        .map((value, axis) => {
          const name = `--${prefix}-point-${id}-${i}-${axis}`;
          pointDeclarations.push([name, value]);
          return `var(${name})`;
        })
        .join(' ')
    );
    css += rule(`[data-frame-corner='${id}']`, [
      ...pointDeclarations,
      ['clip-path', `polygon(${polygon.join(', ')})`],
      ['background', v(`${id}-paint`)],
      [
        'opacity',
        `calc(${v('opacity')} * ${v(`${id}-visible`)} * ${v('border')} * min(1, calc(${v('threshold')} * 1000000)))`,
      ],
      ['z-index', v('layer')],
    ]);
  }
  return css + edgeGeometryCss(prefix);
}
