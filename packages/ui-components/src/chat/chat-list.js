/** Chat list delegates measured virtualization and keyboard behavior to #37. */
import { mountDocument } from '@link-foundation/ui-dom';
import { formatLinks } from '@link-foundation/ui-core';
import { createDataSource, dataVocabulary } from '../data/index.js';
import { summarizeChats } from './chat-model.js';
import { atomOf, chatOptions, chatRecords, registerChatKind } from './dom.js';
registerChatKind('chat-list', (node, initial, ctx) => {
  const options = chatOptions(ctx);
  const source = createDataSource([]);
  const mounted = mountDocument(
    node,
    formatLinks([
      {
        id: `${initial.id}-list`,
        values: [
          'list',
          ['label', atomOf(initial, 'label') ?? 'Chats'],
          ['items', ['param', 'chats']],
        ],
      },
    ]),
    {
      parseOptions: { vocabulary: dataVocabulary() },
      data: { sources: { chats: source } },
    }
  );
  const refresh = () =>
    source.set(
      summarizeChats(chatRecords(ctx)).map((c) => ({
        ...c,
        label: `${c.title ?? c.id}${c.unread ? ` · ${c.unread} ${options.labels?.unread ?? 'unread'}` : ''}${c.last ? ` — ${c.last.text ?? ''}` : ''}`,
      }))
    );
  const unsubscribe = options.data?.subscribe?.(refresh);
  return {
    update: refresh,
    disconnect() {
      unsubscribe?.();
      mounted.handle.destroy();
    },
  };
});
