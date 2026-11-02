/**
 * ui-core entry point tests. Works with Node.js, Bun and Deno.
 *
 * The package is imported by its npm name, so the test also proves that the
 * npm workspace links `@link-foundation/ui-core` into node_modules.
 */

import { describe, it, expect } from 'test-anywhere';
import * as core from '@link-foundation/ui-core';

describe('@link-foundation/ui-core', () => {
  it('exports the UI dialect version', () => {
    expect(core.UI_DIALECT_VERSION).toBe('ui-dialect/0');
    expect(core.SPEC_VERSION).toBe(core.UI_DIALECT_VERSION);
  });

  it('exports the public API', () => {
    expect(Object.keys(core).sort()).toEqual(
      [
        'DEFAULT_MAX_DEPTH',
        'DEFAULT_MAX_INPUT_SIZE',
        'SPEC_VERSION',
        'UI_DIALECT_VERSION',
        'UiParseError',
        'defaultVocabulary',
        'elementLink',
        'format',
        'formatLinks',
        'loadVocabulary',
        'parse',
        'parseLinks',
        'parseOrThrow',
        'projectLink',
        'projectLinks',
        'toTree',
        'valueMatches',
        'walk',
      ].sort()
    );
  });
});
