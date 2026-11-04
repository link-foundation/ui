import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import {
  HANG_GUARD_MS,
  killTree,
  removeFixture,
  runBounded,
} from './helpers/bounded-run.js';
import { itUnless, sandboxed } from './helpers/skip.js';
import { isProcessAlive } from './helpers/process-state.js';

// The child starts a grandchild that shares its output pipe and outlives it,
// like cmd.exe starting npx: only a tree kill ends both.
const GRANDCHILD = `
import { readProcess } from ${JSON.stringify(new URL('./helpers/process-state.js', import.meta.url).href)};
console.log('grandchild ' + JSON.stringify(readProcess(process.pid)));
setInterval(() => {}, 1000);
`;
const PARENT = `
const { spawn } = require('node:child_process');
spawn(process.execPath, ['--input-type=module', '-e', ${JSON.stringify(GRANDCHILD)}], {
  stdio: 'inherit',
});
setInterval(() => {}, 1000);
`;

function descendant(stdout) {
  const record = /^grandchild (.+)$/m.exec(stdout)?.[1];
  assert.ok(record, `no grandchild identity in ${stdout}`);
  const identity = JSON.parse(record);
  assert.ok(identity?.pid > 0, `invalid grandchild identity: ${record}`);
  if (process.platform === 'linux') {
    assert.ok(identity.startTime && identity.group, record);
  }
  return identity;
}

describe('killTree', () => {
  it('kills the whole tree with taskkill on Windows', () => {
    const calls = [];
    killTree(42, {
      platform: 'win32',
      run: (...args) => calls.push(args),
    });
    expect(calls).toEqual([
      ['taskkill', ['/pid', '42', '/T', '/F'], { stdio: 'ignore' }],
    ]);
  });

  it('kills the process group on POSIX', () => {
    const calls = [];
    killTree(42, {
      platform: 'linux',
      kill: (...args) => calls.push(args),
    });
    expect(calls).toEqual([[-42, 'SIGKILL']]);
  });

  it('ignores a group that has already exited, and nothing else', () => {
    const failWith = (code) => () => {
      throw Object.assign(new Error(code), { code });
    };
    killTree(42, { platform: 'linux', kill: failWith('ESRCH') });
    assert.throws(
      () => killTree(42, { platform: 'linux', kill: failWith('EPERM') }),
      /EPERM/
    );
  });
});

describe('runBounded', () => {
  itUnless(sandboxed)(
    'returns the output of a successful command',
    async () => {
      const result = await runBounded(
        'node',
        ['-e', 'console.log("out"); console.error("err")'],
        { timeout: HANG_GUARD_MS }
      );
      expect(result.stdout).toBe('out\n');
      expect(result.stderr).toBe('err\n');
    }
  );

  itUnless(sandboxed)(
    'reports the exit code and output of a failure',
    async () => {
      await assert.rejects(
        runBounded('node', ['-e', 'console.error("bad"); process.exit(3)'], {
          timeout: HANG_GUARD_MS,
        }),
        (error) =>
          error.code === 3 &&
          !error.timedOut &&
          error.stderr === 'bad\n' &&
          /exited with code 3/.test(error.message)
      );
    }
  );

  itUnless(sandboxed)(
    'kills descendants on timeout and reports the timeout',
    async () => {
      let failure;
      try {
        await runBounded('node', ['-e', PARENT], { timeout: 2000 });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure, 'the command must not succeed');
      expect(failure.timedOut).toBe(true);
      expect(failure.message).toContain('timed out after 2000 ms');
      // The pipes closed by themselves, so no descendant kept them open.
      expect(failure.elapsedMs).toBeLessThan(6000);
      const identity = descendant(failure.stdout);
      // taskkill returns before Windows finishes tearing processes down.
      for (
        let attempt = 0;
        attempt < 50 && isProcessAlive(identity);
        attempt++
      ) {
        await new Promise((done) => setTimeout(done, 100));
      }
      expect(isProcessAlive(identity)).toBe(false);
    }
  );

  itUnless(sandboxed)(
    'settles when a descendant escapes the kill and holds the pipes',
    async () => {
      // A detached grandchild leaves the POSIX process group. Windows
      // taskkill /T still finds it by parent process, so the run settles there too.
      const escaped = PARENT.replace(
        "stdio: 'inherit'",
        "stdio: 'inherit', detached: true"
      );
      let failure;
      try {
        await runBounded('node', ['-e', escaped], {
          timeout: 1000,
          closeAfterKillMs: 500,
        });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure, 'the command must not succeed');
      expect(failure.timedOut).toBe(true);
      const identity = descendant(failure.stdout);
      if (isProcessAlive(identity)) {
        process.kill(identity.pid, 'SIGKILL');
      }
    }
  );
});

describe('removeFixture', () => {
  const busy = () => {
    throw new Error('EBUSY: resource busy or locked, rm');
  };

  it('fails a passing test whose fixture cannot be removed', () => {
    assert.throws(() => removeFixture('dir', undefined, busy), /EBUSY/);
  });

  it('keeps the test failure when cleanup fails too', () => {
    const original = console.error;
    const logged = [];
    console.error = (message) => logged.push(message);
    try {
      removeFixture('dir', new Error('timed out'), busy);
    } finally {
      console.error = original;
    }
    expect(logged).toEqual([
      'Fixture cleanup also failed: Error: EBUSY: resource busy or locked, rm',
    ]);
  });
});
