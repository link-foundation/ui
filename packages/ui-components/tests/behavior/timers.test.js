/**
 * `(after DELAY ...)` with an injected clock: the disclosure machine's
 * closing state, and stop() clearing pending timers.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  DISCLOSURE_MACHINE,
  createMachine,
  createManualClock,
  interpret,
} from '@link-foundation/ui-components/behavior';

const disclosure = (clock) =>
  interpret(createMachine(DISCLOSURE_MACHINE), {
    clock,
    actions: { focus: () => {} },
  });

describe('after: delayed transitions', () => {
  it('after 500ms fires only once the fake clock advances 500', () => {
    const clock = createManualClock();
    const service = disclosure(clock);
    service.send('open');
    service.send('close');
    expect(service.state).toBe('closing');
    expect(clock.pending()).toBe(1);
    clock.advance(499);
    expect(service.state).toBe('closing');
    clock.advance(1);
    expect(service.state).toBe('closed');
    expect(clock.pending()).toBe(0);
  });

  it('leaving the state cancels its timer', () => {
    const clock = createManualClock();
    const service = disclosure(clock);
    service.send('open');
    service.send('close');
    service.send('open');
    expect(service.state).toBe('open');
    expect(clock.pending()).toBe(0);
    clock.advance(1000);
    expect(service.state).toBe('open');
  });

  it('stop() clears pending timers', () => {
    const clock = createManualClock();
    const service = disclosure(clock);
    service.send('open');
    service.send('close');
    expect(clock.pending()).toBe(1);
    service.stop();
    expect(clock.pending()).toBe(0);
    clock.advance(1000);
    expect(service.state).toBe('closing');
  });

  it('schedules the timers of the initial state', () => {
    const clock = createManualClock();
    const service = interpret(
      createMachine(`(m: machine
  (initial wait)
  (state wait (after 2s (target done)))
  (state done))`),
      { clock }
    );
    clock.advance(1999);
    expect(service.state).toBe('wait');
    clock.advance(1);
    expect(service.state).toBe('done');
  });

  it('notifies subscribers of a delayed transition', () => {
    const clock = createManualClock();
    const service = disclosure(clock);
    const states = [];
    service.subscribe((s) => states.push(s.state));
    service.send('open');
    service.send('close');
    clock.advance(500);
    expect(states).toEqual(['open', 'closing', 'closed']);
  });
});

describe('createManualClock', () => {
  it('runs due timers in time order', () => {
    const clock = createManualClock();
    const order = [];
    clock.setTimeout(() => order.push('b'), 20);
    clock.setTimeout(() => order.push('a'), 10);
    const c = clock.setTimeout(() => order.push('c'), 15);
    clock.clearTimeout(c);
    clock.advance(25);
    expect(order).toEqual(['a', 'b']);
    expect(clock.now).toBe(25);
  });
});
