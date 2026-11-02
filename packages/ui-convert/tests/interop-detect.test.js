/**
 * detectFormat: every fixture is detected as its own format, and JSON of
 * other shapes is not detected.
 */

import { describe, it, expect } from 'test-anywhere';
import { CONVERTERS, FORMATS, detectFormat } from '../src/index.js';
import { fixture, fixtureNames } from './helpers.js';

describe('detectFormat', () => {
  for (const format of FORMATS) {
    const names = fixtureNames(format).filter((n) => !n.startsWith('hc-'));
    it(`detects every ${format} fixture`, () => {
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(detectFormat(fixture(format, name))).toBe(format);
      }
    });
  }

  it('detects A2UI messages in every shape', () => {
    const message = { version: 'v0.9', createSurface: { surfaceId: 's' } };
    expect(detectFormat(message)).toBe('a2ui');
    expect(detectFormat([message, message])).toBe('a2ui');
    expect(detectFormat({ messages: [message] })).toBe('a2ui');
  });

  it('detects nothing in other JSON', () => {
    for (const json of [
      null,
      42,
      'AdaptiveCard',
      [],
      [1, 2],
      {},
      { type: 'Message' },
      { layers: [], fr: '30' },
      { uischema: { type: 'Unknown' } },
      { schema: { type: 'object' } },
      { messages: [] },
      fixture('adaptive-cards', 'hc-sample.json'),
    ]) {
      expect(detectFormat(json)).toBeNull();
    }
  });

  it('has an import and an export for every format', () => {
    expect(Object.keys(CONVERTERS).sort()).toEqual([...FORMATS].sort());
    for (const format of FORMATS) {
      expect(typeof CONVERTERS[format].import).toBe('function');
      expect(typeof CONVERTERS[format].export).toBe('function');
    }
  });
});
