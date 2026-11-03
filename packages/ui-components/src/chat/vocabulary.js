import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';
export const CHAT_KINDS = Object.freeze([
  'chat-list',
  'message-stream',
  'message-bubble',
  'day-separator',
  'composer',
  'reasoning-trace',
]);
export function chatVocabulary() {
  const extra = loadVocabulary(
    CHAT_KINDS.map(
      (kind) =>
        `${kind}: kind\n  property label string\n  property record string\n  property chat string\n  property source string\n  property time string\n  property disabled boolean\n  children none`
    ).join('\n')
  ).kinds;
  const base = defaultVocabulary();
  return { ...base, kinds: new Map([...base.kinds, ...extra]) };
}
