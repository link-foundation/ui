import { describe, it, expect } from 'test-anywhere';
import {
  createMachine,
  interpret,
} from '@link-foundation/ui-components/behavior';
import { JSDOM } from 'jsdom';
import { mountBehavior } from '@link-foundation/ui-components/behavior/dom';
import { bindSound } from '../src/bind.js';

describe('framework sound binding', () => {
  it('maps a #33 press to click once even for multiple handler actions', () => {
    const calls = [];
    const binding = bindSound({ play: (name) => calls.push(name) });
    const { window } = new JSDOM('<!doctype html><div id="app"></div>');
    const behavior = mountBehavior(
      window.document.getElementById('app'),
      `page: document
  button: button
    label Go
    on press
      emit one
      emit two
`,
      { onAction: binding.onAction }
    );
    expect(behavior.diagnostics).toEqual([]);
    const button = behavior.handle.nodeFor('button').querySelector('button');
    button.click();
    expect(calls).toEqual(['click']);
    binding.dispose();
    button.click();
    behavior.destroy();
    window.close();
    expect(calls).toEqual(['click']);
  });
  it('subscribes to actual machine transitions and unsubscribes', () => {
    const service = interpret(
      createMachine(`test: machine
  initial closed
  state closed
    on open
      target opened
  state opened
    on close
      target closed
`)
    );
    const calls = [];
    const binding = bindSound(
      { play: (name) => calls.push(name) },
      { machines: [service] }
    );
    service.send('open');
    service.send('close');
    expect(calls).toEqual(['open', 'close']);
    binding.dispose();
    service.send('open');
    expect(calls).toEqual(['open', 'close']);
    service.stop();
  });
});

describe('custom sound mappings', () => {
  it('uses a LiNo mapping and ignores unbound events', () => {
    const calls = [];
    const binding = bindSound(
      { play: (name) => calls.push(name) },
      { mapping: 'sound-map\n  press notify\n' }
    );
    binding.onAction({ event: 'press' });
    binding.onAction({ event: 'open' });
    expect(calls).toEqual(['notify']);
    binding.dispose();
  });
});
