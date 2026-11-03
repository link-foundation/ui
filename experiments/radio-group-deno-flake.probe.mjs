/**
 * Probe of the Deno-only flake of radio-group.test.js (#34): the
 * aria-checked of the radios after each timer turn that follows the mount.
 *
 *   deno test -A experiments/radio-group-deno-flake.probe.mjs
 *
 * In Deno the radios are usually checked only after the second turn, never
 * after the first in Node: jsdom's MutationObserver notification runs from
 * Deno's Node-compat tick drain (`processTicksAndRejections` <-
 * `__drainNextTickAndMacrotasks`), and the microtask that `watchChildren`
 * queues from it runs after the expired `setTimeout(0)` of the same drain.
 * The `microtasks()` test helper therefore waits a few timer turns.
 */

import { it } from 'test-anywhere';
import { mountDoc } from '../packages/ui-components/tests/support/controls.js';

it('probe', async () => {
  const t = mountDoc(`  (size: radio-group (label 'Size') (name size) (value m)
    (s: radio (label 'Small') (value s))
    (m: radio (label 'Medium') (value m))
    (l: radio (label 'Large') (value l) (disabled true)))`);
  const seen = [];
  for (let turn = 0; turn < 4; turn++) {
    seen.push(
      ['s', 'm', 'l']
        .map((id) => t.part(id, 'input').getAttribute('aria-checked'))
        .join(',')
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  console.log('PROBE', JSON.stringify(seen));
});
