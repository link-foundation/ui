/**
 * ui-convert entry point tests. Works with Node.js, Bun and Deno.
 *
 * The package is imported by its npm name, so the test also proves that the
 * npm workspace links `@link-foundation/ui-convert` into node_modules.
 */

import { describe, it, expect } from 'test-anywhere';
import * as convert from '@link-foundation/ui-convert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_DIR } from './helpers.js';

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
        'mapHtmlElement',
        // Components: JSX / TSX, Vue and the LiNo mapping rules.
        'COMPONENT_VOCABULARY_TEXT',
        'MAPPINGS',
        'applyRules',
        'cleanJsxText',
        'componentVocabulary',
        'cssName',
        'eventName',
        'importComponents',
        'importJsx',
        'importVue',
        'jsxEvent',
        'literalText',
        'loadMappings',
        'mappingRules',
        'matchElement',
        'matchTerm',
        'parseJsx',
        'parseVue',
        'pathText',
        'readRules',
        'styleDeclarations',
        'substitute',
        // Interop: A2UI, Adaptive Cards, JSON Forms and Lottie.
        'A2UI_VERSION',
        'A2uiStream',
        'ADAPTIVE_CARDS_VERSION',
        'CONVERTERS',
        'Diagnostics',
        'FORMATS',
        'JSON_FORMS_VERSION',
        'LOTTIE_VERSION',
        'SUPPORTED_VERSIONS',
        'a2uiMessagesToDiffs',
        'applyA2uiDiffs',
        'bindToScope',
        'decodeAny',
        'decodePath',
        'detectFormat',
        'diffTrees',
        'encodeAny',
        'encodePath',
        'exportA2ui',
        'exportAdaptiveCard',
        'exportJsonForms',
        'exportLottie',
        'extraProperty',
        'hostColour',
        'hostConfigToTheme',
        'hostConfigToThemeDetails',
        'importA2ui',
        'importAdaptiveCard',
        'importJsonForms',
        'importLottie',
        'interopVocabulary',
        'normalizeA2ui',
        'normalizeJsonForms',
        'normalizeLottie',
        'readExtra',
        'scopeToBind',
        'svgToBezier',
      ].sort()
    );
  });

  it('declares every export in src/index.d.ts', () => {
    const declarations = readFileSync(
      join(PACKAGE_DIR, 'src', 'index.d.ts'),
      'utf8'
    );
    const declared = new Set(
      [
        ...declarations.matchAll(
          /^export (?:declare )?(?:const|function|class) (\w+)/gm
        ),
      ].map((match) => match[1])
    );
    expect(Object.keys(convert).filter((name) => !declared.has(name))).toEqual(
      []
    );
  });

  it('imports <p>Hi</p> as a text element (the manual check)', () => {
    expect(convert.importHtml('<p>Hi</p>').text).toBe(
      'p-0: text Hi\n  tag p\n'
    );
  });
});
