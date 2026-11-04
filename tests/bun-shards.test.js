import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'test-anywhere';
import { itUnless, sandboxed } from './helpers/skip.js';

const workflow = readFileSync(
  '.github/workflows/release.yml',
  'utf8'
).replaceAll('\r\n', '\n');
const testJob = workflow.split('\n  test:\n')[1].split('\n  docker-build:')[0];

describe('Windows Bun file shards', () => {
  it('replaces only the Windows Bun leg with three independent shards', () => {
    assert.match(testJob, /os: \[ubuntu-24\.04, macos-15, windows-2025\]/);
    assert.match(testJob, /runtime: \[node, bun, deno\]/);
    assert.match(testJob, /exclude:\s*- os: windows-2025\s+runtime: bun/);
    const shards = [
      ...testJob.matchAll(
        /- os: windows-2025\s+runtime: bun\s+shard: (\d\/\d)/g
      ),
    ].map((m) => m[1]);
    assert.deepEqual(shards, ['1/3', '2/3', '3/3']);
    assert.match(testJob, /group: .*matrix\.shard/);
    assert.match(testJob, /BUN_SHARD: \$\{\{ matrix\.shard \|\| '1\/1' \}\}/);
    assert.match(
      testJob,
      /run-with-budget-warning\.sh 300 "Bun test suite" bun test --timeout 30000 --isolate --shard "\$BUN_SHARD"/
    );
    assert.match(testJob, /timeout-minutes: 15/);
    assert.match(testJob, /fail-fast: false/);
  });

  const bunAvailable =
    spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0;
  itUnless(
    sandboxed,
    !bunAvailable && 'Bun is not installed; Bun CI exercises shards'
  )(
    'runs every maintained sentinel exactly once across shards and propagates failures',
    () => {
      const cwd = mkdtempSync(join(tmpdir(), 'bun-shards-'));
      const files = [
        'tests/first.test.js',
        'tests/second.test.js',
        'tests/third.test.js',
        'packages/one/tests/first.test.js',
        'packages/one/tests/nested/second.test.js',
        'packages/two/tests/third.test.js',
      ];
      const write = (file, text) => {
        mkdirSync(dirname(join(cwd, file)), { recursive: true });
        writeFileSync(join(cwd, file), text);
      };
      const run = (shard) =>
        spawnSync(
          'bun',
          ['test', '--timeout', '30000', '--isolate', '--shard', shard],
          {
            cwd,
            encoding: 'utf8',
            timeout: 10000,
          }
        );
      try {
        copyFileSync('bunfig.toml', join(cwd, 'bunfig.toml'));
        write('shared.js', 'export const state = {};\n');
        const shared = JSON.stringify(
          pathToFileURL(join(cwd, 'shared.js')).href
        );
        for (const file of files) {
          write(
            file,
            `import { test, expect } from 'bun:test';
import { state } from ${shared};
test('sentinel', () => {
  expect(globalThis.fixtureOwner).toBeUndefined();
  expect(state.owner).toBeUndefined();
  globalThis.fixtureOwner = state.owner = '${file}';
  console.log('OWNED:${file}');
});\n`
          );
        }
        for (const dir of [
          'docs',
          'examples',
          'experiments',
          'dev/log',
          'dist',
          'build',
          'coverage',
          'tests/e2e',
          'packages/one/tests/e2e',
        ]) {
          write(
            `${dir}/ignored.test.js`,
            "throw new Error('EXCLUDED_FILE_RAN');\n"
          );
        }
        const seen = [];
        for (const shard of ['1/3', '2/3', '3/3']) {
          const result = run(shard);
          assert.equal(result.status, 0, result.stdout + result.stderr);
          assert.doesNotMatch(
            result.stdout + result.stderr,
            /EXCLUDED_FILE_RAN/
          );
          seen.push(
            ...[...result.stdout.matchAll(/OWNED:(.+)/g)].map((m) =>
              m[1].trim()
            )
          );
        }
        assert.deepEqual(seen.sort(), [...files].sort());
        write(
          files[0],
          "import { test } from 'bun:test'; test('failure sentinel', () => { throw new Error('EXPECTED_FAILURE'); });\n"
        );
        const failed = ['1/3', '2/3', '3/3']
          .map(run)
          .filter((result) => result.status !== 0);
        assert.equal(failed.length, 1);
        assert.match(failed[0].stderr, /EXPECTED_FAILURE/);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  );
});
