/**
 * The value layer of `@link-foundation/ui-core` (#15), exported as `values`:
 * typed values (docs/spec/values.md), units, colours and references.
 */

export { typeValue, typeNode, typeDocument, valueMatches } from './typed.js';
export { inferValue } from './infer.js';
export {
  formatValue,
  parseValue,
  toCss,
  toRaw,
  defaultRefToVar,
} from './format.js';
export {
  parseColor,
  formatColor,
  colorCss,
  oklchToSrgb,
  srgbToOklch,
  toHex,
} from './color.js';
export { parseReference, isReference, sigilDiagnostics } from './refs.js';
export {
  DIMENSION_UNITS,
  DURATION_UNITS,
  isNumber,
  isDimension,
  isDuration,
  isHexColour,
  isUrl,
  isTokenName,
  hasReservedSigil,
  parseNumber,
  parseDimension,
  parseDuration,
  splitQuantity,
} from './scalars.js';
