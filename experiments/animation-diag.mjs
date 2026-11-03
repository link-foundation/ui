// Diagnostics ui-core gives for the animation dialect.
import { parse } from '@link-foundation/ui-core';
const text = `(panel-enter: animation (duration 300ms) (fill backwards) (track opacity (key 0 0) (key 1 1)) (reduced-motion (duration 0ms)) (on pressed))
(intro: timeline (at 0ms (play panel-enter (target sidebar))))
(ok: button (label 'OK') (on pressed (play press-feedback)) (on press (play x)))
`;
const doc = parse(text, { checks: false });
console.log(JSON.stringify(doc.roots[2], null, 1));
console.log(doc.diagnostics);
console.log(parse(text).diagnostics);
