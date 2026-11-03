/**
 * A tiny deterministic SVG writer: elements as strings, attributes in the
 * order given, numbers rounded to hundredths, text escaped.
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text escaped for XML content and attribute values. */
export const escapeXml = (text) =>
  String(text).replace(/[&<>"']/gu, (c) => ESCAPES[c]);

/** An attribute value: numbers rounded to hundredths. */
const attrValue = (value) =>
  typeof value === 'number'
    ? String(Math.round(value * 100) / 100)
    : escapeXml(value);

/**
 * One element.
 * @param {string} tag
 * @param {Record<string, string|number|boolean|null|undefined>} [attrs]
 *   `null`, `undefined` and `false` are left out
 * @param {string|string[]} [children]  already written SVG
 */
export function el(tag, attrs = {}, children = []) {
  const parts = Object.entries(attrs)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== false
    )
    .map(([name, value]) => ` ${name}="${attrValue(value)}"`)
    .join('');
  const content = Array.isArray(children) ? children.join('') : children;
  return content === ''
    ? `<${tag}${parts}/>`
    : `<${tag}${parts}>${content}</${tag}>`;
}

/** A text element. */
export const text = (attrs, content) => el('text', attrs, escapeXml(content));

/** A fill or stroke as a style, so CSS custom properties apply. */
export const paint = (name, color) => `${name}:${color}`;

/** The root `<svg>` with its accessible name and description. */
export function svgRoot({ width, height, label, title, className }, children) {
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      class: className,
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': label,
      'font-family': 'system-ui, sans-serif',
    },
    [el('title', {}, escapeXml(title ?? label)), ...children]
  );
}
