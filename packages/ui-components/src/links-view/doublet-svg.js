import { fmt } from './geometry.js';
import { escapeAttribute } from './markers.js';
import { doubletMarkerSvg } from './doublet-markers.js';

/** Compact pair spelling is unambiguous through id 9; larger ids get commas. */
export function doubletNotation(pairs) {
  return pairs
    .map((pair) =>
      pair.every((id) => id < 10) ? pair.join('') : `(${pair.join(',')})`
    )
    .join(' ');
}
export function doubletCaption(pairs, o, index) {
  const { mode, text } = o.caption;
  if (mode === 'none') {
    return '';
  }
  if (mode === 'custom') {
    return text;
  }
  if (mode === 'number') {
    return index;
  }
  if (mode === 'pairs') {
    return pairs.map((p) => `(${p.join(', ')})`).join(' ');
  }
  if (mode === 'links') {
    return pairs.map((p, i) => `${i + 1}: ${p.join(' ')}`).join('; ');
  }
  return `L = {${pairs.map((p, i) => `${i + 1}=(${p.join(',')})`).join(', ')}}`;
}
function identifier(frame) {
  const text = JSON.stringify([frame.pairs, frame.options, frame.index]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return `doublet-${hash >>> 0}`;
}
function background(o, b, id) {
  const { type, color, color2, angle } = o.background;
  if (type === 'transparent') {
    return { defs: '', body: '' };
  }
  let defs = '';
  const stops = `<stop stop-color="${escapeAttribute(color)}"></stop><stop offset="1" stop-color="${escapeAttribute(color2)}"></stop>`;
  if (type === 'linear') {
    defs = `<linearGradient id="${id}-background" x1="0" x2="1" y1="0.5" y2="0.5" gradientTransform="rotate(${angle} .5 .5)">${stops}</linearGradient>`;
  }
  if (type === 'radial') {
    defs = `<radialGradient id="${id}-background">${stops}</radialGradient>`;
  }
  const fill =
    type === 'solid' ? escapeAttribute(color) : `url(#${id}-background)`;
  return {
    defs,
    body: `<rect data-part="background" width="${b.width}" height="${b.height}" fill="${fill}"></rect>`,
  };
}
function rect(card, b, inset, stroke, width, extra = '') {
  const w = Math.max(0, b.width - 2 * inset),
    h = Math.max(0, b.height - 2 * inset);
  return `<rect x="${inset}" y="${inset}" width="${w}" height="${h}" rx="${Math.min(card.radius, w / 2, h / 2)}" ${stroke ? `fill="none" stroke="${escapeAttribute(card.borderColor)}" stroke-width="${width}"` : `fill="${escapeAttribute(card.color)}" fill-opacity="${card.opacity}"`}${extra ? ` ${extra}` : ''}></rect>`;
}
function cardSvg(o, b) {
  const c = o.card,
    inset = c.inset + c.width / 2;
  let border = '';
  if (c.border !== 'none') {
    if (c.border === 'double') {
      border =
        rect(c, b, inset, true, c.width / 3) +
        rect(c, b, inset + (c.width * 2) / 3, true, c.width / 3);
    } else {
      const dash =
        c.border === 'dashed'
          ? `${c.width * 3} ${c.width * 2}`
          : c.border === 'dotted'
            ? `0 ${c.width * 2}`
            : '';
      border = rect(
        c,
        b,
        inset,
        true,
        c.width,
        `stroke-dasharray="${dash}" stroke-linecap="round"`
      );
    }
  }
  return `<g data-part="card">${rect(c, b, c.inset, false, 0)}${border}</g>`;
}
function captionSvg(frame) {
  const o = frame.options,
    text = doubletCaption(frame.pairs, o, frame.index);
  if (!text) {
    return '';
  }
  const inset =
    o.card.inset + (o.card.border === 'none' ? 0 : o.card.width) + 2;
  const available = Math.max(1, frame.bounds.width - 2 * inset);
  const font = { mono: 'monospace', sans: 'sans-serif', serif: 'serif' }[
    o.caption.font
  ];
  const compress =
    [...text].length * o.caption.size > available
      ? ` textLength="${available}" lengthAdjust="spacingAndGlyphs"`
      : '';
  return `<text data-part="caption" x="${frame.bounds.width / 2}" y="${frame.bounds.height - inset - o.caption.size * 0.3}" text-anchor="middle" font-family="${font}" font-size="${o.caption.size}" fill="${escapeAttribute(o.caption.color)}"${compress}>${escapeAttribute(text)}</text>`;
}
function curveData(visible) {
  const point = (p) => `${fmt(p.x, 8)} ${fmt(p.y, 8)}`;
  let data = '',
    previous;
  visible.forEach((s) => {
    if (!s) {
      return;
    }
    if (!previous || previous.x !== s.p0.x || previous.y !== s.p0.y) {
      data += `M ${point(s.p0)} `;
    }
    data += `C ${point(s.c1)} ${point(s.c2)} ${point(s.p3)} `;
    previous = s.p3;
  });
  return data.trim();
}

/** Deterministic preview/export markup, all measurements in the 100-unit box. */
export function doubletToSvg(frame) {
  const o = frame.options,
    b = frame.bounds,
    id = identifier(frame),
    bg = background(o, b, id);
  const label = `Links network${frame.pairs.length ? ` ${doubletNotation(frame.pairs)}` : ''}`;
  const dash = {
    solid: '',
    dashed: '4 2',
    dotted: '0 2',
    dashdot: '4 2 0 2',
    long: '8 3',
  }[o.dash]
    .split(' ')
    .filter(Boolean)
    .map((v) => Number(v) * o.strokeWidth)
    .join(' ');
  const glow = o.glow
    ? `<filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${o.glow / 3}"></feGaussianBlur><feMerge><feMergeNode></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>`
    : '';
  const items = frame.curves
    .map((curve) => {
      const d = curveData(curve.visible);
      return `<g data-doublet="${curve.id}">${d ? `<path data-link="${curve.id}" d="${d}" fill="none" stroke="currentColor" stroke-width="${o.strokeWidth}" stroke-linecap="${o.linecap}" stroke-dasharray="${dash}"></path>` : ''}${curve.markers.map((p) => doubletMarkerSvg(p, o)).join('')}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${b.width} ${b.height}" role="img" aria-label="${escapeAttribute(label)}"><title>${escapeAttribute(label)}</title><defs>${bg.defs}${glow}</defs>${bg.body}${cardSvg(o, b)}<g data-part="links" color="${escapeAttribute(o.color)}" opacity="${o.opacity}"${o.glow ? ` filter="url(#${id}-glow)"` : ''}>${items}</g>${captionSvg(frame)}</svg>`;
}
