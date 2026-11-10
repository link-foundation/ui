/**
 * SVG text helpers shared by the runtime adapters and the icon build
 * (scripts/build-icons.mjs): split an `<svg>` document into the viewBox and
 * a self-contained body, and turn icon data back into an `<svg>`.
 *
 * The body keeps the presentation attributes of the root (`fill`,
 * `stroke`, …) on a wrapping `<g>`, so it renders the same inside any
 * `<svg viewBox>` the element creates.
 */

/** Root attributes that style the drawing and move to the wrapping `<g>`. */
export const PRESENTATION_ATTRIBUTES = Object.freeze([
  'fill',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
]);

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Escape a value for a double-quoted XML attribute. */
export const escapeAttribute = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

/** The end of the start tag that begins at `start` (quotes respected). */
function tagEnd(text, start) {
  let quote = null;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (quote !== null) {
      quote = c === quote ? null : quote;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

/**
 * The attributes of a start tag (`<svg a="1" b='2'>` → Map).
 * @param {string} tag
 * @returns {Map<string, string>}
 */
export function readAttributes(tag) {
  const attributes = new Map();
  const pattern = /([^\s=/<>"']+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1], match[3] ?? match[4]);
  }
  return attributes;
}

/**
 * @typedef {object} SplitSvg
 * @property {string} viewBox
 * @property {string} body  the drawing, wrapped in a `<g>` with the root
 *   presentation attributes when it has any
 * @property {string} [title] the source's accessible title, when present
 */

/**
 * Split an SVG document into its viewBox and a self-contained body.
 * @param {string} text  an `<svg>…</svg>` document
 * @param {{defaults?: Record<string, string>}} [options]  presentation
 *   attributes the root lacks (Material Symbols fill with the text colour)
 * @returns {SplitSvg}
 */
export function splitSvg(text, { defaults = {} } = {}) {
  const start = text.indexOf('<svg');
  const end = start === -1 ? -1 : tagEnd(text, start);
  const close = text.lastIndexOf('</svg>');
  if (end === -1 || close < end) {
    throw new Error('splitSvg: not an <svg> document');
  }
  const root = readAttributes(text.slice(start, end));
  const width = root.get('width') ?? '24';
  const height = root.get('height') ?? '24';
  const viewBox = root.get('viewBox') ?? `0 0 ${width} ${height}`;
  const inner = text.slice(end + 1, close).trim();
  const style = PRESENTATION_ATTRIBUTES.map((name) => [
    name,
    root.get(name) ?? defaults[name],
  ]).filter(([, value]) => value !== undefined);
  const body =
    style.length === 0
      ? inner
      : `<g ${style.map(([n, v]) => `${n}="${escapeAttribute(v)}"`).join(' ')}>${inner}</g>`;
  const title = /<title(?:\s[^>]*)?>([^<]*)<\/title>/.exec(inner)?.[1];
  const decoded = title?.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_, entity) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]
  );
  return { viewBox, body, ...(decoded ? { title: decoded } : {}) };
}

/**
 * An `<svg>` document of icon data, for sprites, downloads and tests.
 * @param {{viewBox: string, body: string}} icon
 * @param {Record<string, string>} [attributes]  extra root attributes
 * @returns {string}
 */
export function iconToSvg(icon, attributes = {}) {
  const extra = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
  return `<svg xmlns="${SVG_NS}" viewBox="${escapeAttribute(icon.viewBox)}"${extra}>${icon.body}</svg>`;
}

/**
 * An `<svg>` document of a Lucide-style icon node
 * (`[['path', {d: '…'}], …]`) with the given root attributes.
 * @param {[string, Record<string, string|number>][]} node
 * @param {Record<string, string|number>} root
 * @returns {string}
 */
export function iconNodeToSvg(node, root) {
  const attrs = (map) =>
    Object.entries(map)
      .filter(([name]) => name !== 'key')
      .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
      .join('');
  const children = node
    .map(([tag, attributes]) => `<${tag}${attrs(attributes)}/>`)
    .join('');
  return `<svg${attrs(root)}>${children}</svg>`;
}
