/**
 * interpret: the toggle machine, guards, context operations, attributes,
 * subscriptions and machine-local actions.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  TOGGLE_MACHINE,
  attrValue,
  createMachine,
  interpret,
} from '@link-foundation/ui-components/behavior';

const toggle = () => createMachine(TOGGLE_MACHINE);

describe('interpret: the toggle machine', () => {
  it('goes off → on → off', () => {
    const service = interpret(toggle());
    expect(service.state).toBe('off');
    expect(service.send('toggle')).toBe(true);
    expect(service.state).toBe('on');
    expect(service.send('toggle')).toBe(true);
    expect(service.state).toBe('off');
  });

  it("has attrs('root') = {'aria-pressed': 'true'} in on", () => {
    const service = interpret(toggle());
    expect(service.attrs('root')).toEqual({ 'aria-pressed': 'false' });
    service.send('toggle');
    expect(service.attrs('root')).toEqual({ 'aria-pressed': 'true' });
  });

  it('runs the built-in (set pressed true) and (toggle pressed)', () => {
    const service = interpret(
      createMachine(`(m: machine
  (initial a)
  (context (pressed false) (count 1))
  (state a
    (on press (target b) (do (set pressed true) (set count 2)))
    (on flip (do (toggle pressed))))
  (state b))`)
    );
    service.send('flip');
    expect(service.context).toEqual({ pressed: true, count: 1 });
    service.send('flip');
    expect(service.context.pressed).toBe(false);
    service.send('press');
    expect(service.state).toBe('b');
    expect(service.context).toEqual({ pressed: true, count: 2 });
  });

  it('ignores an event the state does not handle', () => {
    const service = interpret(toggle());
    expect(service.send('unknown')).toBe(false);
    expect(service.state).toBe('off');
  });

  it('accepts LiNo text and an initial context override', () => {
    const service = interpret(TOGGLE_MACHINE, { context: { pressed: true } });
    expect(service.attrs('root')).toEqual({ 'aria-pressed': 'true' });
  });

  it('throws on a value that is not a machine', () => {
    expect(() => interpret({})).toThrow();
  });
});

describe('interpret: guards', () => {
  it('a false guard blocks the transition', () => {
    const service = interpret(toggle(), { context: { disabled: true } });
    expect(service.can('toggle')).toBe(false);
    expect(service.send('toggle')).toBe(false);
    expect(service.state).toBe('off');
    service.assign({ disabled: false });
    expect(service.send('toggle')).toBe(true);
    expect(service.state).toBe('on');
  });

  it('runs host guards with the context and the event', () => {
    const seen = [];
    const machine = createMachine(`(m: machine
  (initial a)
  (state a (on go (target b) (when allowed)))
  (state b))`);
    const service = interpret(machine, {
      guards: {
        allowed(context, event) {
          seen.push(event);
          return event.ok === true;
        },
      },
    });
    expect(service.send({ type: 'go', ok: false })).toBe(false);
    expect(service.send({ type: 'go', ok: true })).toBe(true);
    expect(seen.map((e) => e.ok)).toEqual([false, true]);
  });

  it('takes the first transition whose guards pass', () => {
    const machine = createMachine(`(m: machine
  (initial a)
  (state a (on go (target b) (when never)) (on go (target c)))
  (state b)
  (state c))`);
    const service = interpret(machine, { guards: { never: () => false } });
    service.send('go');
    expect(service.state).toBe('c');
  });

  it('an unknown or throwing guard blocks and is reported', () => {
    const diagnostics = [];
    const machine = createMachine(`(m: machine
  (initial a)
  (state a (on go (target b) (when missing)) (on boom (target b) (when bad)))
  (state b))`);
    const service = interpret(machine, {
      guards: {
        bad() {
          throw new Error('nope');
        },
      },
      onDiagnostic: (d) => diagnostics.push(d),
    });
    expect(service.send('go')).toBe(false);
    expect(service.send('boom')).toBe(false);
    expect(service.state).toBe('a');
    expect(diagnostics.map((d) => d.code)).toEqual([
      'unknown-guard',
      'guard-error',
    ]);
  });
});

describe('interpret: actions, entry and exit', () => {
  it('runs exit, transition and entry actions in order', () => {
    const calls = [];
    const machine = createMachine(`(m: machine
  (initial a)
  (state a (exit (log exit-a)) (on go (target b) (do (log go))))
  (state b (entry (log enter-b))))`);
    const service = interpret(machine, {
      actions: { log: ([what]) => calls.push(what) },
    });
    service.send('go');
    expect(calls).toEqual(['exit-a', 'go', 'enter-b']);
  });

  it('passes the state, context and event to registry actions', () => {
    let meta = null;
    const machine = createMachine(`(m: machine
  (initial a)
  (context (n 1))
  (state a (on go (do (record x)))))`);
    const service = interpret(machine, {
      actions: {
        record: (args, m) => {
          meta = { args, ...m };
          m.assign({ n: 2 });
        },
      },
    });
    service.send('go');
    expect(meta.args).toEqual(['x']);
    expect(meta.state).toBe('a');
    expect(meta.event).toBe('go');
    expect(meta.context).toEqual({ n: 1 });
    expect(service.context).toEqual({ n: 2 });
  });

  it('queues events sent while an event is processed', () => {
    const machine = createMachine(`(m: machine
  (initial a)
  (state a (on go (target b) (do (again))))
  (state b (on next (target c)))
  (state c))`);
    let service = null;
    service = interpret(machine, {
      actions: { again: () => service.send('next') },
    });
    service.send('go');
    expect(service.state).toBe('c');
  });

  it('reports machine actions that expand forever', () => {
    const diagnostics = [];
    const machine = createMachine(`(m: machine
  (initial a)
  (action loop loop)
  (state a (on go (do loop))))`);
    const service = interpret(machine, {
      onDiagnostic: (d) => diagnostics.push(d),
    });
    service.send('go');
    expect(diagnostics.map((d) => d.code)).toEqual(['action-error']);
  });
});

describe('interpret: subscribe and stop', () => {
  it('notifies subscribers of each change until they unsubscribe', () => {
    const service = interpret(toggle());
    const snapshots = [];
    const unsubscribe = service.subscribe((s) => snapshots.push(s));
    service.send('toggle');
    service.send('nothing');
    unsubscribe();
    service.send('toggle');
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].state).toBe('on');
    expect(snapshots[0].context.pressed).toBe(true);
    expect(snapshots[0].event).toEqual({ type: 'toggle' });
  });

  it('ignores events after stop()', () => {
    const service = interpret(toggle());
    service.stop();
    expect(service.status).toBe('stopped');
    expect(service.send('toggle')).toBe(false);
    expect(service.state).toBe('off');
  });

  it('keeps the context frozen', () => {
    const service = interpret(toggle());
    expect(Object.isFrozen(service.context)).toBe(true);
  });
});

describe('attrValue', () => {
  const context = { pressed: true, label: 'Hi' };
  it('reads every value form', () => {
    expect(attrValue('dialog', 'open', context)).toBe('dialog');
    expect(attrValue(['context', 'label'], 'open', context)).toBe('Hi');
    expect(attrValue(['context', 'missing'], 'open', context)).toBe(null);
    expect(attrValue(['in', 'open', 'closing'], 'open', context)).toBe('true');
    expect(attrValue(['in', 'closed'], 'open', context)).toBe('false');
    expect(attrValue(['not', ['in', 'closed']], 'open', context)).toBe('true');
    expect(attrValue(['present', ['in', 'open']], 'open', context)).toBe('');
    expect(attrValue(['present', ['in', 'x']], 'open', context)).toBe(null);
    expect(attrValue(['state'], 'open', context)).toBe('open');
    expect(attrValue(['unknown'], 'open', context)).toBe(null);
  });
});
