/**
 * parseMachine: the machine LiNo format, its diagnostics, and the
 * reference machines (which must also match their template strings).
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import {
  DISCLOSURE_MACHINE,
  MachineError,
  REFERENCE_MACHINES,
  TOGGLE_MACHINE,
  createMachine,
  parseDelay,
  parseMachine,
  parseMachines,
} from '@link-foundation/ui-components/behavior';

const MACHINES = new URL('../../src/behavior/machines/', import.meta.url);
const lino = (name) => readFileSync(new URL(`${name}.lino`, MACHINES), 'utf8');
const codes = (diagnostics) => diagnostics.map((d) => d.code);

describe('parseMachine: the reference machines', () => {
  it('reads toggle.lino without diagnostics', () => {
    const { machine, diagnostics } = parseMachine(lino('toggle'));
    expect(diagnostics).toEqual([]);
    expect(machine.id).toBe('toggle-machine');
    expect(machine.initial).toBe('off');
    expect(machine.context).toEqual({ pressed: false, disabled: false });
    expect(Object.keys(machine.states)).toEqual(['off', 'on']);
    expect(machine.states.off.on.toggle).toEqual([
      {
        target: 'on',
        actions: [{ type: 'set-pressed', args: [] }],
        guards: ['not-disabled'],
      },
    ]);
    expect(machine.parts.root.keys).toEqual([
      { key: 'Enter', event: 'toggle' },
      { key: 'Space', event: 'toggle' },
    ]);
  });

  it('reads disclosure.lino without diagnostics', () => {
    const { machine, diagnostics } = parseMachine(lino('disclosure'));
    expect(diagnostics).toEqual([]);
    expect(machine.id).toBe('disclosure-machine');
    expect(machine.initial).toBe('closed');
    expect(Object.keys(machine.states)).toEqual(['closed', 'open', 'closing']);
    expect(machine.states.open.entry).toEqual([
      { type: 'focus-content', args: [] },
    ]);
    expect(machine.states.open.exit).toEqual([
      { type: 'restore-focus', args: [] },
    ]);
    expect(machine.states.closing.after).toEqual([
      { delay: 500, target: 'closed', actions: [], guards: [] },
    ]);
    expect(Object.keys(machine.parts)).toEqual(['trigger', 'content']);
  });

  it('keeps the exported template strings equal to the .lino files', () => {
    expect(TOGGLE_MACHINE).toBe(lino('toggle'));
    expect(DISCLOSURE_MACHINE).toBe(lino('disclosure'));
    expect(Object.keys(REFERENCE_MACHINES)).toEqual([
      'toggle-machine',
      'disclosure-machine',
    ]);
  });

  it('reads a ui-core node as well as text', () => {
    const [root] = parse(TOGGLE_MACHINE).roots;
    const { machine, diagnostics } = parseMachine(root);
    expect(diagnostics).toEqual([]);
    expect(machine).toEqual(parseMachine(TOGGLE_MACHINE).machine);
  });

  it('returns a serialisable machine', () => {
    const { machine } = parseMachine(DISCLOSURE_MACHINE);
    expect(JSON.parse(JSON.stringify(machine))).toEqual(machine);
  });
});

describe('parseMachine: diagnostics', () => {
  it('names a transition to an unknown state', () => {
    const { diagnostics } = parseMachine(`(m: machine
  (initial a)
  (state a (on go (target nowhere))))`);
    expect(codes(diagnostics)).toEqual(['unknown-target']);
    expect(diagnostics[0].at).toEqual({
      machine: 'm',
      state: 'a',
      target: 'nowhere',
    });
    expect(diagnostics[0].message).toContain('"nowhere"');
  });

  it('names a missing initial state', () => {
    const { diagnostics } = parseMachine(`(m: machine (state a))`);
    expect(codes(diagnostics)).toEqual(['missing-initial']);
    expect(diagnostics[0].at.machine).toBe('m');
  });

  it('names an initial state that does not exist', () => {
    const { diagnostics } = parseMachine(`(m: machine (initial b) (state a))`);
    expect(codes(diagnostics)).toEqual(['unknown-initial']);
  });

  it('names a duplicate state', () => {
    const { diagnostics } = parseMachine(
      `(m: machine (initial a) (state a) (state a))`
    );
    expect(codes(diagnostics)).toEqual(['duplicate-state']);
    expect(diagnostics[0].at.state).toBe('a');
  });

  it('names an invalid delay and an unknown field', () => {
    // ui-core also reports the sublink it does not know as unknown-sublink.
    const { diagnostics } = parseMachine(`(m: machine
  (initial a)
  (colour red)
  (state a (after soon (target a))))`);
    expect(codes(diagnostics).sort()).toEqual([
      'invalid-delay',
      'unknown-field',
      'unknown-sublink',
    ]);
  });

  it('reports a source without a machine', () => {
    const { machine, diagnostics } = parseMachine('(b: button "Hi")');
    expect(machine).toBe(null);
    expect(codes(diagnostics)).toEqual(['invalid-machine']);
  });

  it('createMachine throws a MachineError listing the errors', () => {
    let error = null;
    try {
      createMachine(`(m: machine (state a))`);
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof MachineError).toBe(true);
    expect(codes(error.diagnostics)).toEqual(['missing-initial']);
  });

  it('parseMachines reads every machine of a document', () => {
    const { machines, diagnostics } = parseMachines(
      `${TOGGLE_MACHINE}\n${DISCLOSURE_MACHINE}`
    );
    expect(diagnostics).toEqual([]);
    expect([...machines.keys()]).toEqual([
      'toggle-machine',
      'disclosure-machine',
    ]);
  });
});

describe('parseDelay', () => {
  it('reads ms, s and plain numbers', () => {
    expect(parseDelay('500ms')).toBe(500);
    expect(parseDelay('2s')).toBe(2000);
    expect(parseDelay('250')).toBe(250);
  });

  it('rejects anything else', () => {
    expect(Number.isNaN(parseDelay('soon'))).toBe(true);
    expect(Number.isNaN(parseDelay('-5ms'))).toBe(true);
    expect(Number.isNaN(parseDelay(['500ms']))).toBe(true);
  });
});
