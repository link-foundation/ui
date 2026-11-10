import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuildTrace, TRACE_PREFIX } from '../build-trace.js';

const clock =
  (...times) =>
  () =>
    times.shift();

test('build trace is silent by default', () => {
  const lines = [];
  const trace = createBuildTrace({
    enabled: false,
    now: () => assert.fail('a disabled trace must not read the clock'),
    write: (line) => lines.push(line),
  });
  trace.mark('vite config');
  trace.start('generate pages');
  trace.end('generate pages');
  assert.equal(trace.enabled, false);
  assert.deepEqual(lines, []);
});

test('build trace reports marks and phase durations with elapsed time', () => {
  const lines = [];
  const trace = createBuildTrace({
    enabled: true,
    now: clock(120.4, 200, 1450.6, 1450.6, 1500),
    write: (line) => lines.push(line),
  });
  trace.mark('vite config');
  trace.start('generate pages');
  trace.end('generate pages');
  trace.end('generate pages');
  trace.end('never started');
  trace.mark('build closed');
  assert.deepEqual(lines, [
    `${TRACE_PREFIX} vite config (at 120ms)`,
    `${TRACE_PREFIX} generate pages: 1251ms (at 1451ms)`,
    `${TRACE_PREFIX} build closed (at 1500ms)`,
  ]);
});

test('build trace follows SITE_BUILD_TRACE when not configured', () => {
  const previous = process.env.SITE_BUILD_TRACE;
  try {
    delete process.env.SITE_BUILD_TRACE;
    assert.equal(createBuildTrace().enabled, false);
    process.env.SITE_BUILD_TRACE = '1';
    assert.equal(createBuildTrace().enabled, true);
  } finally {
    if (previous === undefined) {
      delete process.env.SITE_BUILD_TRACE;
    } else {
      process.env.SITE_BUILD_TRACE = previous;
    }
  }
});
