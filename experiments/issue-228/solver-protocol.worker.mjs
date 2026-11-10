// Finite protocol probe, not a collision solver or a renderer substitute.
import { parentPort } from 'node:worker_threads';
import { installSolverWorker } from '../../packages/ui-components/src/links-view/solver-job.js';

installSolverWorker(
  {
    addEventListener: (_type, listener) =>
      parentPort.on('message', (data) => listener({ data })),
    postMessage: (data) => parentPort.postMessage(data),
  },
  (links, options, { signal }) => ({ links, options, aborted: signal.aborted })
);
