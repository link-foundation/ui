import { linkColors } from './tokens.js';
import { escapeAttribute } from './markers.js';
import {
  networkShapes,
  networkItemSvg,
  networkDefs,
  networkPointSvg,
  networkLabels,
  networkLabelSvg,
  highlightIds,
} from './network-scene.js';

/** The same markup builder used by the preview, including labels and selection. */
export function networkToSvg(network, positions, style = {}) {
  const {
    width = 640,
    height = 400,
    view = { x: 0, y: 0, k: 1 },
    colors = linkColors(),
    selected = [],
    hovered,
  } = style;
  const shapes = style.shapes ?? networkShapes(network, positions, style.style);
  const highlighted = highlightIds(network, hovered);
  const items = [...shapes.values()]
    .map((shape) =>
      networkItemSvg(
        shape,
        positions,
        colors,
        selected.includes(shape.id),
        highlighted.has(shape.id)
      )
    )
    .join('');
  const points = [...network.points.keys()]
    .map((id) =>
      networkPointSvg(
        id,
        positions.get(id),
        colors,
        selected.includes(id),
        highlighted.has(id)
      )
    )
    .join('');
  const labels = networkLabels(
    network,
    positions,
    view.k,
    style.labels,
    selected
  )
    .map((label) => networkLabelSvg(label, colors))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><defs>${networkDefs(colors)}</defs><rect width="${width}" height="${height}" fill="${escapeAttribute(colors.background)}"></rect><g data-part="view" transform="translate(${view.x} ${view.y}) scale(${view.k})"><g data-part="items">${items}</g><g data-part="points">${points}</g><g data-part="labels">${labels}</g></g></svg>`;
}

/** Rasterize an exported SVG locally; always release the object URL. */
export function networkToPng(
  svg,
  scale = 1,
  {
    document = globalThis.document,
    URL = globalThis.URL,
    Image = globalThis.Image,
  } = {}
) {
  return networkToRaster(svg, { scale, document, URL, Image });
}

function validateRaster({ type, scale, quality, maxPixels }) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) {
    throw new RangeError('Unsupported network raster format');
  }
  if (!(Number.isFinite(scale) && scale > 0)) {
    throw new RangeError('Raster scale must be positive and finite');
  }
  if (!(Number.isFinite(quality) && quality >= 0 && quality <= 1)) {
    throw new RangeError('Raster quality must be between zero and one');
  }
  if (!(Number.isSafeInteger(maxPixels) && maxPixels > 0)) {
    throw new RangeError('Raster pixel limit must be a positive safe integer');
  }
}

/** Encode the same SVG as PNG, JPEG or WebP; JPEG gets an explicit matte.
 * The pixel cap bounds allocation before touching the canvas.
 */
export async function networkToRaster(
  svg,
  {
    type = 'image/png',
    scale = 1,
    quality = 0.92,
    background = '#ffffff',
    maxPixels = 16777216,
    document = globalThis.document,
    URL = globalThis.URL,
    Image = globalThis.Image,
  } = {}
) {
  validateRaster({ type, scale, quality, maxPixels });
  const blob = new globalThis.Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Unable to load network SVG'));
      image.src = url;
    });
    const width = Math.ceil(image.width * scale);
    const height = Math.ceil(image.height * scale);
    if (!(width > 0 && height > 0 && width * height <= maxPixels)) {
      throw new RangeError('Network raster exceeds pixel limit');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (type === 'image/jpeg') {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0, width, height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result?.type === type
            ? resolve(result)
            : reject(new Error(`Raster encoding failed: ${type}`)),
        type,
        quality
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
