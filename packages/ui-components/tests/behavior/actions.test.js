/**
 * The actions registry: register, has, dispatch, the vocabulary defaults
 * and their host hooks.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  VOCABULARY_ACTIONS,
  checkHandler,
  createActionRegistry,
  dispatchHandler,
  fail,
} from '@link-foundation/ui-components/behavior';

describe('createActionRegistry', () => {
  it('registers, dispatches and unregisters actions', () => {
    const registry = createActionRegistry();
    const calls = [];
    const unregister = registry.register('greet', (args, meta) => {
      calls.push([args, meta.source]);
      return 'hi';
    });
    expect(registry.has('greet')).toBe(true);
    expect(registry.dispatch('greet', ['ada'], { source: 'b' })).toEqual({
      ok: true,
      value: 'hi',
    });
    expect(calls).toEqual([[['ada'], 'b']]);
    unregister();
    expect(registry.has('greet')).toBe(false);
  });

  it('has the vocabulary actions by default', () => {
    expect(VOCABULARY_ACTIONS).toEqual([
      'navigate',
      'emit',
      'set',
      'toggle',
      'focus',
    ]);
    const registry = createActionRegistry();
    expect(VOCABULARY_ACTIONS.every((name) => registry.has(name))).toBe(true);
    expect(createActionRegistry({ defaults: false }).names()).toEqual([]);
  });

  it('reports an unknown action to onUnknown and runs nothing', () => {
    const unknown = [];
    const registry = createActionRegistry({
      onUnknown: (d) => unknown.push(d),
    });
    const result = registry.dispatch('launch', ['missiles']);
    expect(result.ok).toBe(false);
    expect(result.diagnostic.code).toBe('unknown-action');
    expect(unknown.map((d) => d.at)).toEqual([{ action: 'launch' }]);
  });

  it('turns a throwing action into an action-error diagnostic', () => {
    const diagnostics = [];
    const registry = createActionRegistry({
      onDiagnostic: (d) => diagnostics.push(d),
    });
    registry.register('boom', () => {
      throw new Error('bang');
    });
    registry.register('refuse', () =>
      fail('invalid-argument', { reason: 'x' })
    );
    expect(registry.dispatch('boom').diagnostic.code).toBe('action-error');
    expect(registry.dispatch('refuse').diagnostic.code).toBe(
      'invalid-argument'
    );
    expect(diagnostics.length).toBe(2);
  });

  it('rejects registrations that are not a name and a function', () => {
    const registry = createActionRegistry();
    expect(() => registry.register('', () => {})).toThrow();
    expect(() => registry.register('x', 'alert(1)')).toThrow();
  });

  it('freezes the arguments passed to an action', () => {
    const registry = createActionRegistry();
    let frozen = false;
    registry.register('look', (args) => {
      frozen = Object.isFrozen(args);
    });
    registry.dispatch('look', ['a']);
    expect(frozen).toBe(true);
  });
});

describe('vocabulary defaults', () => {
  it('call the host function of the same name', () => {
    const calls = [];
    const host = {
      navigate: (target) => calls.push(['navigate', target]),
      emit: (event, args) => calls.push(['emit', event, args]),
      set: (target, prop, value) => calls.push(['set', target, prop, value]),
      toggle: (target, prop) => calls.push(['toggle', target, prop]),
      focus: (target) => calls.push(['focus', target]),
    };
    const registry = createActionRegistry({ host });
    registry.dispatch('navigate', ['/home']);
    registry.dispatch('emit', ['saved', 'x']);
    registry.dispatch('set', ['panel', 'open', 'true']);
    registry.dispatch('toggle', ['panel', 'open']);
    registry.dispatch('focus', ['field']);
    expect(calls).toEqual([
      ['navigate', '/home'],
      ['emit', 'saved', ['x']],
      ['set', 'panel', 'open', 'true'],
      ['toggle', 'panel', 'open'],
      ['focus', 'field'],
    ]);
  });

  it('focus prefers the bound machine effect', () => {
    const focused = [];
    const registry = createActionRegistry({
      host: { focus: () => focused.push('host') },
    });
    registry.dispatch('focus', ['content'], {
      effects: { focus: (target) => focused.push(`effect:${target}`) },
    });
    expect(focused).toEqual(['effect:content']);
  });

  it('report a missing host function and invalid arguments', () => {
    const registry = createActionRegistry();
    expect(registry.dispatch('emit', ['saved']).diagnostic.code).toBe(
      'unhandled-action'
    );
    expect(registry.dispatch('set', ['panel']).diagnostic.code).toBe(
      'invalid-argument'
    );
    expect(registry.dispatch('navigate', []).diagnostic.code).toBe(
      'invalid-argument'
    );
  });
});

describe('handlers', () => {
  it('dispatchHandler runs each action of (on EVENT ACTION...)', () => {
    const calls = [];
    const registry = createActionRegistry();
    registry.register('log', (args, meta) => calls.push([args, meta.event]));
    const results = dispatchHandler(registry, [
      'press',
      ['log', 'a'],
      ['log', 'b'],
    ]);
    expect(results.map((r) => r.ok)).toEqual([true, true]);
    expect(calls).toEqual([
      [['a'], 'press'],
      [['b'], 'press'],
    ]);
  });

  it('checkHandler lists unregistered actions without running any', () => {
    const registry = createActionRegistry();
    const diagnostics = checkHandler(
      registry,
      ['press', ['navigate', '/'], ['launch']],
      { element: 'b' }
    );
    expect(diagnostics.map((d) => [d.code, d.at])).toEqual([
      ['unknown-action', { element: 'b', action: 'launch' }],
    ]);
  });
});
