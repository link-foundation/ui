import { createMenu } from '../overlays/menu.js';
import { virtualAnchor } from '../overlays/position.js';
import { chatOf, chatOptions, chatRecords, emit, make, uid } from './dom.js';
import { messageActions } from './message-bubble.js';

/** One APG menu per stream, with a target independent of selected messages. */
export function createChatActions(node, selection, ctx) {
  let menu;
  let surface;
  const close = () => {
    menu?.disconnect();
    surface?.remove();
    menu = null;
  };
  return {
    open(message, anchor, point) {
      close();
      selection.target(message.id);
      const actions = messageActions(chatOf(message, ctx), message);
      if (!actions.length) {
        return;
      }
      const labels = chatOptions(ctx).labels ?? {};
      surface = make(ctx.document, 'div', {
        class: 'ui-chat-menu',
        hidden: true,
      });
      node.append(surface);
      const el = {
        id: uid('chat-actions'),
        props: new Map([['label', [labels.actions ?? 'Message actions']]]),
        properties: actions.map((action) => ({
          name: 'item',
          values: [
            action,
            ['label', labels[action] ?? action],
            ['on', 'select', ['emit', action]],
          ],
        })),
      };
      menu = createMenu(
        surface,
        el,
        {
          ...ctx,
          options: {
            ...ctx.options,
            onAction(detail) {
              // Recheck current capabilities when the host updates data while open.
              if (
                messageActions(
                  chatOf(message, ctx),
                  chatRecords(ctx).find((r) => r.id === message.id) ?? message
                ).includes(detail.action[1])
              ) {
                emit(node, 'ui-chat-action', {
                  action: detail.action[1],
                  message: message.id,
                  selection: [...selection.state().selected],
                });
              }
            },
          },
        },
        { manual: true, noTrigger: true }
      );
      menu.update(el, []);
      menu.open(point ? virtualAnchor(point.x, point.y, anchor) : anchor, {
        target: message.id,
        selection: [...selection.state().selected],
      });
    },
    disconnect: close,
  };
}
