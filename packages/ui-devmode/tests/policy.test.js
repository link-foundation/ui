/**
 * The site policy: the example of the issue, the defaults, a disabled
 * policy and the warnings of a policy with unknown values.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import {
  DEFAULT_SHORTCUT,
  defaultPolicy,
  ENTRY_POINTS,
  parseDevModePolicy,
  shouldActivate,
} from '../src/index.js';
import { POLICY } from './setup.js';

const codes = (policy) => policy.warnings.map((w) => w.code);

describe('parseDevModePolicy', () => {
  it('reads the policy of the issue', () => {
    const policy = parseDevModePolicy(POLICY);
    expect(policy.enabled).toBe(true);
    expect([...policy.entry]).toEqual(['shortcut', 'url-parameter', 'element']);
    expect(policy.shortcut).toBe('Alt+Shift+D');
    expect(policy.writeLayers).toEqual(['user', 'session']);
    expect([...policy.lockedElements]).toEqual(['payment-form']);
    expect(policy.warnings).toEqual([]);
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it('gives the defaults without a policy', () => {
    const defaults = defaultPolicy();
    expect(defaults.enabled).toBe(true);
    expect([...defaults.entry]).toEqual([...ENTRY_POINTS]);
    expect(defaults.shortcut).toBe(DEFAULT_SHORTCUT);
    expect(defaults.writeLayers).toEqual(['user', 'session']);
    expect(defaults.lockedElements.size).toBe(0);
    for (const input of [undefined, null, '', '(app: document)', []]) {
      const policy = parseDevModePolicy(input);
      expect(policy.enabled).toBe(true);
      expect([...policy.entry]).toEqual([...ENTRY_POINTS]);
      expect(policy.writeLayers).toEqual(['user', 'session']);
      expect(policy.warnings).toEqual([]);
    }
  });

  it('reads a ui-core document and nested nodes', () => {
    const doc = parse(`(site: site\n  (dev: dev-mode (enabled false)))`);
    expect(parseDevModePolicy(doc).enabled).toBe(false);
    expect(parseDevModePolicy(doc.roots).enabled).toBe(false);
  });

  it('never activates a disabled policy, whatever the entry', () => {
    const policy = parseDevModePolicy('(p: dev-mode (enabled false))');
    expect(policy.enabled).toBe(false);
    for (const url of [
      'http://localhost/?ui-dev',
      'http://localhost/?ui-dev=1',
      'http://localhost/',
    ]) {
      expect(shouldActivate({ url, policy })).toBe(false);
      expect(shouldActivate({ url, policy, hasElement: true })).toBe(false);
    }
  });

  it('restricts the entry points and the layers', () => {
    const policy = parseDevModePolicy(
      "(p: dev-mode (entry shortcut) (shortcut 'Ctrl+Alt+I') (write-layers session))"
    );
    expect([...policy.entry]).toEqual(['shortcut']);
    expect(policy.shortcut).toBe('Ctrl+Alt+I');
    expect(policy.writeLayers).toEqual(['session']);
    const url = 'http://localhost/?ui-dev';
    expect(shouldActivate({ url, policy })).toBe(false);
    expect(shouldActivate({ url, policy, hasElement: true })).toBe(false);
  });

  it('warns about unknown keys, entries and layers, and read-only layers', () => {
    const policy = parseDevModePolicy(
      '(p: dev-mode (enabled maybe) (entry shortcut gesture) (write-layers user site cloud) (colour red))'
    );
    expect(codes(policy)).toEqual([
      'bad-value',
      'unknown-entry',
      'read-only-layer',
      'unknown-layer',
      'unknown-key',
    ]);
    expect(policy.enabled).toBe(true);
    expect([...policy.entry]).toEqual(['shortcut']);
    expect(policy.writeLayers).toEqual(['user']);
    for (const w of policy.warnings) {
      expect(w.severity).toBe('warning');
    }
  });

  it('reads the first policy only', () => {
    const policy = parseDevModePolicy(
      '(a: dev-mode (enabled false))\n(b: dev-mode (enabled true))'
    );
    expect(policy.enabled).toBe(false);
    expect(codes(policy)).toEqual(['duplicate-policy']);
  });
});
