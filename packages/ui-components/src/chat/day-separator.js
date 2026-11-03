import { dayLabel } from './chat-model.js';
import { atomOf, chatOptions, registerChatKind } from './dom.js';

export function drawDay(node, iso, options) {
  node.className = 'ui-chat-day';
  node.setAttribute('role', 'separator');
  node.textContent = dayLabel(iso, options);
  node.setAttribute('aria-label', node.textContent);
}
registerChatKind('day-separator', (node, _el, ctx) => ({
  update: (el) => drawDay(node, atomOf(el, 'time'), chatOptions(ctx)),
}));
