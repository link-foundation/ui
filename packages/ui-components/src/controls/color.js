/**
 * Colour values of `color-field`, DOM-free. The native colour picker
 * (`<input type=color>`) reads and writes `#rrggbb`; the text input next
 * to it accepts `#rgb`, `#rrggbb` (with or without `#`, in any case) and
 * shows the normalised form.
 */

const HEX_DIGITS = /^[0-9a-f]+$/;

/**
 * The normalised `#rrggbb` (lower case) of a hex colour text; `null`
 * when it is not one. `#rgb` doubles each digit.
 * @param {unknown} value
 * @returns {string|null}
 */
export function formatHex(value) {
  if (typeof value !== 'string') {
    return null;
  }
  let digits = value.trim().toLowerCase();
  if (digits.startsWith('#')) {
    digits = digits.slice(1);
  }
  if (!HEX_DIGITS.test(digits)) {
    return null;
  }
  if (digits.length === 3) {
    digits = [...digits].map((d) => d + d).join('');
  }
  return digits.length === 6 ? `#${digits}` : null;
}

/**
 * The red, green and blue channels (0–255) of a hex colour; `null` when
 * the text is not one.
 * @param {unknown} value
 * @returns {{r: number, g: number, b: number}|null}
 */
export function parseHex(value) {
  const hex = formatHex(value);
  if (hex === null) {
    return null;
  }
  const channel = (i) => Number.parseInt(hex.slice(i, i + 2), 16);
  return { r: channel(1), g: channel(3), b: channel(5) };
}

/** Hex or CSS integer RGB input, normalized to #rrggbb. */
export function formatColor(value) {
  const hex = formatHex(value);
  if (hex) {
    return hex;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(
    value.trim()
  );
  if (!rgb) {
    return null;
  }
  const channels = rgb.slice(1).map(Number);
  return channels.every((n) => n <= 255)
    ? `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`
    : null;
}
