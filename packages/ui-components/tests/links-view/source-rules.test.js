/**
 * Behaviour: the links-view sources follow two rules that are checked on
 * their syntax trees (ESLint's parser), never on text patterns:
 *
 * - the SVG and Canvas renderers take marker shapes only from markers.js:
 *   their only import of marker data is `./markers.js`, and they contain no
 *   path data of their own;
 * - no module in src/links-view/ keeps module-level mutable state (the
 *   `local/no-module-state` ESLint rule reports nothing).
 */

import { describe, expect } from 'test-anywhere';
import { readFileSync, readdirSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { itUnless, sandboxed } from '../../../../tests/helpers/skip.js';
import { MARKERS } from '../../src/links-view/markers.js';

const SOURCE = new URL('../../src/links-view/', import.meta.url);
const source = (name) => readFileSync(new URL(name, SOURCE), 'utf8');
const sourceFiles = () =>
  readdirSync(fileURLToPath(SOURCE)).filter((name) => name.endsWith('.js'));

let dependencies;
const loadDependencies = () => {
  dependencies ??= Promise.all([
    import('eslint'),
    import('../../../../eslint-rules/no-module-state.js'),
  ]).then(([eslint, rule]) => ({ Linter: eslint.Linter, rule: rule.default }));
  return dependencies;
};

/**
 * Lint code with `local/no-module-state` and a probe rule that collects the
 * imports and string literals of the file.
 */
async function inspect(code) {
  const { Linter, rule } = await loadDependencies();
  const found = { imports: [], strings: [] };
  const probe = {
    meta: { type: 'problem', schema: [] },
    create: () => ({
      ImportDeclaration(node) {
        found.imports.push({
          from: node.source.value,
          names: node.specifiers.map((s) => s.imported?.name ?? s.type),
        });
      },
      Literal(node) {
        if (typeof node.value === 'string') {
          found.strings.push(node.value);
        }
      },
      TemplateElement(node) {
        found.strings.push(node.value.cooked);
      },
    }),
  };
  const linter = new Linter({ configType: 'flat' });
  const messages = linter.verify(
    code,
    [
      {
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        plugins: { local: { rules: { 'no-module-state': rule, probe } } },
        rules: { 'local/no-module-state': 'error', 'local/probe': 'error' },
      },
    ],
    { filename: 'probe.js' }
  );
  const fatal = messages.filter((m) => m.fatal);
  expect(fatal).toEqual([]);
  return { ...found, messages: messages.map((m) => m.message) };
}

const MARKER_PATHS = Object.values(MARKERS)
  .map((m) => m.path)
  .filter((p) => p !== '');

describe('renderers take marker shapes only from markers.js', () => {
  for (const name of ['render-svg.js', 'render-canvas.js']) {
    itUnless(sandboxed)(`${name}`, async () => {
      const { imports, strings } = await inspect(source(name));
      const from = imports.map((i) => i.from);
      expect(from.includes('./markers.js')).toBe(true);
      // Only local modules, and only markers.js among them gives markers.
      for (const i of imports) {
        expect(['./markers.js', './scene.js', './geometry.js']).toContain(
          i.from
        );
        if (i.from !== './markers.js') {
          expect(i.names.some((n) => /marker/iu.test(n))).toBe(false);
        }
      }
      // No marker path data written in the renderer itself.
      for (const text of strings) {
        for (const path of MARKER_PATHS) {
          expect(text.includes(path)).toBe(false);
        }
        expect(/\b[MmLlAaCcQqZz] -?\d/u.test(text)).toBe(false);
      }
    });
  }
});

describe('no module-level mutable state in src/links-view/', () => {
  itUnless(sandboxed)('every module passes local/no-module-state', async () => {
    const files = sourceFiles();
    expect(files.length >= 10).toBe(true);
    for (const name of files) {
      const { messages } = await inspect(source(name));
      expect({ name, messages }).toEqual({ name, messages: [] });
    }
  });

  itUnless(sandboxed)('the rule reports mutable state', async () => {
    const bad = [
      'let count = 0;',
      'var cache;',
      'const cache = new Map();',
      'const list = [];',
      'const options = { a: 1 };',
      'export const state = { ready: false };',
      'const shallow = Object.freeze({ inner: [] });',
      'const result = compute();',
      'globalThis.x = 1;',
      'register();',
      'class A { static instances = []; }',
    ];
    for (const code of bad) {
      const { messages } = await inspect(code);
      expect({ code, reported: messages.length > 0 }).toEqual({
        code,
        reported: true,
      });
    }
  });

  itUnless(sandboxed)('the rule accepts constants and functions', async () => {
    const good = [
      "import { a } from './a.js';",
      'const N = 3; export const S = `x${N}`;',
      'const f = (x) => x + 1; export function g() { let n = 0; return n; }',
      'const T = Object.freeze([Object.freeze([1, 2])]);',
      'export const K = Object.freeze(Object.keys({ a: 1 }));',
      'const P = Math.PI * 2;',
      'class B { static TAG = "b"; #own = []; }',
      "export * from './x.js';",
    ];
    for (const code of good) {
      const { messages } = await inspect(code);
      expect({ code, messages }).toEqual({ code, messages: [] });
    }
  });
});
