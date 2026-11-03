// A URL pathname is not an OS path: Windows drives and escaped spaces differ.
import assert from 'node:assert/strict';
import { win32 } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const url = new URL('file:///C:/work/space%20name/lino-network.mjs');
const native = fileURLToPath(url, { windows: true });
const pathname = win32.resolve('C:\\work', url.pathname);
console.log({ native, pathname });
assert.equal(native, 'C:\\work\\space name\\lino-network.mjs');
assert.notEqual(pathname, native);
