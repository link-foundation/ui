/**
 * The machines of the basic controls: the embedded text is the `.lino`
 * file byte for byte, and every machine parses without a diagnostic.
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { parseMachine } from '../../src/behavior/parse-machine.js';
import { CONTROL_MACHINES } from '../../src/controls/index.js';

const DIR = fileURLToPath(
  new URL('../../src/controls/machines/', import.meta.url)
);

describe('control machines', () => {
  const files = readdirSync(DIR)
    .filter((name) => name.endsWith('.lino'))
    .map((name) => name.slice(0, -'.lino'.length));

  it('embeds every machines/<kind>.lino and nothing else', () => {
    expect(Object.keys(CONTROL_MACHINES).sort()).toEqual(files.sort());
    for (const kind of files) {
      expect(CONTROL_MACHINES[kind]).toBe(
        readFileSync(`${DIR}${kind}.lino`, 'utf8')
      );
    }
  });

  it('parses every machine without a diagnostic', () => {
    for (const [kind, text] of Object.entries(CONTROL_MACHINES)) {
      const { machine, diagnostics } = parseMachine(text);
      expect([kind, diagnostics]).toEqual([kind, []]);
      expect(machine.id).toBe(`${kind}-machine`);
    }
  });
});
