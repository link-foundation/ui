// Reproduce #126 with the original update routing, restoring the source even
// when the regression check fails. Run with no concurrent tests or server.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { URL } from 'node:url';

const patch = new URL('../../packages/ui-dom/src/patch.js', import.meta.url);
const current = readFileSync(patch, 'utf8');
const routing = `ok =
          event.prop === undefined
            ? tree.updatePositional(event.id, event.after)
            : tree.update(event.id, event.props ?? [], [event.prop]);`;
assert.ok(current.includes(routing), 'Expected positional routing to replace');
try {
  writeFileSync(
    patch,
    current.replace(
      routing,
      'ok = tree.update(event.id, event.props ?? [], [event.prop]);'
    )
  );
  const result = spawnSync(
    process.execPath,
    ['--test', 'packages/ui-dom/tests/incremental.test.js'],
    { cwd: new URL('../../', import.meta.url), encoding: 'utf8' }
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  assert.equal(result.status, 1, 'Original routing must fail regression tests');
  assert.match(result.stdout, /Save/);
  assert.match(result.stdout, /Edited/);
} finally {
  writeFileSync(patch, current);
}
