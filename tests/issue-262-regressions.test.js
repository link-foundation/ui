import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'test-anywhere';
import { itUnless, sandboxed } from './helpers/skip.js';
import { HANG_GUARD_MS, runBounded } from './helpers/bounded-run.js';

describe('issue 262 repository regressions', () => {
  it('runs the pinned secrets scan after Node setup and before installation', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const lint = workflow.split('\n  lint:')[1].split('\n  test:')[0];
    const scan = lint.indexOf('secretlint "**/*"');
    assert.ok(scan > lint.indexOf('uses: actions/setup-node@'));
    assert.ok(scan < lint.indexOf('- name: Install dependencies'));
  });

  itUnless(sandboxed)(
    'checks workflows without a composite actions directory',
    () => {
      const root = mkdtempSync(join(tmpdir(), 'workflow-policy-'));
      try {
        mkdirSync(join(root, '.github/workflows'), { recursive: true });
        const workflow = join(root, '.github/workflows/test.yml');
        writeFileSync(workflow, 'jobs:\n  test:\n    runs-on: ubuntu-24.04\n');
        const run = () =>
          spawnSync('node', [resolve('scripts/check-ci-workflows.mjs')], {
            cwd: root,
            encoding: 'utf8',
          });
        const valid = run();
        assert.equal(valid.status, 0, valid.stderr);
        writeFileSync(workflow, 'jobs:\n  test:\n    runs-on: ubuntu-latest\n');
        const invalid = run();
        assert.equal(invalid.status, 1);
        assert.match(invalid.stderr, /Pin hosted runners/);
        rmSync(join(root, '.github/workflows'), { recursive: true });
        const missingRequired = run();
        assert.equal(missingRequired.status, 1);
        assert.match(missingRequired.stderr, /ENOENT/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('loads release dependencies from the lockfile without downloaded eval', () => {
    const loader = readFileSync('scripts/use-module.mjs', 'utf8');
    assert.doesNotMatch(loader, /unpkg\.com|\beval\s*\(|\bfetch\s*\(/);
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    for (const name of ['command-stream', 'lino-arguments']) {
      assert.match(manifest.devDependencies[name], /^\d+\.\d+\.\d+$/);
      assert.equal(
        lock.packages[`node_modules/${name}`].version,
        manifest.devDependencies[name]
      );
      assert.match(lock.packages[`node_modules/${name}`].integrity, /^sha512-/);
    }
    for (const name of readdirSync('scripts').filter((name) =>
      name.endsWith('.mjs')
    )) {
      assert.doesNotMatch(
        readFileSync(join('scripts', name), 'utf8'),
        /unpkg\.com\/use-m|\beval\s*\(/,
        name
      );
    }
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    assert.doesNotMatch(workflow, /\bnpm install\b|\bbun install\b/);
  });

  itUnless(sandboxed)(
    'enforces LF for every tracked shell script and hook',
    async () => {
      const runGit = (args) =>
        runBounded('git', args, {
          timeout: HANG_GUARD_MS / 2,
          trace:
            process.env.REPOSITORY_GIT_TRACE === '1'
              ? (event) =>
                  console.error(
                    '[repository-git]',
                    JSON.stringify({ args, ...event })
                  )
              : undefined,
        });
      const files = (
        await runGit(['ls-files', '-z', '*.sh', '.husky/*'])
      ).stdout
        .split('\0')
        .filter(Boolean);
      assert.ok(files.length > 0);
      // One real Git invocation checks every path, including paths with
      // spaces/newlines, without a synchronous process per tracked file.
      const attributes = await runGit([
        'check-attr',
        '-z',
        'eol',
        '--',
        ...files,
      ]);
      assert.deepEqual(
        attributes.stdout.split('\0').slice(0, -1),
        files.flatMap((file) => [file, 'eol', 'lf'])
      );
      for (const file of files) {
        assert.ok(!readFileSync(file, 'utf8').includes('\r'), file);
      }
    }
  );
});
