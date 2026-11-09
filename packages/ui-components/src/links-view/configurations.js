/** Pure doublet configurations: zero denotes the free reference, names are 1..n. */
export {
  count,
  codeAt,
  indexOf,
  encode,
  decode,
  randomCode,
  addLink,
  removeLink,
  setReference,
  step,
} from './configuration-model.js';
export {
  relabel,
  canonical,
  representatives,
  classCount,
} from './configuration-classes.js';
export {
  configurationMessages,
  parseCode,
  parseTheory,
  formatTheory,
  parsePairs,
  formatPairs,
  parseNumber,
  formatNumber,
  parseDecimal,
  formatDecimal,
  parseLinks,
  formatLinks,
} from './configuration-notations.js';
