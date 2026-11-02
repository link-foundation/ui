/**
 * ui-convert entry point tests. Works with Node.js, Bun and Deno.
 *
 * The package is imported by its npm name, so the test also proves that the
 * npm workspace links `@link-foundation/ui-convert` into node_modules.
 */

import { describe, it, expect } from 'test-anywhere';
import * as convert from '@link-foundation/ui-convert';

describe('@link-foundation/ui-convert', () => {
  it('exports the public API', () => {
    expect(Object.keys(convert).sort()).toEqual(
      [
        'DROPPED_TAGS',
        'HTML_FALLBACK_KIND',
        'HTML_MAPPING',
        'HTML_VOCABULARY_TEXT',
        'SCRIPT_SCHEMES',
        'assignIds',
        'collapseCss',
        'extendVocabulary',
        'findRule',
        'hasScriptUrl',
        'htmlVocabulary',
        'importDom',
        'importHtml',
        'isEventAttribute',
        'isValidId',
        'parseStyle',
        'readDom',
        'readHtml',
        'ruleMatches',
        'styleLink',
      ].sort()
    );
  });

  it('imports <p>Hi</p> as a text element (the manual check)', () => {
    expect(convert.importHtml('<p>Hi</p>').text).toBe(
      '(p-0: text Hi\n  (tag p))\n'
    );
  });
});
