/**
 * Vue single-file components -> blocks and the intermediate form of the
 * HTML importer (`html/tree.js`).
 *
 * The file is read by `@vue/compiler-dom` (`parseMode: 'sfc'`), the
 * template parser of Vue itself, so directives (`v-if`, `@click`, `:prop`)
 * and interpolations (`{{ name }}`) are read the way Vue reads them; no code
 * is compiled or run. The `meta-language` HTML import has no element tree in
 * its npm release (0.46.0), see the README of this package.
 *
 * `parseVue(text)` returns:
 *
 * - `template`: a `#fragment` node whose children are the nodes of the first
 *   `<template>` block. An element keeps `tag` as written, `attrs`
 *   (`[rawName, value]` of every attribute and directive, as in the source),
 *   `props` (the attributes and directives with their parts and spans),
 *   `component` (whether Vue reads the tag as a component) and `span`; text
 *   is `#text` (entities decoded, whitespace condensed by Vue) and an
 *   interpolation is `#expression` with its source text. Comments are not
 *   kept.
 * - `script`, `styles`, `blocks`: the `<script>` blocks, the `<style>`
 *   blocks and every other top-level block (`<i18n>`, ...), each as
 *   `{ tag, attrs, content, span }` with the raw content.
 * - `errors`: `{ message, span }` of the syntax errors Vue reported.
 */

import { parse } from '@vue/compiler-dom';
import { TEXT } from '../html/tree.js';
import { EXPRESSION, FRAGMENT } from '../jsx/parse.js';

/** @vue/compiler-dom node types. */
const ELEMENT = 1;
const TEXT_NODE = 2;
const INTERPOLATION = 5;
const ATTRIBUTE = 6;

/** @vue/compiler-dom element tag types. */
const COMPONENT = 1;

const spanOf = (loc) => ({ start: loc.start.offset, end: loc.end.offset });

/**
 * @typedef {import('../html/tree.js').Span} Span
 * @typedef {{
 *   kind: 'attribute' | 'directive',
 *   name: string,
 *   rawName: string,
 *   value?: string,
 *   arg?: string,
 *   dynamicArg?: boolean,
 *   exp?: string,
 *   modifiers?: string[],
 *   alias?: string[],
 *   iterable?: string,
 *   source: string,
 *   span: Span,
 * }} VueProp
 * @typedef {{ tag: string, attrs: [string, string][], content: string,
 *   span: Span }} VueBlock
 */

class VueReader {
  constructor(text) {
    this.text = text;
  }

  source(loc) {
    return this.text.slice(loc.start.offset, loc.end.offset);
  }

  /** One attribute or directive. */
  prop(prop) {
    const span = spanOf(prop.loc);
    const source = this.source(prop.loc);
    if (prop.type === ATTRIBUTE) {
      return {
        kind: 'attribute',
        name: prop.name,
        rawName: prop.name,
        value: prop.value?.content,
        source,
        span,
      };
    }
    const out = {
      kind: 'directive',
      name: prop.name,
      rawName: prop.rawName ?? prop.name,
      arg: prop.arg?.content,
      dynamicArg: prop.arg ? !prop.arg.isStatic : false,
      exp: prop.exp?.content,
      modifiers: (prop.modifiers ?? []).map((m) => m.content ?? m),
      source,
      span,
    };
    const loop = prop.forParseResult;
    if (loop) {
      out.alias = [loop.value, loop.key, loop.index]
        .filter(Boolean)
        .map((part) => part.content);
      out.iterable = loop.source?.content ?? prop.exp?.content.split(' in ')[1];
    }
    return out;
  }

  /** One template node, or `null` for a comment. */
  node(node) {
    const span = spanOf(node.loc);
    switch (node.type) {
      case ELEMENT: {
        const props = node.props.map((p) => this.prop(p));
        return {
          tag: node.tag,
          attrs: props.map((p) => [
            p.rawName,
            p.kind === 'attribute' ? (p.value ?? '') : (p.exp ?? ''),
          ]),
          props,
          component: node.tagType === COMPONENT,
          children: this.children(node.children),
          span,
        };
      }
      case TEXT_NODE:
        return node.content === ''
          ? null
          : { tag: TEXT, attrs: [], children: [], text: node.content, span };
      case INTERPOLATION:
        return {
          tag: EXPRESSION,
          attrs: [],
          children: [],
          text: this.source(node.loc),
          span,
        };
      default:
        return null;
    }
  }

  children(nodes) {
    return nodes.map((n) => this.node(n)).filter((n) => n !== null);
  }

  /** A top-level block other than the template, with its raw content. */
  block(node) {
    const first = node.children[0];
    const content = first
      ? this.text.slice(
          first.loc.start.offset,
          node.children.at(-1).loc.end.offset
        )
      : '';
    return {
      tag: node.tag,
      attrs: node.props.map((p) => {
        const prop = this.prop(p);
        return [prop.rawName, prop.value ?? prop.exp ?? ''];
      }),
      content,
      span: spanOf(node.loc),
    };
  }
}

/**
 * Parse a Vue single-file component.
 * @param {string} text
 * @returns {{
 *   template: import('../html/tree.js').HtmlNode,
 *   script: VueBlock[],
 *   styles: VueBlock[],
 *   blocks: VueBlock[],
 *   errors: { message: string, span: Span }[],
 * }}
 */
export function parseVue(text) {
  if (typeof text !== 'string') {
    throw new TypeError('parseVue expects the text of a .vue file (a string)');
  }
  const errors = [];
  const ast = parse(text, {
    parseMode: 'sfc',
    onError: (error) =>
      errors.push({
        message: error.message,
        span: error.loc ? spanOf(error.loc) : { start: 0, end: 0 },
      }),
  });
  const reader = new VueReader(text);
  const top = ast.children.filter((node) => node.type === ELEMENT);
  const template = top.find((node) => node.tag === 'template');
  const blocks = top
    .filter((node) => node !== template)
    .map((node) => reader.block(node));
  return {
    template: {
      tag: FRAGMENT,
      attrs: [],
      children: template ? reader.children(template.children) : [],
      span: template ? spanOf(template.loc) : { start: 0, end: 0 },
    },
    script: blocks.filter((block) => block.tag === 'script'),
    styles: blocks.filter((block) => block.tag === 'style'),
    blocks: blocks.filter(
      (block) => block.tag !== 'script' && block.tag !== 'style'
    ),
    errors,
  };
}
