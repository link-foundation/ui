import { networkToSvg } from './export.js';
import {
  drawNetworkCanvas,
  networkShapes,
  networkItemSvg,
  networkPointSvg,
  networkLabels,
  networkDefs,
  networkLabelSvg,
  highlightIds,
} from './network-scene.js';
import { linkColors, colorVariables } from './tokens.js';

export function networkStyle(node, state) {
  const dark =
    node.getAttribute('theme') === 'dark' ||
    (!node.hasAttribute('theme') &&
      state.win.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const mode = dark ? 'dark' : 'light';
  if (!state.colors.has(mode)) {
    state.colors.set(mode, linkColors({ mode }));
  }
  const colors = { ...state.colors.get(mode) };
  const computed = state.win.getComputedStyle(node);
  for (const [role, variable] of Object.entries(colorVariables())) {
    const value = computed.getPropertyValue(variable).trim();
    if (value) {
      colors[role] = value;
    }
  }
  return {
    width: node.clientWidth || 640,
    height: node.clientHeight || 400,
    colors,
    view: node.view,
    labels: { minZoom: state.config.minZoom },
    selected: [...state.selected],
    hovered: state.hovered,
    style: node.getAttribute('style-mode') ?? state.config.style,
  };
}

const sameMarkup = (node, markup) => node?.outerHTML === markup;

/** Patch only changed items. Stable IDs preserve every unaffected DOM node. */
function patchItems(group, records, markup) {
  const existing = new Map(
    [...group.children].map((el) => [
      el.getAttribute('data-id') ?? el.getAttribute('data-point'),
      el,
    ])
  );
  for (const [id, record] of records) {
    const key = String(id);
    const old = existing.get(key);
    const html = markup(id, record);
    existing.delete(key);
    if (sameMarkup(old, html)) {
      continue;
    }
    const template = group.ownerDocument.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    template.innerHTML = html;
    const next = template.firstElementChild;
    if (old) {
      old.replaceWith(next);
    } else {
      group.append(next);
    }
  }
  for (const old of existing.values()) {
    old.remove();
  }
}

function drawSvg(node, state, style) {
  const { surface, network, positions, shapes } = state;
  const svg = surface.querySelector('svg');
  if (!svg || state.resetSurface) {
    surface.innerHTML = networkToSvg(network, positions, { ...style, shapes });
    state.resetSurface = false;
    return;
  }
  const set = (element, key, value) => {
    if (element.getAttribute(key) !== String(value)) {
      element.setAttribute(key, value);
    }
  };
  set(svg, 'width', style.width);
  set(svg, 'height', style.height);
  set(svg, 'viewBox', `0 0 ${style.width} ${style.height}`);
  const background = svg.querySelector('rect');
  set(background, 'width', style.width);
  set(background, 'height', style.height);
  set(background, 'fill', style.colors.background);
  const defs = svg.querySelector('defs');
  const markers = networkDefs(style.colors);
  if (defs.innerHTML !== markers) {
    defs.innerHTML = markers;
  }
  const v = style.view;
  set(
    svg.querySelector('[data-part="view"]'),
    'transform',
    `translate(${v.x} ${v.y}) scale(${v.k})`
  );
  const highlighted = highlightIds(network, state.hovered);
  patchItems(svg.querySelector('[data-part="items"]'), shapes, (id, shape) =>
    networkItemSvg(
      shape,
      positions,
      style.colors,
      state.selected.has(id),
      highlighted.has(id)
    )
  );
  patchItems(svg.querySelector('[data-part="points"]'), network.points, (id) =>
    networkPointSvg(
      id,
      positions.get(id),
      style.colors,
      state.selected.has(id),
      highlighted.has(id)
    )
  );
  const labels = svg.querySelector('[data-part="labels"]');
  const content = networkLabels(
    network,
    positions,
    v.k,
    style.labels,
    style.selected
  )
    .map((label) => networkLabelSvg(label, style.colors))
    .join('');
  if (labels.innerHTML !== content) {
    labels.innerHTML = content;
  }
}

/** Rasterize a static world tile so pan only moves a cached bitmap.
 * Zoom, geometry, labels, selection and colours invalidate it. Tile dimensions
 * stay within 4096 pixels per side to bound memory on large viewports.
 */
function canvasTile(node, state, style) {
  const key = JSON.stringify([
    style.colors,
    style.view.k,
    style.selected,
    style.hovered,
    style.labels,
  ]);
  if (state.tile?.shapes === state.shapes && state.tile.key === key) {
    return state.tile;
  }
  let minX = 0,
    minY = 0,
    maxX = style.width,
    maxY = style.height;
  for (const shape of state.shapes.values()) {
    for (const point of shape.geometry.points) {
      minX = Math.min(minX, point.x - 64);
      minY = Math.min(minY, point.y - 64);
      maxX = Math.max(maxX, point.x + 128);
      maxY = Math.max(maxY, point.y + 64);
    }
  }
  const width = maxX - minX,
    height = maxY - minY;
  const resolution = Math.min(
    (state.win.devicePixelRatio || 1) * style.view.k,
    4096 / width,
    4096 / height
  );
  const canvas = state.win.document.createElement('canvas');
  canvas.width = Math.ceil(width * resolution);
  canvas.height = Math.ceil(height * resolution);
  drawNetworkCanvas(
    canvas.getContext('2d'),
    state.shapes,
    state.network,
    state.positions,
    {
      ...style,
      width,
      height,
      view: { x: -minX, y: -minY, k: 1 },
      pixelRatio: resolution,
      labels: {
        minZoom: style.labels.minZoom / style.view.k,
        padding: 2 / style.view.k,
      },
      Path2D: state.win.Path2D,
    }
  );
  state.tile = { key, shapes: state.shapes, canvas, minX, minY, width, height };
  return state.tile;
}

export function drawNetwork(node, state) {
  const style = networkStyle(node, state);
  if (state.shapesDirty) {
    state.shapes = networkShapes(
      state.network,
      state.positions,
      style.style,
      state.shapes
    );
    state.shapesDirty = false;
  }
  const renderer = state.network.links.size > 2000 ? 'canvas' : 'svg';
  if (renderer === 'svg') {
    drawSvg(node, state, style);
  } else {
    let canvas = state.surface.querySelector('canvas');
    if (!canvas) {
      canvas = state.win.document.createElement('canvas');
      state.surface.replaceChildren(canvas);
    }
    const ratio = state.win.devicePixelRatio || 1;
    if (canvas.width !== style.width * ratio) {
      canvas.width = style.width * ratio;
    }
    if (canvas.height !== style.height * ratio) {
      canvas.height = style.height * ratio;
    }
    const tile = canvasTile(node, state, style);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = style.colors.background;
    ctx.fillRect(0, 0, style.width, style.height);
    ctx.transform(style.view.k, 0, 0, style.view.k, style.view.x, style.view.y);
    ctx.drawImage(tile.canvas, tile.minX, tile.minY, tile.width, tile.height);
  }
  state.drawn = { renderer, links: state.network.links.size, view: style.view };
  node.dispatchEvent(
    new state.win.CustomEvent('networkdraw', { detail: state.drawn })
  );
}
