export const messages = Array.from({ length: 200 }, (_, i) => ({
  id: `m${i}`,
  kind: 'message',
  chat: 'c',
  sender: i % 2 ? 'me' : 'alice',
  outgoing: i % 2 === 1,
  time: new Date(Date.UTC(2026, 9, 30, 0, i)).toISOString(),
  text: `Message ${i}`,
}));
export function memorySource(items = messages) {
  return {
    async load({ before, after, around, limit }) {
      let start = Math.max(0, items.length - limit);
      if (before) {
        start = Math.max(0, items.findIndex((m) => m.id === before) - limit);
      }
      if (after) {
        start = items.findIndex((m) => m.id === after) + 1;
      }
      if (around) {
        start = Math.max(
          0,
          items.findIndex((m) => m.id === around) - Math.floor(limit / 2)
        );
      }
      const end = before
        ? items.findIndex((m) => m.id === before)
        : Math.min(items.length, start + limit);
      return {
        messages: items.slice(start, end),
        hasOlder: start > 0,
        hasNewer: end < items.length,
      };
    },
  };
}
