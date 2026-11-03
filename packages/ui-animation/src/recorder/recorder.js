import { systemClock } from '../clock.js';
import { serializeRecording } from './format.js';
import { INPUT_EVENTS, inputEvent } from './input.js';
import {
  redactNode,
  redactOperation,
  sensitiveNode,
  sensitiveTarget,
} from './redact.js';
import { operationEvent, snapshotStore } from './store.js';
import { createEventBuffer } from './buffer.js';

function initialHeader(store, root, options, snapshot) {
  const view = root?.ownerDocument?.defaultView;
  return {
    id: 'recording-1',
    started: new Date(options.started ?? Date.now()).toISOString(),
    seed: options.seed ?? 0,
    viewport: options.viewport ?? [
      view?.innerWidth ?? 0,
      view?.innerHeight ?? 0,
    ],
    document: options.document ?? store.roots()[0] ?? 'app',
    snapshot,
    redacted: options.redact !== false,
  };
}
function playerEvent(event, time) {
  return {
    time,
    kind: event.kind,
    args: [
      event.id,
      ['run', String(event.run)],
      ...Object.entries(event.options)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ],
  };
}

/** Capture a session. start() begins a fresh session; stop() detaches every listener. */
export function createRecorder(options) {
  const {
    store,
    player,
    root,
    handle,
    clock = systemClock(),
    redact = true,
    maxEvents = 100000,
  } = options;
  let buffer = createEventBuffer(maxEvents);
  let recording;
  let origin;
  let active = false;
  let cleanups = [];
  let lastPointerBucket = -1;
  let sensitiveIds = new Set();
  const isSensitive = (id) => {
    for (
      let current = id;
      current !== null && current !== undefined && store.has(current);
      current = store.parentOf(current)
    ) {
      if (sensitiveIds.has(current) || sensitiveNode(store.get(current))) {
        return true;
      }
    }
    return false;
  };
  const time = () => Math.max(0, Math.floor(clock.now() - origin));
  const append = (event) => {
    if (active) {
      buffer.append(event);
    }
  };
  const capture = (event) => {
    if (redact && sensitiveTarget(event.target)) {
      sensitiveIds.add(handle?.idFor(event.target));
    }
    const recorded = inputEvent(
      event,
      { handle, store, redact, isSensitive },
      time()
    );
    if (!recorded) {
      return;
    }
    if (recorded.args[0] === 'pointer' && recorded.args[1] === 'move') {
      const bucket = Math.floor((recorded.time * 60) / 1000);
      if (lastPointerBucket === bucket) {
        return;
      }
      lastPointerBucket = bucket;
    }
    append(recorded);
  };
  const stopListeners = () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    active = false;
  };
  return {
    start() {
      stopListeners();
      origin = clock.now();
      buffer = createEventBuffer(maxEvents);
      lastPointerBucket = -1;
      sensitiveIds = new Set();
      for (const node of root?.querySelectorAll?.(
        '[type="password"], [sensitive="true"], [data-sensitive="true"]'
      ) ?? []) {
        sensitiveIds.add(handle?.idFor(node));
      }
      const snapshot = snapshotStore(
        store,
        redact ? (node, id) => redactNode(node, isSensitive(id)) : undefined
      );
      recording = initialHeader(store, root, options, snapshot);
      active = true;
      cleanups.push(
        store.subscribe((events, entry) => {
          for (const event of events) {
            if (sensitiveNode({ properties: event.props })) {
              sensitiveIds.add(event.id);
            }
          }
          for (const op of entry.ops) {
            append(
              operationEvent(
                redact
                  ? redactOperation(op, isSensitive(op.id ?? op.parentId))
                  : op,
                time()
              )
            );
          }
        })
      );
      if (player) {
        cleanups.push(
          player.subscribe((event) => append(playerEvent(event, time())))
        );
      }
      if (root) {
        for (const name of INPUT_EVENTS) {
          root.addEventListener(name, capture, {
            capture: true,
            passive: true,
          });
          cleanups.push(() =>
            root.removeEventListener(name, capture, { capture: true })
          );
        }
      }
    },
    stop() {
      if (!recording) {
        throw new Error('Recorder has not started');
      }
      stopListeners();
      recording.events = buffer.values();
      if (buffer.truncated) {
        recording.truncated = true;
      }
      return serializeRecording(recording);
    },
    mark(label) {
      append({ time: time(), kind: 'mark', args: [String(label)] });
    },
    size: () => buffer.size,
  };
}
