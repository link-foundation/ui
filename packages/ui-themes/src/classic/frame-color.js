import { values } from '@link-foundation/ui-core';

export function colorCss(text) {
  const parts = text.split(' at ');
  if (parts.length > 2) {
    throw new TypeError(`Invalid frame color: ${text}`);
  }
  const [color, alpha] = parts;
  let css;
  if (
    ['currentColor', 'transparent'].includes(color) ||
    values.typeValue(color, { type: 'color' }).value
  ) {
    css = color;
  } else if (/^[a-zA-Z][\w.-]*$/u.test(color)) {
    css = `var(--color-${color.replaceAll('.', '-')}, currentColor)`;
  } else {
    throw new TypeError(`Invalid frame color: ${text}`);
  }
  if (alpha === undefined) {
    return css;
  }
  if (!/^(?:100|\d{1,2}(?:\.\d+)?)%$/u.test(alpha)) {
    throw new TypeError(`Invalid frame alpha: ${text}`);
  }
  return `color-mix(in srgb, ${css} ${alpha}, transparent)`;
}
