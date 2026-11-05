/** Bounded probe of the nested palette property shape used by control adapters. */
import assert from 'node:assert/strict';
import { mountDoc } from '../packages/ui-components/tests/support/controls.js';
const t = mountDoc(`c: color-field 'Accent'
  palette
    Ocean '#1256ab'
    Sand '#eecbaa'`);
assert.equal(t.part('c', 'palette').children.length, 2);
assert.deepEqual(t.codes(), []);
console.log('Nested named palette renders two buttons without diagnostics.');
t.mounted.destroy();
