/** Bounded reproduction of the four-link enumeration performance criterion. */
import { performance } from 'node:perf_hooks';
import {
  representatives,
  classCount,
} from '../packages/ui-components/src/links-view/configurations.js';
for (const real of [false, true]) {
  const start = performance.now();
  const networks = representatives(4, { real });
  const elapsed = performance.now() - start;
  if (BigInt(networks.length) !== classCount(4, { real })) {
    throw new Error('Class count mismatch');
  }
  console.log(
    JSON.stringify({
      n: 4,
      real,
      classes: networks.length,
      milliseconds: Math.round(elapsed),
    })
  );
  if (elapsed >= 1000) {
    throw new Error('Four-link enumeration exceeded one second');
  }
}
