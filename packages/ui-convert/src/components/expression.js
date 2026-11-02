/**
 * Reading JavaScript expressions of JSX attributes and Vue directives
 * without running them: literals, dotted paths and object literals of
 * literal values (`style`, `sx`, `:style`). Expressions are Babel AST nodes.
 */

import { parseExpression } from '@babel/parser';

/**
 * The text of a literal expression (`'a'`, `2`, `-1`, `true`, a template
 * without expressions, also inside `as` / `satisfies` / parentheses), or
 * `undefined`.
 * @param {any} expression
 * @returns {string | undefined}
 */
export function literalText(expression) {
  switch (expression?.type) {
    case 'StringLiteral':
      return expression.value;
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return String(expression.value);
    case 'TemplateLiteral':
      return expression.expressions.length === 0
        ? expression.quasis[0].value.cooked
        : undefined;
    case 'UnaryExpression':
      return expression.operator === '-' &&
        expression.argument.type === 'NumericLiteral'
        ? String(-expression.argument.value)
        : undefined;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return literalText(expression.expression);
    default:
      return undefined;
  }
}

/**
 * The dotted path of an identifier or a chain of non-computed member
 * accesses (`draft.text`), or `undefined`.
 * @param {any} expression
 * @returns {string | undefined}
 */
export function pathText(expression) {
  if (expression?.type === 'Identifier') {
    return expression.name;
  }
  if (
    expression?.type === 'MemberExpression' &&
    !expression.computed &&
    expression.property.type === 'Identifier'
  ) {
    const object = pathText(expression.object);
    return object === undefined
      ? undefined
      : `${object}.${expression.property.name}`;
  }
  return undefined;
}

/**
 * Parse the source of one expression (a Vue directive value), or `null`
 * when it is not one expression.
 * @param {string} source
 */
export function readExpression(source) {
  try {
    return parseExpression(source, { plugins: ['typescript'] });
  } catch {
    return null;
  }
}

/** CSS properties whose numbers React writes without `px`. */
const UNITLESS = new Set([
  'animationIterationCount',
  'aspectRatio',
  'borderImageOutset',
  'borderImageSlice',
  'borderImageWidth',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexPositive',
  'flexShrink',
  'flexNegative',
  'flexOrder',
  'gridArea',
  'gridRow',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'fontWeight',
  'lineClamp',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
  'fillOpacity',
  'floodOpacity',
  'stopOpacity',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
]);

const isUpper = (c) => c >= 'A' && c <= 'Z';

/**
 * A camelCase style key as a CSS property name: `backgroundColor` ->
 * `background-color`, `WebkitTransition` -> `-webkit-transition`,
 * `msFlex` -> `-ms-flex`; custom properties (`--x`) and names that are
 * already kebab-case stay as they are.
 * @param {string} key
 */
export function cssName(key) {
  if (key.startsWith('--')) {
    return key;
  }
  let out = key.startsWith('ms') && isUpper(key[2] ?? '') ? '-' : '';
  for (const c of key) {
    out += isUpper(c) ? `-${c.toLowerCase()}` : c;
  }
  return out;
}

const keyText = (property) => {
  if (property.computed) {
    return undefined;
  }
  const { key } = property;
  if (key.type === 'Identifier') {
    return key.name;
  }
  return key.type === 'StringLiteral' || key.type === 'NumericLiteral'
    ? String(key.value)
    : undefined;
};

/**
 * The declarations of an object literal whose keys and values are all
 * literal: `{ backgroundColor: 'red', padding: 8 }` ->
 * `[['background-color', 'red'], ['padding', '8px']]`, or `null` when any
 * part is not literal (a spread, a nested object, a function, a variable).
 *
 * With `px` (React `style`), numbers get `px` unless the property is
 * unitless or the number is 0; without it (MUI `sx`, whose numbers are
 * theme units) numbers stay as written.
 * @param {any} expression
 * @param {{ px?: boolean }} [options]
 * @returns {[string, string][] | null}
 */
export function styleDeclarations(expression, options = {}) {
  if (expression?.type !== 'ObjectExpression') {
    return null;
  }
  const declarations = [];
  for (const property of expression.properties) {
    if (property.type !== 'ObjectProperty') {
      return null;
    }
    const key = keyText(property);
    const value = literalText(property.value);
    if (key === undefined || value === undefined || value === '') {
      return null;
    }
    const number = property.value.type === 'NumericLiteral';
    const unit =
      options.px && number && value !== '0' && !UNITLESS.has(key) ? 'px' : '';
    declarations.push([cssName(key), `${value.trim()}${unit}`]);
  }
  return declarations;
}
