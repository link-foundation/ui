import { asRecording } from './format.js';
import { applyEvent, snapshotStore, storeFromSnapshot } from './store.js';
import { endTime } from '../timing.js';
import { flattenTimeline } from '../timeline.js';

/** Pure: returns a LiNo snapshot, without mutating the recording or any caller store. */
export function stateAt(source, tMs) {
  const recording = asRecording(source);
  const store = storeFromSnapshot(recording.snapshot);
  for (const event of recording.events) {
    if (event.time <= tMs) {
      applyEvent(store, event);
    }
  }
  return snapshotStore(store);
}
export const eventOptions = (event) =>
  Object.fromEntries(
    event.args
      .slice(1)
      .filter(Array.isArray)
      .map(([key, value]) => [
        key,
        key === 'seed' && Number.isFinite(Number(value))
          ? Number(value)
          : value,
      ])
  );

/** Active play invocations, with local time; supply a model to exclude completed runs. */
export function animationsAt(source, tMs, { model, resolveToken } = {}) {
  const recording = asRecording(source);
  const runs = new Map();
  for (const event of recording.events) {
    if (event.time > tMs) {
      break;
    }
    const options = eventOptions(event);
    const key = options.run ?? event.args[0];
    if (event.kind === 'play') {
      runs.set(key, {
        id: event.args[0],
        time: tMs - event.time,
        started: event.time,
        ...options,
        seed: options.seed ?? recording.seed,
      });
    }
    if (event.kind === 'cancel') {
      runs.delete(key);
    }
  }
  return [...runs.values()].filter(
    (run) =>
      !model ||
      flattenTimeline(model, run.id, { target: run.target, resolveToken }).some(
        (entry) =>
          run.time <
          entry.start + endTime(model.animations.get(entry.id), resolveToken)
      )
  );
}
