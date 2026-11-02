/**
 * importVue: Vue single-file components -> UI dialect (fixtures,
 * directives, blocks, spans, syntax errors).
 */

import { describe, it, expect } from 'test-anywhere';
import { importVue, parseVue } from '@link-foundation/ui-convert';
import { codes, componentFixtures, expectParses } from './helpers.js';

const template = (markup) => `<template>${markup}</template>`;
const lino = (markup) => importVue(template(markup)).text;
const fixture = (name) =>
  componentFixtures('vue').find((f) => f.file === name).source;

describe('importVue fixtures', () => {
  for (const { file, source, lino: expected } of componentFixtures('vue')) {
    it(`${file} gives its .lino`, () => {
      expect(importVue(source).text).toBe(expected);
    });

    it(`${file}: the output parses with links-notation and ui-core`, () => {
      expectParses(importVue(source).text);
    });

    it(`${file}: every element span slices to its source`, () => {
      const { spans } = importVue(source);
      expect(spans.size > 0).toBe(true);
      for (const { start, end } of spans.values()) {
        const slice = source.slice(start, end);
        expect(slice.startsWith('<')).toBe(true);
        expect(slice.endsWith('>')).toBe(true);
      }
    });
  }

  it('todo.vue covers v-if, v-else, v-for, @click, :prop and v-model', () => {
    const { text, diagnostics } = importVue(fixture('todo.vue'));
    expect(text).toContain('(when (param todo.items))');
    expect(text).toContain('(when (not (param todo.items)))');
    expect(text).toContain('(each item (param todo.items) (index i))');
    expect(text).toContain('(on press (action addItem))');
    expect(text).toContain('(bind checked (param item.done))');
    expect(text).toContain('(bind value (param draft.text))');
    expect(diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['vue-script', 'info'],
      ['vue-style', 'info'],
    ]);
  });

  it('unsupported.vue: one diagnostic with a span per construct', () => {
    const source = fixture('unsupported.vue');
    const { diagnostics } = importVue(source);
    expect(
      diagnostics.map((d) => [d.code, source.slice(d.span.start, d.span.end)])
    ).toEqual([
      ['unsupported-vue-directive', 'v-show="visible"'],
      ['unsupported-vue-expression', '{{ user.name }}'],
      ['unsupported-vue-directive', 'v-model.trim="draft.name"'],
      ['unsupported-vue-directive', '@click="save(draft)"'],
      ['unsupported-vue-directive', '@click.prevent="cancel"'],
    ]);
  });
});

describe('importVue directives', () => {
  it('keeps static attributes as props', () => {
    expect(lino('<TextField label="Name" required />')).toBe(
      '(text-field-0: text-field\n  (label Name)\n  (required true))\n'
    );
  });

  it('reads literal :prop values as props', () => {
    expect(lino(`<Stack :spacing="3" direction="row" />`)).toBe(
      '(stack-0: stack\n  (direction horizontal)\n  (gap (token space.3)))\n'
    );
  });

  it('binds :prop paths', () => {
    expect(lino('<Switch :checked="settings.dark" />')).toBe(
      '(switch-0: switch\n  (bind checked (param settings.dark)))\n'
    );
  });

  it('reads a literal :style object', () => {
    expect(lino(`<Box :style="{ color: 'red' }" />`)).toBe(
      '(box-0: box\n  (style (color red)))\n'
    );
  });

  it('maps @event to an action, click to press', () => {
    expect(lino('<Box @click="open" @mouseenter="show" />')).toBe(
      '(box-0: box\n  (on press (action open))\n  (on mouseenter (action show)))\n'
    );
  });

  it('reads v-for with one alias', () => {
    expect(lino('<ListItem v-for="row in rows" />')).toContain(
      '(each row (param rows))'
    );
  });

  it('keeps v-else-if, v-slot and dynamic arguments as unsupported', () => {
    const { diagnostics } = importVue(
      template(
        '<Box v-if="a" /><Box v-else-if="b" /><Card v-slot:header /><Box :[k]="v" />'
      )
    );
    expect(codes(diagnostics)).toEqual([
      'unsupported-vue-directive',
      'unsupported-vue-directive',
      'unsupported-vue-directive',
    ]);
  });

  it('keeps v-else without a plain v-if as unsupported', () => {
    const { text } = importVue(template('<Box v-if="a > 1" /><Box v-else />'));
    expect(text).toContain(`(unsupported vue-directive 'v-if="a > 1"')`);
    expect(text).toContain('(unsupported vue-directive v-else)');
  });

  it('keeps an interpolation outside elements as an html link', () => {
    const { text, diagnostics } = importVue(template('{{ total }}'));
    expect(text).toContain("(unsupported vue-expression '{{ total }}')");
    expect(codes(diagnostics)).toEqual(['unsupported-vue-expression']);
    expectParses(text);
  });

  it('maps lowercase HTML elements with the HTML table', () => {
    expect(lino('<button @click="go">Go</button>')).toBe(
      '(button-0: button\n  (label Go)\n  (on press (action go)))\n'
    );
  });
});

describe('parseVue', () => {
  it('splits the template, scripts, styles and other blocks', () => {
    const sfc = parseVue(
      '<template><Box /></template>\n<script>x</script>\n<style>a{}</style>\n<i18n>{}</i18n>'
    );
    expect(sfc.template.children.map((n) => n.tag)).toEqual(['Box']);
    expect(sfc.script.map((b) => b.content)).toEqual(['x']);
    expect(sfc.styles.map((b) => b.content)).toEqual(['a{}']);
    expect(sfc.blocks.map((b) => b.tag)).toEqual(['i18n']);
    expect(sfc.errors).toEqual([]);
  });

  it('reads v-for aliases and the iterable', () => {
    const [node] = parseVue(template('<Box v-for="(item, i) in list.items" />'))
      .template.children;
    const [prop] = node.props;
    expect(prop.alias).toEqual(['item', 'i']);
    expect(prop.iterable).toBe('list.items');
  });

  it('reports syntax errors and still gives LiNo that parses', () => {
    const { text, diagnostics } = importVue(template('<Box><Button></Box>'));
    expect(codes(diagnostics)).toContain('syntax-error');
    expectParses(text);
  });

  it('rejects a non-string', () => {
    expect(() => importVue(undefined)).toThrow(TypeError);
    expect(() => parseVue(1)).toThrow(TypeError);
  });
});
