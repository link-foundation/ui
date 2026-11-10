/** Validate presentation attributes and apply them to a fresh SVG drawing. */
const LENGTH =
  /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ex|ch|cap|ic|lh|rlh|vw|vh|vmin|vmax|vi|vb|svw|svh|lvw|lvh|dvw|dvh|cm|mm|Q|in|pt|pc)$/;
const TOKEN = /^(?:--)?[a-zA-Z_][a-zA-Z0-9_-]*$/;

export function iconSize(value) {
  if (value === '0' || LENGTH.test(value)) {
    return value;
  }
  if (/^var\(--[a-zA-Z_][a-zA-Z0-9_-]*\)$/.test(value)) {
    return value;
  }
  if (TOKEN.test(value)) {
    return `var(${value.startsWith('--') ? value : `--${value}`})`;
  }
  return undefined;
}

/** Invalid values emit a bubbling event and leave library defaults in place. */
export function applyPresentation(element, svg) {
  const fill = element.getAttribute('fill');
  const width = element.getAttribute('stroke-width');
  const size = element.getAttribute('size');
  const validWidth =
    width !== null &&
    width.trim() !== '' &&
    Number.isFinite(Number(width)) &&
    Number(width) >= 0.5 &&
    Number(width) <= 3;
  const parsedSize = size === null ? undefined : iconSize(size);
  for (const [attribute, value, valid] of [
    ['fill', fill, fill === 'current'],
    ['stroke-width', width, validWidth],
    ['size', size, parsedSize !== undefined],
  ]) {
    if (value !== null && !valid) {
      const detail = { code: 'invalid-icon-presentation', attribute, value };
      element.dispatchEvent(
        new element.ownerDocument.defaultView.CustomEvent(
          'ui-icon-diagnostic',
          { detail, bubbles: true }
        )
      );
    }
  }
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    if (fill === 'current') {
      node.style.fill = 'currentColor';
    }
    if (validWidth) {
      node.style.strokeWidth = String(Number(width));
    }
  }
  return parsedSize;
}
