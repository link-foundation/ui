/** RGB triplets for CSS rgb(var(--chosen-rgb) / alpha). Alpha is supplied by CSS. */
export function hexToChannels(hex) {
  if (
    typeof hex !== 'string' ||
    !/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.test(hex)
  ) {
    throw new TypeError('Expected a hexadecimal color');
  }
  const text =
    hex.length <= 5
      ? [...hex.slice(1)].map((c) => c + c).join('')
      : hex.slice(1);
  return [0, 2, 4]
    .map((offset) => Number.parseInt(text.slice(offset, offset + 2), 16))
    .join(' ');
}
