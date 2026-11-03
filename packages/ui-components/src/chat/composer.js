import { mountControls } from '../controls/index.js';
import { formatLinks } from '@link-foundation/ui-core';
import {
  atomOf,
  chatOptions,
  chatRecords,
  emit,
  make,
  registerChatKind,
  uid,
} from './dom.js';

registerChatKind('composer', (node, initial, ctx) => {
  const options = chatOptions(ctx);
  const win = ctx.document.defaultView;
  const prefix = uid('chat-compose');
  const mounted = mountControls(
    node,
    formatLinks([
      {
        id: `${prefix}-input`,
        values: [
          'text-area',
          ['label', options.labels?.message ?? 'Message'],
          ['rows', '1'],
        ],
      },
      {
        id: `${prefix}-send`,
        values: ['button', ['label', options.labels?.send ?? 'Send']],
      },
    ])
  );
  const input = node.querySelector('textarea');
  const send = node.querySelector('button');
  const slots = make(ctx.document, 'div', { class: 'ui-chat-composer-slots' });
  node.prepend(slots);
  for (const name of ['before', 'attachments', 'after']) {
    const slot = options.slots?.[name]?.({
      document: ctx.document,
      composer: node,
    });
    if (slot) {
      const wrapper = make(ctx.document, 'div', { 'data-slot': name });
      wrapper.append(slot);
      slots.append(wrapper);
    }
  }
  let frame = null;
  let el = initial;
  const spaceScope = () => options.spaceTarget ?? node.parentElement;
  let previousSpace;
  let measuredScope;
  const measure = () => {
    if (frame !== null) {
      return;
    }
    frame = win.requestAnimationFrame(() => {
      frame = null;
      const scope = spaceScope();
      if (!measuredScope) {
        measuredScope = scope;
        previousSpace = scope?.style.getPropertyValue('--composer-space');
      }
      scope?.style.setProperty(
        '--composer-space',
        `${Math.ceil(node.getBoundingClientRect().height)}px`
      );
    });
  };
  const grow = () => {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
    measure();
  };
  const submit = () => {
    if (!input.value.trim() || input.disabled) {
      return;
    }
    emit(node, 'ui-chat-send', { chat: atomOf(el, 'chat'), text: input.value });
    input.value = '';
    grow();
  };
  const keydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', keydown);
  send.addEventListener('click', submit);
  const observer = new win.ResizeObserver(measure);
  observer.observe(node);
  const refresh = () => {
    const chat =
      chatRecords(ctx).find((r) => r.id === atomOf(el, 'chat')) ?? {};
    const attachments = slots.querySelector('[data-slot=attachments]');
    if (attachments) {
      attachments.hidden = !(chat['max-attachments'] > 0);
    }
    slots.dataset.maxAttachments = String(chat['max-attachments'] ?? 0);
    input.disabled = atomOf(el, 'disabled') === 'true';
    send.disabled = input.disabled;
    measure();
  };
  const unsubscribe = options.data?.subscribe?.(refresh);
  return {
    update(next) {
      el = next;
      refresh();
    },
    disconnect() {
      unsubscribe?.();
      observer.disconnect();
      if (frame !== null) {
        win.cancelAnimationFrame(frame);
      }
      input.removeEventListener('input', grow);
      input.removeEventListener('keydown', keydown);
      send.removeEventListener('click', submit);
      const scope = measuredScope;
      if (previousSpace) {
        scope?.style.setProperty('--composer-space', previousSpace);
      } else {
        scope?.style.removeProperty('--composer-space');
      }
      mounted.destroy();
    },
  };
});
