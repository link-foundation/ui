// Debug: what the split kind reads from its element in jsdom.
import {
  mountLayout,
  press,
} from '../packages/ui-components/tests/layout/helpers.js';
import { findController } from '../packages/ui-components/src/layout/dom.js';
const page =
  await mountLayout(`(chat: split (label Chat) (sizes 30 70) (min 20) (max 60 90)
  (collapsible true false) (remember-size gallery.chat)
  (chat-list: stack (title Conversations) (a: text 'List'))
  (chat-view: stack (b: text 'Thread')))
(s: split (direction column) (sizes 50 25 25) (a2: text 'A') (b2: text 'B') (c2: text 'C'))`);
const c = findController(page.node('chat'));
console.log(
  JSON.stringify(c.state.limits),
  c.state.key,
  JSON.stringify(c.state.el.properties)
);
press(page.node('chat').querySelector('[role=separator]'), 'ArrowRight');
console.log([...page.storage.map]);
const s = page.node('s');
console.log(s?.outerHTML.slice(0, 400), JSON.stringify(page.diagnostics));
