import { createManualClock } from '../clock.js';
import { asRecording, parseRecording } from './format.js';
import { createRecorder } from './recorder.js';
import { isDiff, restoreStore } from './store.js';

/** createApp(seed, clock) returns { store, dispatchInput(event), dispose?() }. */
export async function verifyReplay(source, { createApp }) {
  const recording = asRecording(source);
  if (recording.truncated) {
    throw new Error('Cannot verify a truncated recording');
  }
  const clock = createManualClock();
  const app = await createApp(recording.seed, clock);
  let recorder;
  try {
    restoreStore(app.store, recording.snapshot);
    recorder = createRecorder({
      store: app.store,
      clock,
      seed: recording.seed,
      started: recording.started ?? 0,
      redact: recording.redacted !== false,
    });
    recorder.start();
    for (const event of recording.events) {
      clock.advance(event.time - clock.now());
      if (event.kind === 'input') {
        await app.dispatchInput(event);
      }
    }
    await Promise.resolve();
    const actual = parseRecording(recorder.stop()).events.filter(isDiff);
    const expected = recording.events.filter(isDiff);
    const mismatches = [];
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      if (JSON.stringify(expected[i]) !== JSON.stringify(actual[i])) {
        mismatches.push({
          time: expected[i]?.time ?? actual[i].time,
          expected: expected[i] ?? null,
          actual: actual[i] ?? null,
        });
      }
    }
    return { ok: mismatches.length === 0, mismatches };
  } finally {
    recorder?.stop();
    await app.dispose?.();
  }
}
