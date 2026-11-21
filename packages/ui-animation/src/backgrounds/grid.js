import { mountLayer, changed, bounded, wrapGrid } from './common.js';

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
  drift: undefined,
  originX: 0,
  originY: 0,
  tokens: undefined,
};

const defaultTokens = {
  line: '--color-line',
  accent: '--color-accent',
  'second-accent': '--color-accent-2',
};

function mask(o) {
  const cell = o.cellSize,
    mark = cell * o.markLength;
  let artwork;
  if (o.pattern === 'dots') {
    artwork = `<circle cx="${cell / 2}" cy="${cell / 2}" r="${o.lineWidth}" fill="white"/>`;
  } else {
    const center = cell / 2;
    let path = `M0 ${center}H${cell}M${center} 0V${cell}`;
    if (o.pattern === 'crosses') {
      path = `M${center - mark / 2} ${center}h${mark}M${center} ${center - mark / 2}v${mark}`;
    }
    const dash =
      o.pattern === 'dashed' ? `stroke-dasharray="${mark} ${cell - mark}"` : '';
    artwork = `<path d="${path}" stroke="white" stroke-width="${o.lineWidth}" ${dash}/>`;
  }
  // Original CSS image, offset by half a cell so marks land on grid lines.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}" viewBox="0 0 ${cell} ${cell}">${artwork}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function create(element) {
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
    const colorToken = o.tokens?.[o.tint] ?? defaultTokens[o.tint];
    const alphaToken = o.tokens?.alpha;
    Object.assign(element.style, {
      overflow: 'hidden',
      maskImage: o.radialFade
        ? 'radial-gradient(ellipse, #000, transparent 75%)'
        : '',
    });
    Object.assign(pattern.style, {
      position: 'absolute',
      inset: `-${cell}px 0 0`,
      backgroundColor: colorToken ? `var(${colorToken}, ${o.color})` : o.color,
      maskImage: mask(o),
      maskSize: `${cell}px ${cell}px`,
      maskPosition: `${wrapGrid(o.originX, cell) - cell / 2}px ${wrapGrid(o.originY, cell) - cell / 2}px`,
      maskRepeat: 'repeat',
      transform: `translateY(${offset}px)`,
      opacity: alphaToken
        ? `calc(${o.level / 4} * var(${alphaToken}, 1))`
        : String(o.level / 4),
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
        'originX',
        'originY',
        'tokens',
      ]);
      dirty ||= visual;
      return visual || next.drift !== before.drift;
    },
    invalidate() {
      dirty = true;
    },
    resize() {},
    draw(dt, { still }) {
      const cell = o.cellSize;
      if (Number.isFinite(o.drift)) {
        offset = wrapGrid(o.drift, cell);
      } else if (!still && o.period > 0) {
        offset = wrapGrid(offset + (dt * cell) / o.period, cell);
      } else {
        offset = wrapGrid(offset, cell);
      }
      paint();
      o.onDrift?.(offset);
    },
    dispose() {
      pattern.remove();
    },
  };
}
/** Convert a host clock in milliseconds to a one-cell phase. */
export function gridOffset(time, cellSize, period) {
  return period > 0 ? (wrapGrid(time, period) / period) * cellSize : 0;
}

/** Mount on a positioned div; other layers mount on canvases. */
export const mount = (element, options = {}) =>
  mountLayer(element, options, create);
