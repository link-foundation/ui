/* global URL */
import { createSolverJob } from './solver-job.js';
import { solveCollisions } from './collisions.js';

/** Use the packaged worker in browsers, with the same solver as a fallback. */
export function createCollisionSolver(configuration = {}) {
  return createSolverJob(solveCollisions, {
    workerUrl: new URL(
      '../../dist/network-collision.worker.mjs',
      import.meta.url
    ),
    ...configuration,
  });
}
