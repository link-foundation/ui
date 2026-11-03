/**
 * ESLint forbids turning text into code under packages/ui-components/src:
 * `no-eval`, `no-new-func` and `no-implied-eval` are errors there, and the
 * real sources pass them.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import { ESLint } from 'eslint';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SRC = join(ROOT, 'packages/ui-components/src');
const RULES = ['no-eval', 'no-new-func', 'no-implied-eval'];

const eslint = new ESLint({ cwd: ROOT });

/** The messages of the three rules for text linted as `file`. */
async function ruleMessages(text, file) {
  const [result] = await eslint.lintText(text, { filePath: join(SRC, file) });
  return result.messages
    .filter((m) => RULES.includes(m.ruleId))
    .map((m) => [m.ruleId, m.severity]);
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith('.js')
        ? [join(dir, entry.name)]
        : []
  );
}

describe('lint: no code from text under ui-components/src', () => {
  it('fails on a fixture with eval(', async () => {
    const messages = await ruleMessages(
      'export const run = (text) => eval(text);\n',
      'behavior/fixture.js'
    );
    expect(messages).toEqual([['no-eval', 2]]);
  });

  it('fails on new Function and string timers', async () => {
    const messages = await ruleMessages(
      [
        "export const make = (text) => new Function('x', text);",
        "export const later = (text) => setTimeout('run(' + text + ')', 1);",
        '',
      ].join('\n'),
      'a11y/fixture.js'
    );
    expect(messages).toEqual([
      ['no-new-func', 2],
      ['no-implied-eval', 2],
    ]);
  });

  it('passes on the real sources', async () => {
    const files = sourceFiles(SRC);
    expect(files.length > 10).toBe(true);
    for (const file of files) {
      const [result] = await eslint.lintText(readFileSync(file, 'utf8'), {
        filePath: file,
      });
      const errors = result.messages.filter((m) => m.severity === 2);
      expect([file, errors]).toEqual([file, []]);
    }
  });
});
