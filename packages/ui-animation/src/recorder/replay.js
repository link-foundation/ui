import { systemClock } from '../clock.js';
import { asRecording } from './format.js';
import { animationsAt, eventOptions, stateAt } from './state-at.js';
import { applyEvent, restoreStore } from './store.js';

/** Playback restores state from the snapshot; input handlers are never dispatched. */
export function replay(source, { store, player, clock = systemClock() }) {
  const recording = asRecording(source);
  if (recording.truncated) {
    throw new Error(
      'Cannot replay a truncated recording: initial events are missing'
    );
  }
  const duration = recording.events.at(-1)?.time ?? 0;
  let time = 0;
  let started = 0;
  let running = false;
  let timers = [];
  const controls = new Map();
  let resolvePlay;
  const addRun = (run) => {
    if (!player) {
      return;
    }
    const control = player.play(run.id, {
      target: run.target,
      input: run.input,
      seed: run.seed,
    });
    control.pause();
    control.seek(run.time);
    if (running) {
      control.play();
    }
    controls.set(run.run ?? run.id, control);
  };
  const render = (ms) => {
    controls.forEach((c) => c.cancel());
    controls.clear();
    time = Math.max(0, Math.min(duration, ms));
    restoreStore(store, stateAt(recording, time));
    for (const run of animationsAt(recording, time)) {
      addRun(run);
    }
  };
  const pause = () => {
    if (running) {
      time = Math.min(duration, started + clock.now());
    }
    running = false;
    timers.forEach((timer) => clock.clearTimeout(timer));
    timers = [];
    controls.forEach((c) => c.pause());
    resolvePlay?.();
    resolvePlay = null;
  };
  const apply = (event) => {
    time = event.time;
    store.transaction('Replay event', () => applyEvent(store, event), {
      origin: 'replay',
    });
    const options = eventOptions(event);
    if (event.kind === 'play') {
      addRun({
        id: event.args[0],
        time: 0,
        ...options,
        seed: options.seed ?? recording.seed,
      });
    }
    if (event.kind === 'cancel') {
      const key = options.run ?? event.args[0];
      controls.get(key)?.cancel();
      controls.delete(key);
    }
  };
  const api = {
    get time() {
      return running ? Math.min(duration, started + clock.now()) : time;
    },
    duration,
    pause,
    seek(ms) {
      if (!Number.isFinite(ms)) {
        throw new RangeError('Seek time must be finite');
      }
      pause();
      render(ms);
    },
    play() {
      pause();
      render(time);
      running = true;
      started = time - clock.now();
      controls.forEach((c) => c.play());
      const done = new Promise((resolve) => {
        resolvePlay = resolve;
      });
      for (const event of recording.events) {
        if (event.time > time) {
          timers.push(clock.setTimeout(() => apply(event), event.time - time));
        }
      }
      timers.push(
        clock.setTimeout(() => {
          time = duration;
          pause();
        }, duration - time)
      );
      return done;
    },
  };
  render(0);
  return api;
}
