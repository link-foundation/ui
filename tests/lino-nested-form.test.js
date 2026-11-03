/**
 * The Links Notation of the repository is written in the nested form
 * (#133): every tracked `.lino` file and every ```lino block of the
 * Markdown files is left unchanged by `scripts/lino-nest.mjs`, which reads
 * the text with the official `links-notation` parser and writes it back
 * with `formatLinks` of ui-core.
 *
 * The files below keep the other forms on purpose: they are the inputs
 * that show the inline and parenthesized forms still read, history, or the
 * one-line render snapshots of the Swift and Kotlin renderers. To fix a
 * file this test reports, run `node scripts/lino-nest.mjs <file>`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { nestLino, nestMarkdown } from '../scripts/lino-nest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Paths (prefixes) and patterns that keep the inline or paren forms. */
const KEEP = [
  // History: the case study of issue 1 quotes the texts as they were.
  'docs/case-studies/issue-1/',
  // The case study of #133 shows the forms it replaced.
  'docs/case-studies/issue-133/',
  // The spec fixtures show the same document in each form.
  'docs/spec/fixtures/',
  // The projection spec and the ui-core README demonstrate the forms.
  'docs/spec/projection.md',
  'packages/ui-core/README.md',
  // Reader fixtures of ui-core in the one-line, multi-line and mixed forms.
  'packages/ui-core/tests/fixtures/',
  // Designer preservation fixtures intentionally exercise the reader's inline form.
  'packages/ui-designer/tests/fixtures/inline.',
  // Probes keep the text they probed.
  'experiments/',
  // One-line render snapshots of the Swift and Kotlin renderers (dumpLino),
  // and the README sections that show them.
  /\.render\.lino$/u,
  'packages/ui-swift/README.md',
  'packages/ui-kotlin/README.md',
];

const kept = (file) =>
  KEEP.some((rule) =>
    typeof rule === 'string' ? file.startsWith(rule) : rule.test(file)
  );

const tracked = execFileSync('git', ['ls-files', '*.lino', '*.md'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file !== '' && !file.includes('node_modules/'));

test('finds the Links Notation files of the repository', () => {
  assert.ok(tracked.filter((file) => file.endsWith('.lino')).length > 100);
  assert.ok(tracked.includes('README.md'));
});

test('writes every .lino file and ```lino block in the nested form', () => {
  const notNested = tracked.filter((file) => {
    if (kept(file)) {
      return false;
    }
    const text = readFileSync(`${root}${file}`, 'utf8');
    const nested = file.endsWith('.md') ? nestMarkdown(text) : nestLino(text);
    return nested !== text;
  });
  assert.deepEqual(notNested, []);
});

test('the check sees a parenthesized multi-line link', () => {
  const parens = '(card: panel\n  (title Hello)\n  (gap 8))\n';
  assert.equal(nestLino(parens), 'card: panel\n  title Hello\n  gap 8\n');
  const markdown = `# A\n\n\`\`\`lino\n${parens}\`\`\`\n`;
  assert.notEqual(nestMarkdown(markdown), markdown);
});

test('the debug trace reports every group (off by default)', () => {
  const seen = [];
  nestLino(
    '(a: b\n  (c d))\n\n# a comment\nx y\n\nk: v\n  w 1\n',
    () => {},
    (status) => seen.push(status)
  );
  assert.deepEqual(seen, [
    'nested',
    'kept (it holds a comment line)',
    'already nested',
  ]);
});
