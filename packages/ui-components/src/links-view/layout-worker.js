import { buildNetwork } from './network-model.js';
import { NETWORK_LAYOUTS } from './layouts/index.js';

/** Pure worker entry, also directly callable by protocol tests. */
export function runLayoutJob({ key, id, job }) {
  try {
    const layout = NETWORK_LAYOUTS[job.layout];
    if (!layout) {
      throw new TypeError(`Unknown layout: ${job.layout}`);
    }
    const positions = layout(buildNetwork(job.links), job.options);
    for (const [pinId, point] of job.options?.pins ?? []) {
      if (positions.has(pinId)) {
        positions.set(pinId, point);
      }
    }
    return { key, id, positions: [...positions] };
  } catch (error) {
    return { key, id, error: error.message };
  }
}

/** Explicit installation avoids module-level mutable state on import. */
export function installLayoutWorker(scope) {
  scope.addEventListener('message', ({ data }) =>
    scope.postMessage(runLayoutJob(data))
  );
}
