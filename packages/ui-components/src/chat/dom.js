import { defineKind } from '@link-foundation/ui-dom';
import { atomOf, controllerOf, dropController, isLive } from '../layout/dom.js';
export { atomOf, make, emit, uid } from '../layout/dom.js';

/** Shared lifecycle; each mount supplies its own chat data and slots. */
export function registerChatKind(kind, create) {
  defineKind(kind, {
    tag: `ui-${kind}`,
    childrenSlot: null,
    create: (_el, ctx) => ctx.document.createElement(`ui-${kind}`),
    update(node, el, _changed, ctx) {
      if (isLive(ctx)) {
        controllerOf(node, () => create(node, el, ctx)).update?.(el);
      } else {
        node.textContent = atomOf(el, 'label') ?? kind;
      }
    },
    destroy: dropController,
  });
}

/** All related records are supplied as a snapshot or observable snapshot. */
export function chatRecords(ctx) {
  const data = ctx.options.chat?.data ?? [];
  return typeof data.get === 'function' ? data.get() : data;
}
export const chatOptions = (ctx) => ctx.options.chat ?? {};
export const recordOf = (el, ctx) =>
  chatRecords(ctx).find((r) => r.id === atomOf(el, 'record'));
export const chatOf = (message, ctx) =>
  chatRecords(ctx).find((r) => r.id === message?.chat) ?? {};
export const capability = (chat, message, name) =>
  (message?.[name] ?? chat?.[name]) === true;
