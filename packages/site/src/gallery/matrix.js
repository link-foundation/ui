/** Pure theme × scheme × state projection. #20 exposes native states, no forced hover API. */
import {
  parse,
  format,
  walk,
  defaultVocabulary,
} from '@link-foundation/ui-core';

export function buildMatrix(
  example,
  { themes, schemes = ['light', 'dark'], states = ['default', 'disabled'] }
) {
  const vocabulary = defaultVocabulary();
  const template = parse(example.text);
  return themes.flatMap((theme) =>
    schemes.flatMap((scheme) =>
      states.map((state) => {
        const document = globalThis.structuredClone(template);
        document.byId = new Map();
        const key = `${example.id}-${theme}-${scheme}-${state}`;
        walk(document, (node) => {
          if (node.id) {
            node.id = `${key}-${node.id}`;
            document.byId.set(node.id, node);
          }
          if (
            state === 'disabled' &&
            vocabulary.kinds.get(node.kind)?.properties.has('disabled')
          ) {
            node.properties = node.properties.filter(
              (p) => p.name !== 'disabled'
            );
            node.properties.push({ name: 'disabled', values: ['true'] });
          }
        });
        const root = document.roots[0];
        root.properties = root.properties.filter(
          (p) => !['theme', 'scheme'].includes(p.name)
        );
        root.properties.push(
          { name: 'theme', values: [theme] },
          { name: 'scheme', values: [scheme] }
        );
        return { key, theme, scheme, state, links: format(document), document };
      })
    )
  );
}
