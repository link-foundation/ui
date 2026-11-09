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
import { describe, it } from 'test-anywhere';
import { runBounded, HANG_GUARD_MS } from './helpers/bounded-run.js';
import { itUnless, sandboxed } from './helpers/skip.js';

const workflow = readFileSync(
  '.github/workflows/release.yml',
  'utf8'
).replaceAll('\r\n', '\n');
const testJob = workflow.split('\n  test:\n')[1].split('\n  docker-build:')[0];

describe('Windows Deno file shards', () => {
  it('partitions only Windows Deno and preserves suite and job budgets', () => {
    assert.match(testJob, /exclude:[\s\S]*?- os: windows-2025\s+runtime: deno/);
    const shards = [
      ...testJob.matchAll(
        /- os: windows-2025\s+runtime: deno\s+shard: (\d\/\d)/g
      ),
    ].map((match) => match[1]);
    assert.deepEqual(shards, ['1/3', '2/3', '3/3']);
    assert.match(testJob, /DENO_SHARD: \$\{\{ matrix\.shard \|\| '1\/1' \}\}/);
    assert.match(
      testJob,
      /run-with-budget-warning\.sh 300 "Deno test suite" deno test -A --parallel --shard "\$DENO_SHARD"/
    );
    assert.match(testJob, /timeout-minutes: 15/);
    assert.match(testJob, /group: .*matrix\.shard/);
    assert.match(testJob, /fail-fast: false/);
  });

  it('limits competing Windows modules without changing other runners', () => {
    const denoStep = testJob
      .split('      - name: Run tests (Deno)')[1]
      .split('      - name: Repeat Windows Deno')[0];
    assert.match(
      denoStep,
      /if \[ "\$RUNNER_OS" = "Windows" \]; then\s+export DENO_JOBS=2\s+fi/
    );
    assert.match(denoStep, /deno test -A --parallel --shard "\$DENO_SHARD"/);
  });

  const denoAvailable =
    spawnSync('deno', ['--version'], { encoding: 'utf8' }).status === 0;
  itUnless(
    sandboxed,
    !denoAvailable && 'Deno is not installed; Deno CI exercises shards'
  )(
    'runs every discovered file exactly once and propagates a failing shard',
    async () => {
      const cwd = mkdtempSync(join(tmpdir(), 'deno-shards-'));
      const files = [
        'tests/first.test.js',
        'tests/second.test.js',
        'packages/one/tests/first.test.js',
        'packages/one/tests/nested/second.test.js',
        'packages/two/tests/third.test.js',
      ];
      const write = (file, text) => {
        mkdirSync(dirname(join(cwd, file)), { recursive: true });
        writeFileSync(join(cwd, file), text);
      };
      const run = (shard) =>
        runBounded('deno', ['test', '-A', '--parallel', '--shard', shard], {
          cwd,
          timeout: HANG_GUARD_MS,
        });
      try {
        copyFileSync('deno.json', join(cwd, 'deno.json'));
        for (const file of files) {
          write(
            file,
            `Deno.test('sentinel', () => console.log('OWNED:${file}'));\n`
          );
        }
        for (const file of [
          'examples/ignored.test.js',
          'node_modules/ignored.test.js',
          'packages/one/node_modules/ignored.test.js',
        ]) {
          write(file, "throw new Error('EXCLUDED_FILE_RAN');\n");
        }
        const seen = [];
        let failingShard;
        for (const shard of ['1/3', '2/3', '3/3']) {
          const result = await run(shard);
          assert.doesNotMatch(
            result.stdout + result.stderr,
            /EXCLUDED_FILE_RAN/
          );
          const owned = [...result.stdout.matchAll(/OWNED:([^\r\n]+)/g)].map(
            (match) => match[1]
          );
          seen.push(...owned);
          if (owned.includes(files[0])) {
            failingShard = shard;
          }
        }
        assert.deepEqual(seen.sort(), [...files].sort());
        write(
          files[0],
          "Deno.test('failure sentinel', () => { throw new Error('EXPECTED_FAILURE'); });\n"
        );
        await assert.rejects(run(failingShard), (error) => {
          assert.equal(error.code, 1);
          assert.match(error.stdout + error.stderr, /EXPECTED_FAILURE/);
          return true;
        });
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  );
});
