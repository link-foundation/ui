import { mountDocument } from '@link-foundation/ui-dom';
import { formatLinks } from '@link-foundation/ui-core';
import { readTokens, resolveTokens, toCss } from '@link-foundation/ui-tokens';
import { createStreamWindow, chatVocabulary } from '../src/chat/index.js';
import { createDataSource } from '../src/data/source.js';
import { findController } from '../src/layout/dom.js';

const messages = Array.from({ length: 10000 }, (_, i) => ({
  id: `m${i}`,
  kind: 'message',
  chat: 'c1',
  sender: i % 3 === 0 ? 'me' : 'alice',
  outgoing: i % 3 === 0,
  time: new Date(Date.UTC(2026, 9, 24, 0, i)).toISOString(),
  text:
    i === 5000
      ? 'Here is the message you jumped to.'
      : i === 9998
        ? 'I checked the design tokens and keyboard navigation. The nested reasoning is below.'
        : i === 9999
          ? 'Ready for review. The composer always reserves its space.'
          : `Design note ${i}: ${i % 2 ? 'Let’s keep this clear and accessible.' : 'One shared conversation, across every provider.'}`,
  status: i === 9999 ? 'pending' : i % 4 === 0 ? 'read' : 'delivered',
  ...(i === 9997 ? { 'reply-to': 'm9996' } : {}),
  ...(i === 9995
    ? { service: true, text: 'Alice joined the design review' }
    : {}),
  ...(i === 9997 ? { unread: true } : {}),
}));
const chat = {
  id: 'c1',
  kind: 'chat',
  title: 'Design review',
  unread: 2,
  'can-edit': false,
  'can-react': true,
  'can-reply': true,
  'max-attachments': 2,
};
const data = createDataSource([
  chat,
  { id: 'alice', kind: 'participant', name: 'Alice' },
  { id: 'me', kind: 'participant', name: 'You' },
  {
    id: 's1',
    kind: 'step',
    message: 'm9998',
    title: 'Review accessibility',
    state: 'done',
    parent: 'none',
    text: 'Checked focus, contrast and keyboard actions.',
  },
  {
    id: 's2',
    kind: 'step',
    message: 'm9998',
    title: 'Check geometry',
    state: 'done',
    parent: 's1',
    text: 'Five lines still leave the final message visible.',
  },
  {
    id: 'r1',
    kind: 'reaction',
    message: 'm9998',
    emoji: '👍',
    count: 2,
    selected: false,
  },
  {
    id: 'a1',
    kind: 'attachment',
    message: 'm9997',
    name: 'Design notes',
    url: 'https://example.org/notes',
  },
  ...messages,
]);
const source = {
  load({ before, after, around, limit }) {
    let start = Math.max(0, messages.length - limit);
    if (before) {
      start = Math.max(0, messages.findIndex((m) => m.id === before) - limit);
    }
    if (after) {
      start = messages.findIndex((m) => m.id === after) + 1;
    }
    if (around) {
      start = Math.max(
        0,
        messages.findIndex((m) => m.id === around) - Math.floor(limit / 2)
      );
    }
    const end = before
      ? messages.findIndex((m) => m.id === before)
      : Math.min(messages.length, start + limit);
    return Promise.resolve({
      messages: messages.slice(start, end),
      hasOlder: start > 0,
      hasNewer: end < messages.length,
    });
  },
};
const history = createStreamWindow(source, { ceiling: 300 });
const labels = {
  today: 'Today',
  yesterday: 'Yesterday',
  reply: 'Reply',
  react: 'React',
  edit: 'Edit',
};
const options = {
  data,
  windows: { history },
  labels,
  clock: () => Date.parse('2026-10-30T23:59:00Z'),
  locale: 'en',
  timeZone: 'UTC',
};
const text = await (
  await fetch(new URL('./chat.lino', import.meta.url))
).text();
const mounted = mountDocument(document.getElementById('chat-root'), text, {
  parseOptions: { vocabulary: chatVocabulary() },
  chat: options,
});
const list = mountDocument(
  document.getElementById('chats'),
  formatLinks([
    { id: 'chats', values: ['chat-list', ['label', 'Conversations']] },
  ]),
  { parseOptions: { vocabulary: chatVocabulary() }, chat: options }
);
const stream = findController(mounted.handle.nodeFor('stream'));
const themeText = new Map();
for (const name of [
  't3',
  'telegram',
  'whatsapp',
  'signal',
  'cards',
  'compact',
  'bubbles',
]) {
  themeText.set(
    name,
    await (
      await fetch(new URL(`../src/chat/skins/${name}.lino`, import.meta.url))
    ).text()
  );
}
function appearance() {
  const skin = document.getElementById('skin').value;
  const style = document.getElementById('style').value;
  const mode = document.getElementById('mode').value;
  const dark =
    mode === 'dark' ||
    (mode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const { sets, diagnostics } = readTokens(
    `${themeText.get(skin)}\n${themeText.get(style)}`
  );
  if (diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(JSON.stringify(diagnostics));
  }
  document.getElementById('chat-theme').textContent = [skin, style]
    .map((name) =>
      toCss(resolveTokens(sets, name, { mode: dark ? 'dark' : null }), {
        selector: '.ui-chat-shell',
      })
    )
    .join('\n');
  document.getElementById('chat-root').dataset.skin = skin;
}
for (const name of ['skin', 'style', 'mode']) {
  document.getElementById(name).addEventListener('change', appearance);
}
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', appearance);
appearance();
document
  .getElementById('jump')
  .addEventListener('click', () => stream.jumpTo('m5000'));
document
  .getElementById('chat-root')
  .addEventListener('ui-chat-action', (event) => {
    document.getElementById('events').textContent =
      `${event.detail.action}: ${event.detail.message}`;
  });
document
  .getElementById('chat-root')
  .addEventListener('ui-chat-send', async (event) => {
    const message = {
      id: `m${messages.length}`,
      kind: 'message',
      chat: 'c1',
      sender: 'me',
      outgoing: true,
      time: '2026-10-30T23:59:00Z',
      text: event.detail.text,
      status: 'pending',
    };
    messages.push(message);
    data.set([...data.get(), message]);
    await history.loadNewer();
    document.getElementById('events').textContent =
      `Sent: ${event.detail.text}`;
  });
window.chatExample = { history, source, data, stream, messages, mounted, list };
document.body.dataset.ready = 'true';
