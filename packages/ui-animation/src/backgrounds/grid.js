import { mountLayer, changed, bounded } from './common.js';

const defaults = {
  cellSize: 64,
  lineWidth: 1,
  markLength: 0.25,
  level: 1,
  pattern: 'lines',
  tint: 'line',
  color: '#7395b8',
  radialFade: false,
  period: 30,
  onDrift: undefined,
};

function background(element, win, o) {
  const token = {
    line: '--color-line',
    accent: '--color-accent',
    'second-accent': '--color-accent-2',
  }[o.tint];
  const color =
    (token && win.getComputedStyle?.(element).getPropertyValue(token).trim()) ||
    o.color;
  const escaped = color
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
  const cell = o.cellSize,
    mark = cell * o.markLength;
  let artwork;
  if (o.pattern === 'dots') {
    artwork = `<circle cx="${cell / 2}" cy="${cell / 2}" r="${o.lineWidth}" fill="${escaped}"/>`;
  } else {
    const center = cell / 2;
    let path = `M0 ${center}H${cell}M${center} 0V${cell}`;
    if (o.pattern === 'crosses') {
      path = `M${center - mark / 2} ${center}h${mark}M${center} ${center - mark / 2}v${mark}`;
    }
    const dash =
      o.pattern === 'dashed' ? `stroke-dasharray="${mark} ${cell - mark}"` : '';
    artwork = `<path d="${path}" stroke="${escaped}" stroke-width="${o.lineWidth}" ${dash}/>`;
  }
  // Original CSS image, offset by half a cell so marks land on grid lines.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}" viewBox="0 0 ${cell} ${cell}">${artwork}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function create(element, win) {
  let o,
    offset = 0,
    dirty = true;
  const pattern = element.ownerDocument.createElement('div');
  element.append?.(pattern);
  function paint() {
    if (!dirty) {
      pattern.style.transform = `translateY(${offset}px)`;
      return;
    }
    dirty = false;
    const cell = o.cellSize;
    Object.assign(element.style, {
      overflow: 'hidden',
      maskImage: o.radialFade
        ? 'radial-gradient(ellipse, #000, transparent 75%)'
        : '',
    });
    Object.assign(pattern.style, {
      position: 'absolute',
      inset: `-${cell}px 0 0`,
      backgroundImage: background(element, win, o),
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${-cell / 2}px ${-cell / 2}px`,
      backgroundRepeat: 'repeat',
      transform: `translateY(${offset}px)`,
      opacity: String(o.level / 4),
    });
  }
  return {
    defaults,
    css: true,
    update(next, before) {
      o = bounded(next, {
        cellSize: [32, 128],
        lineWidth: [0.5, 4],
        markLength: [0.05, 1],
        level: [0, 4],
        period: [0, 120],
      });
      const visual = changed(next, before, [
        'cellSize',
        'lineWidth',
        'markLength',
        'level',
        'pattern',
        'tint',
        'color',
        'radialFade',
      ]);
      dirty ||= visual;
      return visual;
    },
    invalidate() {
      dirty = true;
    },
    resize() {},
    draw(dt, { still }) {
      const cell = o.cellSize;
      if (!still && o.period > 0) {
        offset += (dt * cell) / o.period;
      }
      offset %= cell;
      paint();
      o.onDrift?.(offset);
    },
    dispose() {
      pattern.remove();
    },
  };
}
/** Mount on a positioned div; other layers mount on canvases. */
export const mount = (element, options = {}) =>
  mountLayer(element, options, create);
