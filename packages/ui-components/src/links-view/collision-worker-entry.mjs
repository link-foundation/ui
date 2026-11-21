import { installSolverWorker } from './solver-job.js';
import { solveCollisions } from './collisions.js';

installSolverWorker(globalThis, solveCollisions);
