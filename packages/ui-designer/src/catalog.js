/** Component metadata shared by the toolbox and every drop validation. */
import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';
import { controlKindNames } from '@link-foundation/ui-components/controls';
import { layoutVocabulary } from '@link-foundation/ui-components/layout';

/** The controls of #34 plus the document, basic visual and layout kinds. */
export function createCatalog(vocabulary = designerVocabulary()) {
  const names = new Set([
    'document',
    'text',
    'image',
    ...controlKindNames(),
    'stack',
    'grid',
    'split',
    'tab-group',
    'panel',
    'dock',
    'region',
    'window',
    'app-shell',
  ]);
  return new Map(
    [...names].map((type) => {
      const spec =
        vocabulary.kinds.get(type) ?? defaultVocabulary().kinds.get(type);
      return [
        type,
        {
          ...spec,
          type,
          name: type
            .split('-')
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join(' '),
          icon: spec?.children === 'none' ? '□' : '▤',
          defaults:
            type === 'text'
              ? { value: 'New text' }
              : type === 'button'
                ? { label: 'Button' }
                : {},
        },
      ];
    })
  );
}

/** Explicit designer geometry extension; see README and spec/open-questions.md. */
export function designerVocabulary() {
  const base = layoutVocabulary();
  const geometry = loadVocabulary(`geometry: kind
  property x number
  property y number
  property width dimension
  property height dimension
`).kinds.get('geometry').properties;
  return {
    ...base,
    actions: new Map([...base.actions, ['designer', []]]),
    kinds: new Map(
      [...base.kinds].map(([name, spec]) => [
        name,
        { ...spec, properties: new Map([...geometry, ...spec.properties]) },
      ])
    ),
  };
}

/** Unknown entries are refused. `children` may be any, none, or allowed types. */
export function canContain(catalog, parentType, childType) {
  const entries = catalog ?? createCatalog();
  const entry =
    entries instanceof Map ? entries.get(parentType) : entries[parentType];
  const rule = entry?.children ?? entry?.allowedChildren;
  return (
    rule === 'any' ||
    rule === true ||
    (Array.isArray(rule) && rule.includes(childType))
  );
}
