import { parse, format } from '@link-foundation/ui-core';
import { format as pretty } from 'prettier';
import { componentVocabulary } from '../mappings/index.js';
import { collectActions } from './actions.js';
import { context } from './shared.js';
import { react } from './react.js';
import { vue } from './vue.js';
import { swiftui } from './swiftui.js';
import { compose } from './compose.js';

export const TARGETS = Object.freeze(['react', 'vue', 'swiftui', 'compose']);
const generators = { react, vue, swiftui, compose };

/**
 * One-way source export. Prettier 3 makes formatting asynchronous.
 * @param {string | import('@link-foundation/ui-core').UiDocument} source
 * @param {import('../index.d.ts').ExportOptions} options
 */
export async function exportDocument(
  source,
  { target, mode = 'wrapper', componentName = 'App' } = {}
) {
  checkOptions(target, mode, componentName);
  const tree =
    typeof source === 'string'
      ? parse(source, { vocabulary: componentVocabulary() })
      : source;
  if (!tree || !Array.isArray(tree.roots)) {
    throw new TypeError('source must be LiNo text or a ui-core document');
  }
  const diagnostics = [...(tree.diagnostics ?? [])];
  const ctx = context(target, diagnostics);
  const input = {
    tree,
    source: typeof source === 'string' ? source : format(tree),
    mode,
    componentName,
    actions: collectActions(tree),
    ctx,
  };
  const files = generators[target](input);
  const notes = ctx.check(
    { id: null, properties: [], unknown: tree.unknown ?? [] },
    []
  );
  if (notes.length) {
    const comments = notes.map((note) =>
      target === 'vue'
        ? `<!-- ${note} -->`
        : target === 'react'
          ? `/* ${note} */`
          : `// ${note}`
    );
    files[0].contents = `${comments.join('\n')}\n${files[0].contents}`;
  }
  await formatFiles(files);
  return { files, diagnostics };
}

async function formatFiles(files) {
  for (const file of files) {
    const parser = file.path.endsWith('.jsx')
      ? 'babel'
      : file.path.endsWith('.vue')
        ? 'vue'
        : file.path.endsWith('.css')
          ? 'css'
          : null;
    if (parser) {
      file.contents = await pretty(file.contents, {
        parser,
        singleQuote: true,
        trailingComma: 'all',
      });
    }
  }
}

function checkOptions(target, mode, componentName) {
  if (!TARGETS.includes(target)) {
    throw new TypeError(`Unknown target "${target}"`);
  }
  if (!['wrapper', 'eject'].includes(mode)) {
    throw new TypeError(`Unknown mode "${mode}"`);
  }
  if (
    !/^[A-Z][A-Za-z0-9_]*$/.test(componentName) ||
    [
      'View',
      'Text',
      'Button',
      'UiView',
      'Column',
      'Row',
      'Switch',
      'TextField',
      'Group',
      'EmptyView',
      'VStack',
      'HStack',
      'Toggle',
      'Tokens',
    ].includes(componentName)
  ) {
    throw new TypeError(
      'componentName must be a non-reserved PascalCase identifier'
    );
  }
}
