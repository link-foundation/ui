import { parseNested, formatLinks } from '@link-foundation/ui-core';
import { networkToRaster } from './export.js';

const clone = (value) => globalThis.structuredClone(value);

function checkedInput(previous, patch) {
  const input = clone({ ...previous, ...patch });
  if (
    typeof input.index !== 'string' ||
    !/^(0|[1-9][0-9]*)$/u.test(input.index)
  ) {
    throw new TypeError('Network index must be a nonnegative decimal string');
  }
  if (typeof input.options !== 'string') {
    throw new TypeError('Network options must be Links Notation text');
  }
  parseNested(input.options);
  if (!Array.isArray(input.items)) {
    throw new TypeError('Network items must be an array');
  }
  return input;
}

function checkedFrame(frame) {
  if (!(frame?.positions instanceof Map) || !(frame.pins instanceof Map)) {
    throw new TypeError('Provider frame requires positions and pins maps');
  }
  for (const points of [frame.positions, frame.pins]) {
    for (const point of points.values()) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        throw new RangeError('Provider coordinates must be finite');
      }
    }
  }
  const b = frame.bounds;
  if (
    !b ||
    ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
    b.width <= 0 ||
    b.height <= 0
  ) {
    throw new RangeError('Provider frame requires finite, positive bounds');
  }
  return clone(frame);
}

/**
 * Transactional bridge for host geometry, collision solver and export backends.
 * Providers receive detached snapshots. Only the most recent completed job may
 * commit. No geometry/style settings are inferred, rounded or discarded.
 */
export function createNetworkPresentation(provider, { debug } = {}) {
  if (
    typeof provider.geometry !== 'function' ||
    typeof provider.svg !== 'function'
  ) {
    throw new TypeError(
      'A network provider requires geometry and svg functions'
    );
  }
  let input = { items: [], index: '0', options: '' };
  let requestedInput = input;
  let frame;
  let controller;
  let revision = 0;
  let committedRevision = 0;
  let disposed = false;
  const listeners = new Set();
  const snapshot = () => clone({ input, frame, revision: committedRevision });
  const assertReady = () => {
    if (disposed) {
      throw new Error('Network presentation is disposed');
    }
    if (!frame) {
      throw new Error('Network presentation has no prepared frame');
    }
  };
  const notify = () => {
    for (const listener of listeners) {
      listener(snapshot());
    }
  };
  async function run(kind, patch) {
    if (disposed) {
      throw new Error('Network presentation is disposed');
    }
    if (typeof provider[kind] !== 'function') {
      throw new TypeError(`Provider does not support ${kind}`);
    }
    const candidate = checkedInput(
      kind === 'geometry' ? requestedInput : input,
      patch
    );
    requestedInput = candidate;
    controller?.abort();
    const active = new globalThis.AbortController();
    controller = active;
    const job = ++revision;
    const request = {
      revision: job,
      input: clone(candidate),
      frame: clone(frame),
      signal: active.signal,
    };
    debug?.('network-provider:start', { kind, revision: job });
    try {
      const result = await provider[kind](request);
      if (disposed || job !== revision) {
        return false;
      }
      const next = checkedFrame(result);
      input = candidate;
      frame = next;
      committedRevision = job;
      debug?.('network-provider:commit', { kind, revision: job });
      notify();
      return true;
    } catch (error) {
      if (disposed || job !== revision) {
        return false;
      }
      requestedInput = input;
      debug?.('network-provider:error', {
        kind,
        revision: job,
        message: error.message,
      });
      throw error;
    }
  }
  function toSvg() {
    assertReady();
    const svg = provider.svg(snapshot());
    if (typeof svg !== 'string') {
      throw new TypeError('Provider svg must return a string');
    }
    return svg;
  }
  return {
    update: (patch) => run('geometry', patch),
    solve: () => {
      assertReady();
      return run('solve', {});
    },
    snapshot,
    toSvg,
    toRaster(type = 'image/png', options = {}) {
      // Capture both at the same revision before any asynchronous encoding.
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) {
        throw new RangeError('Unsupported network raster format');
      }
      const svg = toSvg();
      const state = snapshot();
      return provider.raster
        ? provider.raster({ ...state, svg, type, options })
        : networkToRaster(svg, { ...options, type });
    },
    toLino() {
      assertReady();
      const positionLinks = (points) =>
        [...points].map(([id, point]) => [
          String(id),
          String(point.x),
          String(point.y),
        ]);
      return formatLinks([
        {
          id: 'presentation',
          values: [
            'network-presentation',
            ['index', input.index],
            ['options', ...parseNested(input.options)],
            ['positions', ...positionLinks(frame.positions)],
            ['pins', ...positionLinks(frame.pins)],
            [
              'bounds',
              ...['x', 'y', 'width', 'height'].map((key) =>
                String(frame.bounds[key])
              ),
            ],
          ],
        },
      ]);
    },
    subscribe(listener) {
      if (disposed) {
        throw new Error('Network presentation is disposed');
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      ++revision;
      controller?.abort();
      listeners.clear();
    },
  };
}
