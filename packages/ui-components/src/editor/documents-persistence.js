/** LiNo storage adapter for document tabs, bases, drafts and conflicts. */
import { Parser, Link } from 'links-notation';
import { formatLinks } from '@link-foundation/ui-core';

const field = (name, value) =>
  new Link(null, [new Link(name), new Link(value)]);
const fieldsOf = (group) =>
  new Map(
    group.children.map((g) => [
      g.element.values[0]?.id,
      g.element.values[1]?.id,
    ])
  );

export function createEditorPersistence(storage, key) {
  const draftKey = (id) => `${key}:draft:${encodeURIComponent(id)}`;
  const read = (name) => {
    const text = storage?.getItem(name);
    return text ? new Parser().parseGroups(text) : [];
  };
  const write = (name, links) => storage?.setItem(name, formatLinks(links));
  return {
    restore(docs) {
      const tabs = read(key)[0];
      if (!tabs) {
        return null;
      }
      for (const group of tabs.children.filter(
        (g) => g.element.id === 'document'
      )) {
        const data = fieldsOf(group);
        const id = data.get('id');
        if (typeof id !== 'string') {
          continue;
        }
        const stored = read(draftKey(id))[0];
        const draft = stored ? fieldsOf(stored) : new Map();
        const saved = draft.get('saved') ?? data.get('saved') ?? '';
        const text = draft.get('text') ?? saved;
        docs.set(id, {
          id,
          title: data.get('title') ?? id,
          language: data.get('language') ?? 'lino',
          saved,
          text,
          dirty: text !== saved,
          incoming:
            draft.get('has-conflict') === 'true'
              ? (draft.get('incoming') ?? '')
              : null,
        });
      }
      const active = fieldsOf(tabs).get('active');
      return docs.has(active) ? active : (docs.keys().next().value ?? null);
    },
    saveTabs(docs, activeId) {
      write(key, [
        new Link('tabs', [
          field('active', activeId ?? ''),
          ...[...docs.values()].map(
            (doc) =>
              new Link('document', [
                field('id', doc.id),
                field('title', doc.title),
                field('language', doc.language),
                field('saved', doc.saved),
              ])
          ),
        ]),
      ]);
    },
    saveDraft(doc) {
      if (doc) {
        write(draftKey(doc.id), [
          new Link('draft', [
            field('text', doc.text),
            field('saved', doc.saved),
            field('has-conflict', String(doc.incoming !== null)),
            field('incoming', doc.incoming ?? ''),
          ]),
        ]);
      }
    },
  };
}
