// How ui-core `parse` projects the animation samples.
import { parse } from '@link-foundation/ui-core';
const text = `(panel-enter: animation
  (duration 300ms)
  (easing (cubic-bezier 0.2 0 0 1))
  (fill backwards)
  (track opacity (key 0 0) (key 1 1))
  (track translate (key 0 '0 8px') (key 1 '0 0'))
  (reduced-motion (duration 0ms)))
(intro: timeline
  (at 0ms (play panel-enter (target sidebar)))
  (at 120ms (stagger 50ms (play bounce) (targets item-1 item-2 item-3))))
(press-feedback: animation
  (target ok)
  (duration (token motion.duration.short))
  (easing standard)
  (track scale (key 0 1) (key 0.5 0.96) (key 1 1)))
(x: animation (on pressed (play press-feedback)) (track color (key 0 '#FF0000') (key 1 (oklch 0.5 0.1 200))))
`;
const doc = parse(text, { checks: false });
console.log(JSON.stringify(doc.roots, null, 1));
console.log(doc.diagnostics);
