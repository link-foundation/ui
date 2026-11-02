/**
 * @link-foundation/ui-style: style rules written in Links Notation, matched
 * to UI elements, resolved against ui-tokens and written as a CSS
 * stylesheet or as the resolved style of one element.
 *
 * ```js
 * import { readStyles, compileCss, resolveStyle } from '@link-foundation/ui-style';
 *
 * const { rules } = readStyles(text);
 * compileCss(rules); // "ui-button[variant='filled'] {\n  background-color: var(--color-primary);\n ..."
 * resolveStyle(rules, tokens, node, ancestors, { states: ['hover'] }).style;
 * ```
 */

export { readStyles, findCssSyntax } from './read.js';
export { matches, specificity, compareSpecificity, flatten } from './match.js';
export { resolveStyle } from './resolve.js';
export { compileCss, escapeIdentifier, quoteString } from './css.js';
export {
  PROPERTIES,
  isStyleProperty,
  typeDeclaration,
  declarationCss,
} from './properties.js';
export {
  STATES,
  STATE_CSS,
  FEATURES,
  ROOT_FONT_SIZE,
  conditionHolds,
} from './conditions.js';
