/**
 * Behaviour is data: an action or guard name only ever selects a
 * registered function. Text that looks like code is never evaluated; it is
 * an `unknown-action` diagnostic.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import {
  createActionRegistry,
  createMachine,
  dispatchHandler,
  checkHandler,
  interpret,
  isUnsafeUrl,
} from '@link-foundation/ui-components/behavior';

/** Run `fn` with globalThis.x watched: it must stay undefined. */
function withoutSideEffects(fn) {
  delete globalThis.x;
  let alerted = 0;
  const previous = globalThis.alert;
  globalThis.alert = () => {
    alerted += 1;
  };
  try {
    fn();
  } finally {
    globalThis.alert = previous;
  }
  expect(alerted).toBe(0);
  expect(globalThis.x).toBe(undefined);
}

describe('security: no action text is evaluated', () => {
  it("a document (on press 'alert(1)') runs nothing and reports unknown-action", () => {
    const { roots } = parse(`(b: button "Go" (on press 'alert(1)'))`);
    const handler = roots[0].properties.find((p) => p.name === 'on').values;
    const unknown = [];
    const registry = createActionRegistry({
      onUnknown: (d) => unknown.push(d),
    });
    withoutSideEffects(() => {
      const results = dispatchHandler(registry, handler, { source: 'b' });
      expect(results.map((r) => r.diagnostic.code)).toEqual(['unknown-action']);
    });
    expect(unknown.map((d) => d.at.action)).toEqual(['alert(1)']);
    expect(checkHandler(registry, handler).map((d) => d.code)).toEqual([
      'unknown-action',
    ]);
  });

  it("a machine (do 'globalThis.x = 1') runs nothing and reports unknown-action", () => {
    const machine = createMachine(`(m: machine
  (initial a)
  (state a (on go (target b) (do 'globalThis.x = 1')))
  (state b (entry 'globalThis.x = 2')))`);
    const diagnostics = [];
    withoutSideEffects(() => {
      const service = interpret(machine, {
        onDiagnostic: (d) => diagnostics.push(d),
      });
      service.send('go');
      expect(service.state).toBe('b');
    });
    expect(diagnostics.map((d) => [d.code, d.at.action])).toEqual([
      ['unknown-action', 'globalThis.x = 1'],
      ['unknown-action', 'globalThis.x = 2'],
    ]);
  });

  it('a guard name that looks like code is unknown and blocks', () => {
    const machine = createMachine(`(m: machine
  (initial a)
  (state a (on go (target b) (when 'globalThis.x = 1 || true')))
  (state b))`);
    const diagnostics = [];
    withoutSideEffects(() => {
      const service = interpret(machine, {
        onDiagnostic: (d) => diagnostics.push(d),
      });
      expect(service.send('go')).toBe(false);
    });
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-guard']);
  });

  it('does not reach Object.prototype through an action name', () => {
    const registry = createActionRegistry();
    for (const name of [
      'constructor',
      '__proto__',
      'toString',
      'hasOwnProperty',
    ]) {
      expect(registry.has(name)).toBe(false);
      expect(registry.dispatch(name).diagnostic.code).toBe('unknown-action');
    }
  });
});

describe('security: navigate', () => {
  it("rejects 'javascript:alert(1)' and never calls the host", () => {
    const navigated = [];
    const registry = createActionRegistry({
      host: { navigate: (target) => navigated.push(target) },
    });
    for (const url of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'java\tscript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
    ]) {
      const result = registry.dispatch('navigate', [url]);
      expect(result.ok).toBe(false);
      expect(result.diagnostic.code).toBe('unsafe-url');
    }
    expect(navigated).toEqual([]);
    expect(registry.dispatch('navigate', ['/docs']).ok).toBe(true);
    expect(navigated).toEqual(['/docs']);
  });

  it('isUnsafeUrl allows relative, http(s) and mailto URLs', () => {
    expect(isUnsafeUrl('/a')).toBe(false);
    expect(isUnsafeUrl('https://example.com')).toBe(false);
    expect(isUnsafeUrl('mailto:a@example.com')).toBe(false);
    expect(isUnsafeUrl('javascript:void 0')).toBe(true);
  });
});
