import { URL } from 'node:url';
/** Small native source printer. Kind names are loaded from LiNo data. */
import { readFileSync } from 'node:fs';
import { parseLinks } from '@link-foundation/ui-core';
import {
  prop,
  textOf,
  tokenPath,
  tokenIdentifier,
  commentText,
} from './shared.js';
import { nodeActions } from './actions.js';

const nativeString = (value, target) => {
  let out = '"';
  for (const c of String(value)) {
    const code = c.codePointAt(0);
    if (c === '\\' || c === '"') {
      out += `\\${c}`;
    } else if (c === '$' && target === 'compose') {
      out += '\\$';
    } else if (c === '\n') {
      out += '\\n';
    } else if (c === '\r') {
      out += '\\r';
    } else if (c === '\t') {
      out += '\\t';
    } else if (code < 32 || code === 0x2028 || code === 0x2029) {
      out +=
        target === 'swiftui'
          ? `\\u{${code.toString(16)}}`
          : `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      out += c;
    }
  }
  return `${out}"`;
};

function dimension(value, node, ctx, notes) {
  const path = tokenPath(value);
  if (path) {
    return tokenIdentifier(path, ctx.target);
  }
  const match =
    typeof value === 'string' &&
    /^(-?\d+(?:\.\d+)?)(px|pt|rem|dp)?$/.exec(value);
  if (match) {
    const number = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
    return `${number}${ctx.target === 'compose' ? '.dp' : ''}`;
  }
  notes.push(ctx.unsupported(node, 'dimension'));
  return ctx.target === 'compose' ? '0.dp' : '0';
}

function actionCalls(node, state) {
  return nodeActions(node).flatMap((action) => {
    if (
      action.event !== 'press' ||
      !action.args.every((arg) => typeof arg === 'string')
    ) {
      state.notes.push(state.ctx.unsupported(node, `event ${action.event}`));
      return [];
    }
    const args = action.args
      .map((arg) => nativeString(arg, state.target))
      .join(', ');
    const name = nativeString(action.name, state.target);
    return [
      state.target === 'swiftui'
        ? `actions[${name}]?([${args}])`
        : `actions[${name}]?.invoke(listOf(${args}))`,
    ];
  });
}

const properties = {
  document: ['title', 'theme', 'lang'],
  stack: ['direction', 'gap', 'padding'],
  text: ['value'],
  button: ['label', 'variant', 'on', 'disabled'],
  checkbox: ['label', 'checked', 'disabled'],
  switch: ['label', 'checked', 'disabled'],
  'text-field': ['label', 'value', 'disabled'],
};

function nativeNode(node, state, depth) {
  const { table, ctx } = state;
  const notes = [];
  const pad = '    '.repeat(depth);
  const line = (s) => `${pad}${s}`;
  const kind = table.get(node.kind);
  notes.push(...ctx.check(node, properties[node.kind] ?? []));
  if (!kind) {
    notes.push(ctx.unsupported(node, `kind ${node.kind}`));
  }
  if (
    node.positional.length > 1 ||
    (!['text', 'button', 'checkbox', 'switch', 'text-field'].includes(
      node.kind
    ) &&
      node.positional.length)
  ) {
    notes.push(ctx.unsupported(node, 'positional values'));
  }
  const local = { ...state, notes };
  const body = nativeBody(node, kind, local, depth);
  return [...notes.map((note) => line(`// ${commentText(note)}`)), ...body];
}

function nativeBody(node, kind, state, depth) {
  const { target, ctx } = state;
  const swift = target === 'swiftui';
  const pad = '    '.repeat(depth);
  const at = (s) => `${pad}${s}`;
  const string = (s) => nativeString(s, target);
  const label = string(textOf(node));
  let lines;
  if (node.kind === 'text') {
    lines = [at(`${kind[0]}(${label})`)];
  } else if (node.kind === 'button') {
    const calls = actionCalls(node, state);
    const variant = prop(node, 'variant');
    if (variant && variant !== 'filled') {
      state.notes.push(ctx.unsupported(node, `variant ${variant}`));
    }
    lines = swift
      ? [
          at(`Button(${label}) {`),
          ...calls.map((call) => `${pad}    ${call}`),
          at('}'),
          ...(variant === 'filled'
            ? [at('    .buttonStyle(.borderedProminent)')]
            : []),
        ]
      : [
          at(`Button(onClick = { ${calls.join('; ')} }) {`),
          `${pad}    Text(${label})`,
          at('}'),
        ];
  } else if (['checkbox', 'switch', 'text-field'].includes(node.kind)) {
    lines = control(node, state, depth, kind);
  } else {
    return container(node, kind, state, depth);
  }
  if (node.children.length) {
    state.notes.push(ctx.unsupported(node, 'children of leaf view'));
    lines.push(
      ...node.children.flatMap((child) => nativeNode(child, state, depth))
    );
  }
  if (prop(node, 'disabled') !== undefined) {
    if (swift) {
      lines.push(at(`    .disabled(${prop(node, 'disabled') === 'true'})`));
    } else {
      state.notes.push(ctx.unsupported(node, 'disabled modifier'));
    }
  }
  return lines;
}

function container(node, kind, state, depth) {
  const { ctx } = state;
  const swift = state.target === 'swiftui';
  const pad = '    '.repeat(depth);
  const at = (s) => `${pad}${s}`;
  let name = kind?.[0] ?? (swift ? 'Group' : 'Column');
  let args = '';
  if (node.kind === 'stack') {
    const horizontal = prop(node, 'direction') === 'horizontal';
    name = horizontal ? kind[1] : kind[0];
    if (prop(node, 'gap') !== undefined) {
      const gap = dimension(prop(node, 'gap'), node, ctx, state.notes);
      args = swift
        ? `(spacing: ${gap})`
        : `(${horizontal ? 'horizontal' : 'vertical'}Arrangement = Arrangement.spacedBy(${gap}))`;
    }
  }
  const inner = node.children.flatMap((child) =>
    nativeNode(child, state, depth + 1)
  );
  const lines = [at(`${name}${args} {`), ...inner, at('}')];
  if (swift && inner.length === 0) {
    lines.splice(1, 0, `${pad}    EmptyView()`);
  }
  if (node.kind === 'stack' && prop(node, 'padding') !== undefined) {
    const padding = dimension(prop(node, 'padding'), node, ctx, state.notes);
    if (swift) {
      lines.push(at(`    .padding(${padding})`));
    } else {
      lines[0] = at(
        `${name}(${args ? `${args.slice(1, -1)}, ` : ''}modifier = Modifier.padding(${padding})) {`
      );
    }
  }
  return lines;
}

function control(node, state, depth, kind) {
  const { target, fields, notes, ctx } = state;
  const swift = target === 'swiftui';
  const pad = '    '.repeat(depth);
  const string = (s) => nativeString(s, target);
  const name = `field${fields.length}`;
  const text = node.kind === 'text-field';
  if (!text && ![undefined, 'true', 'false'].includes(prop(node, 'checked'))) {
    notes.push(ctx.unsupported(node, 'mixed checked value'));
  }
  const initial = text
    ? string(prop(node, 'value') ?? '')
    : String(prop(node, 'checked') === 'true');
  fields.push(
    swift
      ? `    @State private var ${name} = ${initial}`
      : `${pad}var ${name} by remember { mutableStateOf(${initial}) }`
  );
  const label = string(textOf(node));
  if (swift) {
    return [`${pad}${kind[0]}(${label}, ${text ? 'text' : 'isOn'}: $${name})`];
  }
  return [
    fields[fields.length - 1],
    `${pad}${kind[0]}(${text ? `value = ${name}, onValueChange` : `checked = ${name}, onCheckedChange`} = { ${name} = it }${text ? `, label = { Text(${label}) }` : ''})`,
    ...(!text && textOf(node) ? [`${pad}Text(${label})`] : []),
  ];
}

export function nativeExport(input, target) {
  const table = new Map(
    parseLinks(
      readFileSync(new URL(`./targets/${target}.lino`, import.meta.url), 'utf8')
    ).map(({ id, values }) => [id, values.slice(1)])
  );
  const fields = [];
  const state = { target, table, ctx: input.ctx, fields, notes: [] };
  const swift = target === 'swiftui';
  const nodes = input.tree.roots.flatMap((node) =>
    nativeNode(node, state, swift ? 3 : 1)
  );
  const name = input.componentName;
  const contents = swift
    ? [
        'import SwiftUI',
        '',
        `struct ${name}: View {`,
        '    var actions: [String: ([String]) -> Void] = [:]',
        ...fields,
        '',
        '    var body: some View {',
        '        Group {',
        ...nodes,
        ...(nodes.length ? [] : ['            EmptyView()']),
        '        }',
        '    }',
        '}',
      ]
    : [
        'import androidx.compose.runtime.*',
        'import androidx.compose.foundation.layout.*',
        'import androidx.compose.material3.*',
        'import androidx.compose.ui.Modifier',
        'import androidx.compose.ui.unit.dp',
        '',
        '@Composable',
        `fun ${name}(actions: Map<String, (List<String>) -> Unit> = emptyMap()) {`,
        ...nodes,
        '}',
      ];
  return [
    {
      path: `${name}.${swift ? 'swift' : 'kt'}`,
      contents: `${contents.join('\n')}\n`,
    },
  ];
}
