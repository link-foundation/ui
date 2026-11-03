import { URL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecording, serializeRecording } from '../src/index.js';

test('canonical recording round trips including ordered ties', () => {
  const text =
    'session: recording\n  seed 42\n  event 0ms\n    set ok label OK\n  event 0ms\n    mark saved\n';
  assert.equal(serializeRecording(parseRecording(text)), text);
});

test('sample recording and full step-1 fixture parse and round trip canonically', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseLinks, formatLinks } = await import('@link-foundation/ui-core');
  const sample = readFileSync(
    new URL(
      '../../../docs/case-studies/issue-1/samples/animation.lino',
      import.meta.url
    ),
    'utf8'
  );
  const recording = formatLinks(
    parseLinks(sample).filter((r) => r.values?.[0] === 'recording')
  );
  assert.equal(serializeRecording(parseRecording(recording)), recording);
  const full = readFileSync(
    new URL('./fixtures/recording-session.lino', import.meta.url),
    'utf8'
  );
  assert.equal(serializeRecording(parseRecording(full)), full);
});

test('invalid timestamps, kinds and duplicate headers are rejected', () => {
  for (const text of [
    'r: recording\n  event -1ms\n    mark bad\n',
    'r: recording\n  event 1.1ms\n    mark bad\n',
    'r: recording\n  seed 1\n  seed 2\n',
    'r: recording\n  event 0ms\n    unknown bad\n',
  ]) {
    assert.throws(() => parseRecording(text));
  }
});
