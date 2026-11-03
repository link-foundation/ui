/** Semantic web export, reversing the HTML import table. */
import { HTML_MAPPING } from '../html/mapping.js';
import { unsafeAttribute, DROPPED_TAGS } from '../html/security.js';
import { nodeActions } from './actions.js';
import { prop, textOf, quote, tokenPath } from './shared.js';

const html = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;');
const cssName = (s) => String(s).replaceAll(/[^a-zA-Z0-9_-]/g, '-');
const booleanAttrs = new Set([
  'disabled',
  'required',
  'readonly',
  'checked',
  'multiple',
  'autofocus',
]);
const eventNames = {
  press: 'click',
  'double-press': 'dblclick',
  input: 'input',
  change: 'change',
  focus: 'focus',
  blur: 'blur',
};
const reactAttrs = {
  class: 'className',
  for: 'htmlFor',
  readonly: 'readOnly',
  tabindex: 'tabIndex',
  autocomplete: 'autoComplete',
  checked: 'defaultChecked',
  value: 'defaultValue',
};
const extraTags = {
  stack: 'div',
  document: 'div',
  box: 'div',
  switch: 'input',
  label: 'label',
};
const voidTags = new Set([
  'input',
  'img',
  'br',
  'hr',
  'meta',
  'link',
  'area',
  'source',
  'wbr',
]);

function tagOf(node) {
  const mapped =
    extraTags[node.kind] ??
    HTML_MAPPING.find((rule) => rule.kind === node.kind)?.tags[0];
  if (!mapped && node.kind !== 'html') {
    return null;
  }
  return (
    prop(node, 'tag') ??
    (prop(node, 'level') ? `h${prop(node, 'level')}` : null) ??
    mapped
  );
}

function cssValue(value, node, ctx, comments) {
  const path = tokenPath(value);
  if (path) {
    return `var(--${cssName(path.replaceAll('.', '-'))})`;
  }
  if (typeof value === 'string' && !/[{};<>]/u.test(value)) {
    return value;
  }
  comments.push(ctx.unsupported(node, 'CSS value'));
  return null;
}

function declarations(node, ctx, comments) {
  const out = [];
  const add = (name, value) => {
    const safe = cssValue(value, node, ctx, comments);
    if (safe !== null) {
      out.push(`${name}: ${safe};`);
    }
  };
  if (node.kind === 'stack') {
    out.push(
      'display: flex;',
      `flex-direction: ${prop(node, 'direction') === 'horizontal' ? 'row' : 'column'};`
    );
    if (prop(node, 'gap') !== undefined) {
      add('gap', prop(node, 'gap'));
    }
    if (prop(node, 'padding') !== undefined) {
      add('padding', prop(node, 'padding'));
    }
    if (prop(node, 'align')) {
      out.push(`align-items: ${prop(node, 'align')};`);
    }
  }
  if (node.kind === 'button' && prop(node, 'variant')) {
    const variant = prop(node, 'variant');
    const variants = {
      filled: [
        'background: var(--color-primary, #6750a4);',
        'color: var(--color-on-primary, white);',
        'border: 0;',
      ],
      tonal: [
        'background: var(--color-secondary-container, #e8def8);',
        'color: var(--color-on-secondary-container, #1d192b);',
      ],
      outlined: ['background: transparent;', 'border: 1px solid currentColor;'],
      text: ['background: transparent;', 'border: 0;'],
    };
    if (variants[variant]) {
      out.push(...variants[variant]);
    } else {
      comments.push(ctx.unsupported(node, `variant ${variant}`));
    }
  }
  const style = node.properties.find((p) => p.name === 'style');
  if (style) {
    if (style.values.every(Array.isArray)) {
      for (const [name, ...values] of style.values) {
        if (/^(--)?[a-zA-Z][a-zA-Z0-9-]*$/.test(name) && values.length === 1) {
          add(name, values[0]);
        } else {
          comments.push(ctx.unsupported(node, 'style declaration'));
        }
      }
    } else {
      comments.push(ctx.unsupported(node, 'style reference'));
    }
  }
  return out;
}

function attributes(node, tag, ctx, comments) {
  const attrs = new Map(node.id === null ? [] : [['id', node.id]]);
  rawAttributes(node, attrs, ctx, comments);
  for (const [property, attr] of Object.entries({
    source: 'src',
    alt: 'alt',
    href: 'href',
    type: 'type',
    disabled: 'disabled',
    name: 'name',
    placeholder: 'placeholder',
    required: 'required',
    readonly: 'readonly',
    checked: 'checked',
    rows: 'rows',
    autocomplete: 'autocomplete',
  })) {
    if (prop(node, property) !== undefined) {
      attrs.set(attr, prop(node, property));
    }
  }
  if (['checkbox', 'switch'].includes(node.kind)) {
    attrs.set('type', 'checkbox');
  }
  if (node.kind === 'switch') {
    attrs.set('role', 'switch');
  }
  if (tag === 'input' && node.kind === 'button') {
    attrs.set('value', textOf(node));
  } else if (tag === 'input' && prop(node, 'value') !== undefined) {
    attrs.set('value', prop(node, 'value'));
  }
  if (
    ['text-field', 'checkbox', 'switch', 'text-area'].includes(node.kind) &&
    textOf(node) &&
    !attrs.has('aria-label')
  ) {
    attrs.set('aria-label', textOf(node));
  }
  for (const [name, value] of attrs) {
    if (unsafeAttribute(name, String(value))) {
      comments.push(ctx.unsupported(node, `attribute ${name}`));
      attrs.delete(name);
    }
  }
  return attrs;
}

