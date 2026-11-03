import { isUnsafeUrl } from '@link-foundation/ui-dom';
import { deliveryStatus } from './chat-model.js';
import {
  capability,
  chatOf,
  chatOptions,
  chatRecords,
  emit,
  make,
  recordOf,
  registerChatKind,
} from './dom.js';
import { drawReasoning } from './reasoning-trace.js';

export const messageActions = (chat, message) =>
  ['reply', 'react', 'edit'].filter((action) =>
    capability(chat, message, `can-${action}`)
  );

function messageText(message, document, options) {
  const text = make(document, 'div', { class: 'ui-chat-text' });
  const renderer = options.slots?.message;
  if (renderer) {
    const rendered = renderer(message, { document });
    text.append(
      typeof rendered === 'string'
        ? document.createTextNode(rendered)
        : rendered
    );
  } else {
    text.textContent = message.text ?? '';
  }
  return text;
}

function attachments(message, records, document) {
  const content = [];
  for (const attachment of records.filter(
    (r) => r.kind === 'attachment' && r.message === message.id
  )) {
    const safe = attachment.url && !isUnsafeUrl(attachment.url);
    content.push(
      make(
        document,
        safe ? 'a' : 'span',
        safe
          ? {
              href: attachment.url,
              rel: 'noopener noreferrer',
              class: 'ui-chat-attachment',
            }
          : {},
        attachment.name ?? attachment.id
      )
    );
  }
  return content;
}

function reactions(node, message, chat, records, document) {
  const content = [];
  for (const reaction of records.filter(
    (r) => r.kind === 'reaction' && r.message === message.id
  )) {
    const button = make(
      document,
      'button',
      {
        type: 'button',
        'aria-pressed': String(reaction.selected ?? false),
        disabled: !capability(chat, message, 'can-react'),
      },
      `${reaction.emoji} ${reaction.count ?? 1}`
    );
    button.addEventListener('click', () =>
      emit(node, 'ui-chat-action', {
        action: 'react',
        message: message.id,
        reaction: reaction.id,
      })
    );
    content.push(button);
  }
  return content;
}

function delivery(message, document, options) {
  const content = [];
  const status = deliveryStatus(message);
  const ticks = {
    pending: '◷',
    sending: '◷',
    sent: '✓',
    delivered: '✓✓',
    read: '✓✓',
    failed: '!',
  };
  if (status) {
    content.push(
      make(
        document,
        'span',
        {
          class: 'ui-chat-delivery',
          'aria-label': options.labels?.[status] ?? status,
        },
        ticks[status] ?? status
      )
    );
  }
  return content;
}

function replyQuote(node, message, records, document, options) {
  const content = [];
  const reply = records.find((r) => r.id === message['reply-to']);
  if (message['reply-to']) {
    const quote = make(
      document,
      'button',
      { type: 'button', class: 'ui-chat-reply' },
      reply?.text ?? options.labels?.unavailable ?? 'Earlier message'
    );
    quote.addEventListener('click', () =>
      emit(node, 'ui-chat-jump', { id: message['reply-to'] })
    );
    content.push(quote);
  }
  return content;
}

/** Text is always a text node; rich text is a trusted host renderer slot. */
export function drawBubble(node, message, ctx) {
  const { document } = ctx;
  const options = chatOptions(ctx);
  const records = chatRecords(ctx);
  const chat = chatOf(message, ctx);
  node.className = `ui-chat-bubble${message.outgoing ? ' outgoing' : ''}${message.service ? ' service' : ''}`;
  node.dataset.status = deliveryStatus(message) ?? '';
  const content = [];
  const person = records.find((r) => r.id === message.sender);
  if (!message.service) {
    content.push(
      make(
        document,
        'strong',
        { class: 'ui-chat-sender' },
        person?.name ?? message.sender ?? ''
      )
    );
  }
  content.push(...replyQuote(node, message, records, document, options));
  content.push(messageText(message, document, options));
  content.push(...attachments(message, records, document));
  content.push(...reactions(node, message, chat, records, document));
  const steps = records.filter(
    (r) => r.kind === 'step' && r.message === message.id
  );
  if (steps.length) {
    const trace = make(document, 'div');
    drawReasoning(trace, steps, { document, ...options });
    content.push(trace);
  }
  content.push(...delivery(message, document, options));
  if (!message.service && messageActions(chat, message).length) {
    const button = make(
      document,
      'button',
      {
        type: 'button',
        class: 'ui-chat-actions',
        'aria-label': options.labels?.actions ?? 'Message actions',
        'aria-haspopup': 'menu',
      },
      '···'
    );
    button.addEventListener('click', () =>
      emit(node, 'ui-chat-open-actions', { id: message.id, anchor: button })
    );
    content.push(button);
  }
  node.replaceChildren(...content);
}
registerChatKind('message-bubble', (node, _el, ctx) => ({
  update(el) {
    const message = recordOf(el, ctx);
    if (message) {
      drawBubble(node, message, ctx);
    }
  },
}));
