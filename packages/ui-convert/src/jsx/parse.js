/**
 * JSX / TSX markup -> the intermediate form of the HTML importer
 * (`html/tree.js`).
 *
 * The module is parsed with `@babel/parser` (plugins `jsx` and, by default,
 * `typescript`); the code is never run. Every outermost JSX element or
 * fragment of the module is a top-level node, in source order, so a file
 * with a component `function Login() { return <Stack>...</Stack> }` gives
 * the `Stack` element. JSX nested inside an expression (`items.map(...)`,
 * `icon={<SaveIcon />}`) stays part of that expression.
 *
 * A node keeps:
 *
 * - `tag`: the component or element name as written (`Button`,
 *   `Foo.Bar`, `div`); `#text` for text and `#expression` for an
 *   expression child (`{items.map(...)}`), whose `text` is the source;
 * - `attrs`: `[name, value]` for every attribute: the literal value, or the
 *   source text of the expression;
 * - `props`: the attributes with their kind (`literal`, `identifier`,
 *   `expression`, `spread`), source text, span and Babel expression node;
 * - `span`: `{ start, end }` source offsets.
 *
 * TypeScript assertions around a value (`save as () => void`, `value!`,
 * `x satisfies T`) are read as the value.
 *
 * Fragments (`<>...</>`, `<React.Fragment>`) are flattened into their
 * parent. Text follows the JSX whitespace rules (React and Babel).
 */

import { parse } from '@babel/parser';
import { literalText } from '../components/expression.js';
import { TEXT } from '../html/tree.js';

/** The tag of an expression child: `{items.map(...)}`. */
export const EXPRESSION = '#expression';

/** The tag of the root container `parseJsx` returns. */
export const FRAGMENT = '#fragment';

/**
 * @typedef {import('../html/tree.js').Span} Span
 * @typedef {{
 *   name: string | null,
 *   kind: 'literal' | 'identifier' | 'expression' | 'spread',
 *   value?: string,
 *   source: string,
 *   span: Span,
 *   expression?: any,
 * }} JsxProp
 * @typedef {import('../html/tree.js').HtmlNode & { props?: JsxProp[] }} JsxNode
 */

const SKIPPED_KEYS = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'comments',
  'tokens',
]);

/** TypeScript wrappers that do not change the value of an expression. */
const TYPE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

/** An expression without its type assertions: `save as () => void` -> `save`. */
const withoutTypes = (node) =>
  TYPE_WRAPPERS.has(node?.type) ? withoutTypes(node.expression) : node;

const isJsx = (node) =>
  node?.type === 'JSXElement' || node?.type === 'JSXFragment';

/** Every outermost JSX element or fragment under a Babel node. */
function outermostJsx(node, found = []) {
  if (isJsx(node)) {
    found.push(node);
    return found;
  }
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key) || !value || typeof value !== 'object') {
      continue;
    }
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child.type === 'string') {
        outermostJsx(child, found);
      }
    }
  }
  return found;
}

const spanOf = (node) => ({ start: node.start, end: node.end });

/** The name of a JSX tag or attribute as written. */
function nameText(name) {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXNamespacedName':
      return `${name.namespace.name}:${name.name.name}`;
    case 'JSXMemberExpression':
      return `${nameText(name.object)}.${nameText(name.property)}`;
    default:
      return 'element';
  }
}

const FRAGMENT_NAMES = new Set(['Fragment', 'React.Fragment']);

/** Collapse JSX text like React: lines trimmed, blank lines dropped. */
export function cleanJsxText(text) {
  const lines = text
    .split('\r\n')
    .join('\n')
    .split('\r')
    .join('\n')
    .split('\n');
  let last = -1;
  lines.forEach((line, i) => {
    if (line.trim() !== '') {
      last = i;
    }
  });
  let out = '';
  lines.forEach((raw, i) => {
    let line = raw.split('\t').join(' ');
    if (i > 0) {
      line = line.trimStart();
    }
    if (i < lines.length - 1) {
      line = line.trimEnd();
    }
    if (line !== '') {
      out += i === last ? line : `${line} `;
    }
  });
  return out;
}

class JsxReader {
  constructor(text) {
    this.text = text;
  }

  source(node) {
    return this.text.slice(node.start, node.end);
  }

