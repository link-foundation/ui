import assert from 'node:assert/strict';
import { describe, it, expect } from 'test-anywhere';
import { isProcessAlive, readProcess } from './helpers/process-state.js';

const identity = { pid: 42, group: '40', startTime: '1234567890123456789' };
// Field 2 deliberately includes a space and the delimiter the old reader used.
const stat = (state = 'S', startTime = identity.startTime, group = '40') =>
  `42 (node ) worker) ${state} 1 ${group} ${Array(16).fill('0').join(' ')} ${startTime}`;
const missing = (code) => Object.assign(new Error(code), { code });
const runtime = (read, extra = {}) => ({
  platform: 'linux',
  read,
  trace: null,
  ...extra,
});

describe('process-state observation', () => {
  it('does not resurrect a zombie reaped between polling and assertion', () => {
    const entries = [];
    let reads = 0;
    const options = runtime(
      () => {
        if (reads++ === 0) {
          return stat('Z').replace('(node ) worker)', '(node)');
        }
        throw missing('ENOENT');
      },
      { kill: () => {}, trace: (entry) => entries.push(entry) }
    );
    expect(isProcessAlive(identity, options)).toBe(false);
    expect(isProcessAlive(identity, options)).toBe(false);
    expect(
      entries.map(({ observed, probe }) => [observed?.state, probe])
    ).toEqual([
      ['Z', 'ok'],
      [undefined, 'ok'],
    ]);
  });

  it('recognizes a running descendant and parses comm with spaces and parentheses', () => {
    const options = runtime(() => stat(), {
      kill: () => {
        throw new Error('unexpected signal probe');
      },
    });
    expect(readProcess(42, options)).toEqual({ ...identity, state: 'S' });
    expect(isProcessAlive(identity, options)).toBe(true);
  });

  it('distinguishes PID reuse even within the same process group', () => {
    expect(
      isProcessAlive(
        identity,
        runtime(() => stat('S', '999'))
      )
    ).toBe(false);
    expect(
      isProcessAlive(
        identity,
        runtime(() => stat('S', identity.startTime, '41'))
      )
    ).toBe(true);
  });

  it('recognizes zombie, dead and reaped processes', () => {
    for (const state of ['Z', 'X', 'x']) {
      expect(
        isProcessAlive(
          identity,
          runtime(() => stat(state))
        )
      ).toBe(false);
    }
    for (const code of ['ENOENT', 'ESRCH']) {
      expect(
        isProcessAlive(
          identity,
          runtime(() => {
            throw missing(code);
          })
        )
      ).toBe(false);
    }
  });

  it('fails on unexpected proc errors and incomplete records', () => {
    assert.throws(
      () =>
        isProcessAlive(
          identity,
          runtime(() => {
            throw missing('EACCES');
          })
        ),
      /EACCES/
    );
    assert.throws(
      () =>
        readProcess(
          42,
          runtime(() => '42 (node) S')
        ),
      /Incomplete/
    );
  });

  it('uses portable signal probes outside Linux and keeps permission errors alive', () => {
    for (const platform of ['win32', 'darwin']) {
      for (const code of ['ok', 'EPERM', 'ESRCH']) {
        const options = {
          platform,
          kill: () => {
            if (code !== 'ok') {
              throw missing(code);
            }
          },
        };
        expect(isProcessAlive({ pid: 42 }, options)).toBe(code !== 'ESRCH');
      }
      assert.throws(
        () =>
          isProcessAlive(
            { pid: 42 },
            {
              platform,
              kill: () => {
                throw missing('EINVAL');
              },
            }
          ),
        /EINVAL/
      );
    }
  });
});