function rawAttributes(node, attrs, ctx, comments) {
  for (const p of node.properties.filter((p) => p.name === 'attr')) {
    const [name, value = ''] = p.values;
    if (
      typeof name === 'string' &&
      /^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/.test(name) &&
      !unsafeAttribute(name, String(value)) &&
      !['style', 'v-html', 'v-text', 'is'].includes(name)
    ) {
      attrs.set(name, value);
    } else {
      comments.push(ctx.unsupported(node, `attribute ${name}`));
    }
  }
}

function printAttributes(attrs, target) {
  return [...attrs]
    .map(([name, value]) => {
      const key = target === 'react' ? (reactAttrs[name] ?? name) : name;
      if (booleanAttrs.has(name)) {
        return value === 'false' ? '' : ` ${key}`;
      }
      return ` ${key}="${html(value)}"`;
    })
    .join('');
}

function events(node, target, ctx, comments) {
  const groups = new Map();
  for (const action of nodeActions(node)) {
    const event = eventNames[action.event];
    if (!event || !action.args.every((arg) => typeof arg === 'string')) {
      comments.push(ctx.unsupported(node, `event ${action.event}`));
      continue;
    }
    const call = `actions[${quote(action.name)}]?.(${action.args.map(quote).join(', ')})`;
    groups.set(event, [...(groups.get(event) ?? []), call]);
  }
  return [...groups]
    .map(([event, calls]) =>
      target === 'react'
        ? ` on${event === 'dblclick' ? 'DoubleClick' : event[0].toUpperCase() + event.slice(1)}={() => { ${calls.join('; ')}; }}`
        : ` @${event}="${html(calls.join('; '))}"`
    )
    .join('');
}

function theme(node, state) {
  const { ctx, css } = state;
  const comments = [];
  for (const p of node.properties) {
    if (p.name === 'token' && p.values.length === 2) {
      const [path, value] = p.values;
      const safe = cssValue(value, node, ctx, comments);
      if (safe) {
        css.push(`:root { --${cssName(path.replaceAll('.', '-'))}: ${safe}; }`);
      }
    } else {
      comments.push(ctx.unsupported(node, `property ${p.name}`));
    }
  }
  return comments.map(state.comment).join('\n');
}

function element(node, state) {
  const { target, ctx, css } = state;
  const comments = [];
  if (node.kind === 'theme') {
    return theme(node, state);
  }
  let tag = tagOf(node);
  if (
    !tag ||
    !/^[a-z][a-z0-9-]*$/.test(tag) ||
    DROPPED_TAGS.includes(tag) ||
    ['style', 'template'].includes(tag)
  ) {
    comments.push(ctx.unsupported(node, `kind ${node.kind}`));
    tag = 'div';
  }
  comments.push(
    ...ctx.check(node, [
      'tag',
      'level',
      'attr',
      'style',
      'label',
      'value',
      'source',
      'alt',
      'href',
      'type',
      'disabled',
      'name',
      'placeholder',
      'required',
      'readonly',
      'checked',
      'rows',
      'autocomplete',
      'on',
      ...(node.kind === 'button' ? ['variant'] : []),
      ...(node.kind === 'stack'
        ? ['direction', 'gap', 'padding', 'align']
        : []),
      ...(node.kind === 'document' ? ['title', 'theme', 'lang'] : []),
    ])
  );
  const attrs = attributes(node, tag, ctx, comments);
  const styles = declarations(node, ctx, comments);
  if (styles.length) {
    const className = `ui-${state.next++}`;
    attrs.set(
      'class',
      [attrs.get('class'), className].filter(Boolean).join(' ')
    );
    css.push(`.${className} { ${styles.join(' ')} }`);
  }
  const handlers = events(node, target, ctx, comments);
  if (voidTags.has(tag) && node.children.length) {
    comments.push(ctx.unsupported(node, 'children of void element'));
  }
  const prefix = comments.map(state.comment).join('\n');
  const open = `<${tag}${printAttributes(attrs, target)}${handlers}`;
  if (voidTags.has(tag)) {
    return `${prefix}${open} />`;
  }
  return `${prefix}${open}>${content(node, state)}</${tag}>`;
}

function content(node, state) {
  const text =
    node.kind === 'text-area'
      ? String(prop(node, 'value') ?? '')
      : ['text', 'button', 'link', 'label'].includes(node.kind)
        ? textOf(node)
        : '';
  const contents = node.children
    .map((child) => element(child, state))
    .join('\n');
  return `${html(text)}${contents}`;
}

export function webEject(input, target) {
  const { tree, ctx, componentName } = input;
  const state = {
    target,
    ctx,
    css: [],
    next: 0,
    comment: (s) => (target === 'react' ? `{/* ${s} */}` : `<!-- ${s} -->`),
  };
  const markup = tree.roots.map((node) => element(node, state)).join('\n');
  const name = `${componentName}.css`;
  const source =
    target === 'react'
      ? `import ${quote(`./${name}`)};\nexport function ${componentName}({ actions = {} }) { return <>${markup}</>; }\n`
      : `<script setup>\ndefineProps({ actions: { type: Object, default: () => ({}) } });\n</script>\n<template>${markup}</template>\n<style src="./${name}"></style>\n`;
  return [
    {
      path: `${componentName}.${target === 'react' ? 'jsx' : 'vue'}`,
      contents: source,
    },
    { path: name, contents: `${state.css.join('\n')}\n` },
  ];
}
