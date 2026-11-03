// How ui-core parses the layout sample of issue 36.
import { parse } from '@link-foundation/ui-core';
const r = parse(`(designer-shell: dock
  (persist 'designer.layout')
  (left: region (size 16rem) (panels toolbox outline))
  (right: region (size 20rem) (panels properties))
  (center: region (panels canvas))
  (bottom: region (size 12rem) (collapsed true) (panels problems)))
(chat-screen: split
  (direction row)
  (resizable true)
  (remember-size 'chat.columns')
  (children chat-list conversation))`);
console.log(JSON.stringify(r, null, 1));
