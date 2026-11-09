import { FRAME_CORNERS, FRAME_EDGES } from './frame-schema.js';
import { colorCss } from './frame-color.js';

const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function sizedCorners(frame) {
  return FRAME_CORNERS.map((id) => {
    const c = frame.corners[id];
    return {
      ...c,
      width:
        frame.mode === 'border'
          ? 0
          : (c.width ?? c.size * (c.shape === 'tall' ? 0.5 : 1)),
      height:
        frame.mode === 'border'
          ? 0
          : (c.height ?? c.size * (c.shape === 'wide' ? 0.5 : 1)),
    };
  });
}

/**
 * A transparent contour plus separate stroke paths. Apply clipPath to a material
 * layer and place borderSvg above it; neither layer paints an opaque cutout.
 */
export function frameGeometry(frame, width, height) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Frame dimensions must be positive finite pixels');
  }
  const cs = sizedCorners(frame);
  const scale = Math.min(
    1,
    width / Math.max(cs[0].width + cs[1].width, Number.EPSILON),
    width / Math.max(cs[2].width + cs[3].width, Number.EPSILON),
    height / Math.max(cs[0].height + cs[3].height, Number.EPSILON),
    height / Math.max(cs[1].height + cs[2].height, Number.EPSILON)
  );
  for (const c of cs) {
    c.width *= scale;
    c.height *= scale;
  }
  // Each corner is described in local coordinates from (0,h) to (w,0).
  const transforms = [
    (x, y) => [x, y],
    (x, y) => [width - y, x],
    (x, y) => [width - x, height - y],
    (x, y) => [y, height - x],
  ];
  const starts = [],
    ends = [],
    curves = [];
  for (let i = 0; i < 4; i++) {
    const c = cs[i];
    const w = i % 2 ? c.height : c.width;
    const h = i % 2 ? c.width : c.height;
    const at = (x, y) => transforms[i](x, y).join(' ');
    starts.push(at(0, h));
    ends.push(at(w, 0));
    const end = ends[i];
    curves.push(
      c.shape === 'square'
        ? `L ${at(0, 0)} L ${end}`
        : c.shape === 'round'
          ? `Q ${at(0, 0)} ${end}`
          : c.shape === 'scoop'
            ? `Q ${at(w, h)} ${end}`
            : c.shape === 'notch'
              ? `L ${at(w / 2, h)} L ${at(w / 2, h / 2)} L ${at(w, h / 2)} L ${end}`
              : `L ${end}`
    );
  }
  let path = `M ${starts[0]} ${curves[0]}`;
  for (let i = 1; i < 4; i++) {
    path += ` L ${starts[i]} ${curves[i]}`;
  }
  path += ' Z';
  const strokes = frameStrokes(
    frame,
    cs,
    { starts, ends, curves, transforms },
    scale
  );
  return {
    path,
    clipPath: `path("${path}")`,
    corners: Object.fromEntries(FRAME_CORNERS.map((id, i) => [id, cs[i]])),
    borderSvg: `<svg xmlns="http://www.w3.org/2000/svg" style="overflow:visible" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><g opacity="${frame.opacity ?? 1}">${strokes}</g></svg>`,
  };
}

function frameStrokes(frame, cs, { starts, ends, curves, transforms }, scale) {
  const stroke = (d, c, extra = '') =>
    `<path d="${esc(d)}" fill="none" stroke="${esc(colorCss(c.color))}" stroke-width="${c.stroke}" ${extra}/>`;
  const strokes = cs
    .map((c, i) => {
      if (['none', 'gap'].includes(c.line) || frame.mode === 'border') {
        return '';
      }
      const paint =
        c.line === 'line'
          ? { ...c, color: frame.edges[FRAME_EDGES[i]].color }
          : c;
      let d = `M ${starts[i]} ${curves[i]}`;
      if (c.line === 'bracket') {
        const w = i % 2 ? c.height : c.width,
          h = i % 2 ? c.width : c.height;
        d = `M ${transforms[i](0, h + c.arm * scale).join(' ')} L ${starts[i]} ${curves[i]} L ${transforms[i](w + c.arm * scale, 0).join(' ')}`;
      }
      return stroke(d, paint);
    })
    .join('');
  return strokes + edgeStrokes(frame, cs, starts, ends, scale, stroke);
}

function edgeStrokes(frame, cs, starts, ends, scale, stroke) {
  let strokes = '';
  for (let i = 0; i < 4; i++) {
    const edge = frame.edges[FRAME_EDGES[i]];
    if (edge.line === 'none') {
      continue;
    }
    const next = (i + 1) % 4;
    let a = ends[i].split(' ').map(Number),
      b = starts[next].split(' ').map(Number);
    const fullLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (fullLength > 0 && frame.mode !== 'border') {
      const direction = a.map((value, j) => (b[j] - value) / fullLength);
      const gapA =
        cs[i].line === 'gap' ? Math.min(cs[i].arm * scale, fullLength / 2) : 0;
      const gapB =
        cs[next].line === 'gap'
          ? Math.min(cs[next].arm * scale, fullLength / 2)
          : 0;
      a = a.map((value, j) => value + direction[j] * gapA);
      b = b.map((value, j) => value - direction[j] * gapB);
    }
    const style = edge.style ?? 'solid';
    const paint = (d, value, extra = '') => {
      if (style !== 'double') {
        return stroke(d, value, extra);
      }
      const offset = edge.stroke / 3;
      const shift = (sign) =>
        i % 2 ? `${sign * offset} 0` : `0 ${sign * offset}`;
      return [-1, 1]
        .map((sign) =>
          stroke(
            d,
            { ...value, stroke: edge.stroke / 3 },
            `transform="translate(${shift(sign)})"`
          )
        )
        .join('');
    };
    const dash =
      style === 'dotted'
        ? Math.max(1, edge.stroke)
        : Math.max(1, edge.stroke * 3);
    const pattern = ['dotted', 'dashed'].includes(style)
      ? `stroke-dasharray="${dash} ${dash}"`
      : '';
    const segment = (from, to) => `M ${from.join(' ')} L ${to.join(' ')}`;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (edge.line === 'bracket' && length > 0) {
      const f = Math.min(edge.gap, length / 2) / length;
      const interpolate = (t) => a.map((v, j) => v + (b[j] - v) * t);
      strokes += paint(
        `${segment(a, interpolate(f))} ${segment(interpolate(1 - f), b)}`,
        edge,
        pattern
      );
    } else {
      strokes += paint(
        segment(a, b),
        edge,
        edge.line === 'gap'
          ? `stroke-dasharray="${edge.gap} ${edge.gap}"`
          : pattern
      );
    }
  }
  return strokes;
}
