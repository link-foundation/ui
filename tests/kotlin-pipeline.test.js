import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect } from 'test-anywhere';
import { planKotlinChecks } from '../kotlin/scripts/ci.mjs';
import { itUnless, sandboxed } from './helpers/skip.js';

const workflow = readFileSync('.github/workflows/kotlin.yml', 'utf8');
const additionalPaths =
  /^ {6}additional-paths: \|\r?\n((?:^ {8}\S.*\r?\n)+)/m.exec(workflow)?.[1];

describe('Kotlin pilot routing', () => {
  itUnless(sandboxed)(
    'routes Kotlin sources and shared fixtures while skipping JS-only edits',
    () => {
      expect(typeof additionalPaths).toBe('string');
      const cwd = mkdtempSync(join(tmpdir(), 'ui-kotlin-pipeline-'));

      function git(...args) {
        return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
      }

      function commit(path) {
        const file = join(cwd, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, '');
        git('add', '--', path);
        git('commit', '-qm', path);
      }

      try {
        git('init', '-q', '-b', 'main');
        git('config', 'user.name', 'CI fixture');
        git('config', 'user.email', 'fixture@example.invalid');
        git('config', 'commit.gpgsign', 'false');
        git('config', 'core.hooksPath', '.git/no-hooks');
        git('commit', '--allow-empty', '-qm', 'base');

        for (const [path, expected] of [
          ['packages/ui-kotlin/src/commonMain/kotlin/UiView.kt', true],
          ['native/kotlin/links-notation/src/jvmMain/Parser.kt', true],
          ['examples/kotlin/Main.kt', true],
          ['native/parity/text-fixtures.json', true],
          ['docs/spec/parser-vectors.json', true],
          ['packages/ui-tokens/tests/golden/Tokens.kt', true],
          ['docs/case-studies/issue-1/samples/document.lino', true],
          ['kotlin/gradle/wrapper/gradle-wrapper.properties', true],
          ['.github/workflows/kotlin-quality.yml', true],
          ['packages/ui-core/src/index.js', false],
          ['packages/ui-kotlin-extra/src/index.js', false],
        ]) {
          const beforeSha = git('rev-parse', 'HEAD');
          commit(path);
          expect(
            planKotlinChecks({
              cwd,
              projectDirectory: 'kotlin',
              additionalPaths,
              eventName: 'push',
              beforeSha,
            })
          ).toEqual(expected);
        }

        const base = git('rev-parse', 'HEAD');
        git('switch', '-qc', 'pr');
        commit('docs/spec/vocabulary.lino');
        git('switch', '-q', 'main');
        commit('packages/ui-core/src/other.js');
        git('merge', '--no-ff', '-qm', 'test merge', 'pr');
        const config = { cwd, projectDirectory: 'kotlin', additionalPaths };
        expect(planKotlinChecks({ ...config, eventName: 'pull_request' })).toBe(
          true
        );
        expect(
          planKotlinChecks({
            ...config,
            eventName: 'merge_group',
            beforeSha: base,
          })
        ).toBe(true);
        git('switch', '-qc', 'js-pr');
        commit('packages/ui-core/src/js-only.js');
        git('switch', '-q', 'main');
        commit('docs/spec/only-on-base.lino');
        git('merge', '--no-ff', '-qm', 'test JS-only merge', 'js-pr');
        expect(planKotlinChecks({ ...config, eventName: 'pull_request' })).toBe(
          false
        );

        expect(
          planKotlinChecks({ ...config, eventName: 'workflow_dispatch' })
        ).toBe(true);
        expect(
          planKotlinChecks({
            ...config,
            eventName: 'push',
            beforeSha: '0'.repeat(40),
          })
        ).toBe(true);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  );
});