  /** One attribute as a prop. */
  prop(attribute) {
    const span = spanOf(attribute);
    if (attribute.type === 'JSXSpreadAttribute') {
      return {
        name: null,
        kind: 'spread',
        source: this.source(attribute),
        span,
        expression: attribute.argument,
      };
    }
    const name = nameText(attribute.name);
    const { value } = attribute;
    if (value === null) {
      return { name, kind: 'literal', value: 'true', source: name, span };
    }
    if (value.type === 'StringLiteral') {
      return { name, kind: 'literal', value: value.value, source: name, span };
    }
    const expression = withoutTypes(
      value.type === 'JSXExpressionContainer' ? value.expression : value
    );
    const literal = literalText(expression);
    if (literal !== undefined) {
      return { name, kind: 'literal', value: literal, source: name, span };
    }
    return {
      name,
      kind: expression.type === 'Identifier' ? 'identifier' : 'expression',
      source: this.source(expression),
      span,
      expression,
    };
  }

  /** The children of a JSX element or fragment, fragments flattened. */
  children(nodes) {
    const out = [];
    for (const child of nodes) {
      out.push(...this.node(child));
    }
    return out;
  }

  /** One JSX child as zero or more intermediate nodes. */
  node(node) {
    const span = spanOf(node);
    switch (node.type) {
      case 'JSXText': {
        const text = cleanJsxText(node.value);
        return text === ''
          ? []
          : [{ tag: TEXT, attrs: [], children: [], text, span }];
      }
      case 'JSXExpressionContainer':
      case 'JSXSpreadChild':
        return this.expressionChild(node, span);
      case 'JSXFragment':
        return this.children(node.children);
      default:
        return this.element(node, span);
    }
  }

  expressionChild(node, span) {
    const { expression } = node;
    if (expression.type === 'JSXEmptyExpression') {
      return [];
    }
    if (node.type !== 'JSXSpreadChild' && isJsx(expression)) {
      return this.node(expression);
    }
    const literal =
      node.type === 'JSXSpreadChild' ? undefined : literalText(expression);
    if (literal !== undefined) {
      return literal === ''
        ? []
        : [{ tag: TEXT, attrs: [], children: [], text: literal, span }];
    }
    return [
      {
        tag: EXPRESSION,
        attrs: [],
        children: [],
        text: this.source(node),
        span,
      },
    ];
  }

  element(node, span) {
    const tag = nameText(node.openingElement.name);
    const props = node.openingElement.attributes.map((a) => this.prop(a));
    const children = this.children(node.children);
    if (FRAGMENT_NAMES.has(tag) && props.every((p) => p.name === 'key')) {
      return children;
    }
    return [
      {
        tag,
        attrs: props
          .filter((p) => p.name !== null)
          .map((p) => [p.name, p.kind === 'literal' ? p.value : p.source]),
        props,
        children,
        span,
      },
    ];
  }
}

/**
 * Parse JSX or TSX source.
 *
 * Returns a `#fragment` container whose children are the top-level nodes,
 * and the syntax errors Babel recovered from (`{ message, span }`). An
 * unrecoverable syntax error throws a `SyntaxError` with `span`.
 *
 * @param {string} text
 * @param {{ typescript?: boolean }} [options] `typescript: false` parses
 *   plain JSX (default: TSX, which also reads plain JSX)
 * @returns {JsxNode & { errors: { message: string, span: Span }[] }}
 */
export function parseJsx(text, options = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('parseJsx expects JSX text (a string)');
  }
  const plugins =
    options.typescript === false ? ['jsx'] : ['jsx', 'typescript'];
  let ast;
  try {
    ast = parse(text, {
      sourceType: 'module',
      plugins,
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    });
  } catch (error) {
    const at = error.pos ?? 0;
    const failure = new SyntaxError(error.message);
    failure.span = { start: at, end: at };
    throw failure;
  }
  const reader = new JsxReader(text);
  return {
    tag: FRAGMENT,
    attrs: [],
    children: reader.children(outermostJsx(ast.program)),
    span: { start: 0, end: text.length },
    errors: (ast.errors ?? []).map((error) => ({
      message: error.message,
      span: { start: error.pos, end: error.pos },
    })),
  };
}
