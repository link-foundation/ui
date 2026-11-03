/**
 * Typeahead: typed characters find the next item whose label starts with
 * them; the query resets after a pause (an injected clock).
 */

import { describe, it, expect } from 'test-anywhere';
import { createTypeahead } from '@link-foundation/ui-components/a11y';
import { createManualClock } from '@link-foundation/ui-components/behavior';

const LABELS = ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Banana split'];

describe('createTypeahead', () => {
  it('finds the first item starting with the typed characters', () => {
    const clock = createManualClock();
    const typeahead = createTypeahead(() => LABELS, { clock });
    expect(typeahead.handleKey('b')).toBe(1);
    expect(typeahead.handleKey('l', 1)).toBe(2);
    expect(typeahead.query).toBe('bl');
  });

  it('cycles through items when the same character repeats', () => {
    const clock = createManualClock();
    const typeahead = createTypeahead(() => LABELS, { clock });
    expect(typeahead.handleKey('b', -1)).toBe(1);
    expect(typeahead.handleKey('b', 1)).toBe(2);
    expect(typeahead.handleKey('b', 2)).toBe(4);
    expect(typeahead.handleKey('b', 4)).toBe(1);
  });

  it('resets the query after the timeout', () => {
    const clock = createManualClock();
    const typeahead = createTypeahead(() => LABELS, { clock, timeout: 500 });
    typeahead.handleKey('c');
    clock.advance(499);
    expect(typeahead.query).toBe('c');
    clock.advance(1);
    expect(typeahead.query).toBe('');
    expect(typeahead.handleKey('a')).toBe(0);
  });

  it('ignores keys that are not characters and reports no match', () => {
    const clock = createManualClock();
    const typeahead = createTypeahead(() => LABELS, { clock });
    expect(typeahead.handleKey('ArrowDown')).toBe(-1);
    expect(typeahead.handleKey(' ')).toBe(-1);
    expect(typeahead.query).toBe('');
    expect(typeahead.handleKey('z')).toBe(-1);
    typeahead.reset();
    expect(typeahead.query).toBe('');
    expect(clock.pending()).toBe(0);
  });

  it('matches case-insensitively', () => {
    const typeahead = createTypeahead(() => ['éclair', 'Éte'], {
      clock: createManualClock(),
    });
    expect(typeahead.handleKey('É')).toBe(0);
  });
});
