/**
 * Vue single-file components -> UI dialect of Links Notation.
 *
 * `parseVue` reads the blocks and the template; this module turns the
 * attributes and directives of the template into component props and hands
 * them to the shared importer (`components/import.js`):
 *
 * | Template                         | Link                                  |
 * | -------------------------------- | ------------------------------------- |
 * | `label="Email"`                  | a prop, matched by the mapping rules  |
 * | `:count="2"`, `:label="'Save'"`  | a prop (the value is a literal)       |
 * | `:value="draft.text"`            | `(bind value (param draft.text))`     |
 * | `v-model="draft.text"`           | `(bind value (param draft.text))`     |
 * | `:style="{ color: 'red' }"`      | `(style (color red))`                 |
 * | `@click="save"`                  | `(on press (action save))`            |
 * | `v-if="ok"`                      | `(when (param ok))`                   |
 * | `v-else` (after `v-if="ok"`)     | `(when (not (param ok)))`             |
 * | `v-for="item in items"`          | `(each item (param items))`           |
 * | `v-for="(item, i) in items"`     | `(each item (param items) (index i))` |
 *
 * Values must be names or dotted paths (`draft.text`) and handlers plain
 * names. Every other directive or expression (`@click="save(1)"`,
 * `v-else-if`, `v-show`, `v-slot`, modifiers such as `.prevent`) is kept as
 * `(unsupported vue-directive '<source>')`, and an interpolation
 * `{{ name }}` as `(unsupported vue-expression '{{ name }}')`, each with
 * one diagnostic. `<script>`, `<style>` and custom blocks are kept as raw
 * `vue-block` links with an `info` diagnostic each.
 */

import { Link } from 'links-notation';
import {
  literalText,
  pathText,
  readExpression,
  styleDeclarations,
} from '../components/expression.js';
import { eventName } from '../components/events.js';
import {
  RAW,
  UNSUPPORTED,
  actionLink,
  importComponents,
  paramLink,
  unsupportedProp,
} from '../components/import.js';
import { TEXT } from '../html/tree.js';
import { EXPRESSION } from '../jsx/parse.js';
import { parseVue } from './parse.js';

const atom = (text) => new Link(text);
const link = (...items) =>
  new Link(
    null,
    items.map((item) => (typeof item === 'string' ? atom(item) : item))
  );

const DIRECTIVE = 'vue-directive';

/** The dotted path of a directive value, or `undefined`. */
const pathOf = (exp) =>
  exp === undefined ? undefined : pathText(readExpression(exp));

const isName = (text) => {
  const expression = readExpression(text);
  return expression?.type === 'Identifier' && expression.name === text.trim();
};

const unsupported = (prop, why) =>
  unsupportedProp(
    DIRECTIVE,
    prop.source,
    prop.span,
    `Unsupported Vue directive ${prop.source}: ${why}`
  );

/** A plain directive: a static argument and no modifiers. */
const plain = (prop) => !prop.dynamicArg && prop.modifiers.length === 0;

/** `:name="..."`: a literal, a style object or a binding. */
function bindProp(prop) {
  if (!prop.arg || !plain(prop)) {
    return unsupported(prop, 'only :name="value" is imported');
  }
  const expression = readExpression(prop.exp ?? '');
  const literal = literalText(expression);
  if (literal !== undefined) {
    return { kind: 'literal', name: prop.arg, value: literal, span: prop.span };
  }
  if (prop.arg === 'style') {
    const declarations = styleDeclarations(expression);
    if (declarations) {
      return { kind: 'style', declarations, span: prop.span };
    }
  }
  const path = pathText(expression);
  return path === undefined
    ? unsupported(prop, 'the value is computed by code')
    : { kind: 'link', link: link('bind', prop.arg, paramLink(path)) };
}

/** `v-for="item in items"` or `v-for="(item, i) in items"`. */
function forProp(prop) {
  const path = pathOf(prop.iterable);
  const alias = prop.alias ?? [];
  if (
    path === undefined ||
    alias.length === 0 ||
    alias.length > 2 ||
    !alias.every(isName)
  ) {
    return unsupported(prop, 'only "item in path" and "(item, i) in path"');
  }
  const each = link('each', alias[0], paramLink(path));
  if (alias[1]) {
    each.values.push(link('index', alias[1]));
  }
  return { kind: 'link', link: each };
}

