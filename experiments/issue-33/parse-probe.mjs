import { parse } from '@link-foundation/ui-core';
const text = `(toggle-machine: machine
  (initial off)
  (context (pressed false))
  (state off
    (on toggle (target on) (do set-pressed) (when not-disabled)))
  (state on
    (on toggle (target off) (do clear-pressed) (when not-disabled)))
  (after 500ms (target closed))
  (do (set pressed true))
  (part root
    (attr aria-pressed (context pressed))
    (key Enter toggle)
    (key Space toggle)))`;
const r = parse(text);
console.log(JSON.stringify(r, null, 1).slice(0, 4000));
