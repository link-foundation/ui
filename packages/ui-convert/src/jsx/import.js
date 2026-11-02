/**
 * JSX / TSX -> UI dialect of Links Notation.
 *
 * `parseJsx` reads the markup; this module sorts every attribute into what
 * it becomes and hands the component nodes to the shared importer
 * (`components/import.js`), which maps them with the rule files (MUI by
 * default) and formats the result with `@link-foundation/ui-core`.
 *
 * - string, number and boolean props are literal values;
 * - `style` and `sx` objects whose values are all literal become
 *   `(style ...)`; `style` numbers get `px` like React;
 * - `onClick={save}` (an identifier) becomes `(on press (action save))`;
 * - anything else that needs the code to run (a spread, an inline arrow
 *   handler, a variable, `{items.map(...)}` children, a theme callback in
 *   `sx`) becomes `(unsupported jsx-expression '<source>')` with one
 *   `unsupported-jsx-expression` diagnostic.
 */

import { styleDeclarations } from '../components/expression.js';
import { jsxEvent } from '../components/events.js';
import {
  UNSUPPORTED,
  actionLink,
  importComponents,
  unsupportedProp,
} from '../components/import.js';
import { TEXT } from '../html/tree.js';
import { EXPRESSION, parseJsx } from './parse.js';

const CONSTRUCT = 'jsx-expression';

/** Why a JSX expression attribute is not imported. */
function reason(prop, event) {
  if (prop.kind === 'spread') {
    return 'spread props need the code to run';
  }
  if (event) {
    return `the ${prop.name} handler is not a plain identifier`;
  }
  if (prop.name === 'style' || prop.name === 'sx') {
    return `${prop.name} is not an object of literal values`;
  }
  return `the value of ${prop.name} is computed by code`;
}

class JsxConverter {
  constructor(text) {
    this.text = text;
  }

  source(span) {
    return this.text.slice(span.start, span.end);
  }

  /** One JSX prop as a component prop. */
  prop(prop) {
    if (prop.kind === 'literal') {
      return {
        kind: 'literal',
        name: prop.name,
        value: prop.value,
        span: prop.span,
      };
    }
    const event = prop.name === null ? null : jsxEvent(prop.name);
    if (event && prop.kind === 'identifier') {
      return {
        kind: 'link',
        link: actionLink(event, prop.source),
        span: prop.span,
      };
    }
    if (prop.name === 'style' || prop.name === 'sx') {
      const declarations = styleDeclarations(prop.expression, {
        px: prop.name === 'style',
      });
      if (declarations) {
        return { kind: 'style', declarations, span: prop.span };
      }
    }
    const source = this.source(prop.span);
    return unsupportedProp(
      CONSTRUCT,
      source,
      prop.span,
      `Unsupported JSX expression ${source}: ${reason(prop, event)}`
    );
  }

  /** One node of `parseJsx` as a component node. */
  node(node) {
    if (node.tag === TEXT) {
      return { tag: TEXT, text: node.text, span: node.span };
    }
    if (node.tag === EXPRESSION) {
      return {
        tag: UNSUPPORTED,
        ...unsupportedProp(
          CONSTRUCT,
          node.text,
          node.span,
          `Unsupported JSX expression ${node.text}: children computed by code`
        ),
      };
    }
    return {
      tag: node.tag,
      props: (node.props ?? []).map((prop) => this.prop(prop)),
      children: node.children.map((child) => this.node(child)),
      span: node.span,
    };
  }
}

/**
 * Import JSX or TSX markup.
 *
 * Returns `{ text, tree, links, spans, applied, diagnostics }` like
 * `importHtml`; `applied` maps link ids to the name of the mapping rule
 * that produced them. A syntax error Babel cannot recover from gives an
 * empty document and a `syntax-error` diagnostic.
 *
 * @param {string} text
 * @param {import('../index.js').ImportComponentOptions & { typescript?: boolean }} [options]
 */
export function importJsx(text, options = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('importJsx expects JSX text (a string)');
  }
  let root;
  try {
    root = parseJsx(text, options);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    root = { children: [], errors: [error] };
  }
  const converter = new JsxConverter(text);
  const result = importComponents(
    root.children.map((node) => converter.node(node)),
    options
  );
  const syntax = root.errors.map((error) => ({
    code: 'syntax-error',
    severity: 'error',
    message: error.message,
    span: error.span,
    id: null,
  }));
  return { ...result, diagnostics: [...syntax, ...result.diagnostics] };
}