/** `@event="name"`. */
function onProp(prop) {
  if (!prop.arg || !plain(prop) || !isName(prop.exp ?? '')) {
    return unsupported(prop, 'only @event="handlerName" is imported');
  }
  return {
    kind: 'link',
    link: actionLink(eventName(prop.arg), prop.exp.trim()),
  };
}

class VueConverter {
  /** One attribute or directive as a component prop. */
  prop(prop, node, context) {
    if (prop.kind === 'attribute') {
      const value = prop.value ?? (node.component ? 'true' : '');
      return { kind: 'literal', name: prop.name, value, span: prop.span };
    }
    switch (prop.name) {
      case 'bind':
        return bindProp(prop);
      case 'on':
        return onProp(prop);
      case 'for':
        return forProp(prop);
      case 'if':
        return this.ifProp(prop, context);
      case 'else':
        return context.condition === undefined
          ? unsupported(prop, 'the v-if before it is not a plain path')
          : {
              kind: 'link',
              link: link('when', link('not', paramLink(context.condition))),
            };
      case 'model':
        return plain(prop) && !prop.arg && pathOf(prop.exp) !== undefined
          ? {
              kind: 'link',
              link: link('bind', 'value', paramLink(pathOf(prop.exp))),
            }
          : unsupported(prop, 'only v-model="path" is imported');
      default:
        return unsupported(prop, 'this directive has no dialect link');
    }
  }

  ifProp(prop, context) {
    const path = pathOf(prop.exp);
    context.next = path;
    return path === undefined
      ? unsupported(prop, 'the condition is computed by code')
      : { kind: 'link', link: link('when', paramLink(path)) };
  }

  /** The template children with `v-if` / `v-else` pairs. */
  children(nodes) {
    const context = { condition: undefined, next: undefined };
    return nodes.map((node) => {
      const out = this.node(node, context);
      context.condition = context.next;
      context.next = undefined;
      return out;
    });
  }

  node(node, context) {
    if (node.tag === TEXT) {
      return { tag: TEXT, text: node.text, span: node.span };
    }
    if (node.tag === EXPRESSION) {
      return {
        tag: UNSUPPORTED,
        ...unsupportedProp(
          'vue-expression',
          node.text,
          node.span,
          `Unsupported Vue interpolation ${node.text}: the text is computed by code`
        ),
      };
    }
    return {
      tag: node.tag,
      component: node.component,
      props: node.props.map((prop) => this.prop(prop, node, context)),
      children: this.children(node.children),
      span: node.span,
    };
  }
}

/** The lines of a block, without blank lines at the start and the end. */
function contentLines(content) {
  const lines = content.split('\r\n').join('\n').split('\n');
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines.at(-1).trim() === '') {
    lines.pop();
  }
  return lines;
}

const BLOCK_CODES = { script: 'vue-script', style: 'vue-style' };

/** A `<script>`, `<style>` or custom block as a raw `vue-block` link. */
function blockNode(block) {
  const lines = contentLines(block.content);
  return {
    tag: RAW,
    kind: 'vue-block',
    stem: block.tag,
    span: block.span,
    items: [
      link('tag', block.tag),
      ...block.attrs.map(([name, value]) =>
        value === '' ? link('attr', name) : link('attr', name, value)
      ),
      ...(lines.length > 0 ? [link('content', ...lines)] : []),
    ],
    diagnostic: {
      code: BLOCK_CODES[block.tag] ?? 'vue-block',
      severity: 'info',
      message: `The <${block.tag}> block is kept as raw text; its code is not imported`,
    },
  };
}

/**
 * Import a Vue single-file component.
 *
 * Returns `{ text, tree, links, spans, applied, diagnostics }` like
 * `importJsx`. The template's top-level nodes and the other blocks are the
 * top-level links, in source order.
 *
 * @param {string} text
 * @param {import('../index.js').ImportComponentOptions} [options]
 */
export function importVue(text, options = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('importVue expects the text of a .vue file (a string)');
  }
  const sfc = parseVue(text);
  const roots = [
    ...new VueConverter().children(sfc.template.children),
    ...[...sfc.script, ...sfc.styles, ...sfc.blocks].map(blockNode),
  ].sort((a, b) => a.span.start - b.span.start);
  const result = importComponents(roots, options);
  const syntax = sfc.errors.map((error) => ({
    code: 'syntax-error',
    severity: 'error',
    message: error.message,
    span: error.span,
    id: null,
  }));
  return { ...result, diagnostics: [...syntax, ...result.diagnostics] };
}
