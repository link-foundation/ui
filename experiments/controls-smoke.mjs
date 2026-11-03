// Smoke test: mount every control in jsdom and print diagnostics + HTML.
import { createDom } from '../packages/ui-components/tests/support/dom.js';
import { mountControls } from '../packages/ui-components/src/controls/index.js';
const text = `(app: document
  (b: button 'Save')
  (ib: icon-button close (label 'Close'))
  (ib2: icon-button close)
  (lb: label 'Name' (for name) (required true))
  (lk: link 'Docs' (href 'https://example.com') (external true))
  (bad: link 'Bad' (href 'javascript:alert(1)'))
  (name: text-field (label 'Name') (value 'Ada'))
  (notes: text-area (label 'Notes'))
  (qty: number-field (label 'Qty') (value 3) (min 0) (max 10))
  (col: color-field (label 'Colour') (value '#336699'))
  (agree: checkbox (label 'Agree') (checked mixed))
  (size: radio-group (label 'Size') (value m)
    (s: radio (label 'S') (value s))
    (m: radio (label 'M') (value m)))
  (wifi: switch (label 'Wi-Fi') (checked true))
  (vol: slider (label 'Volume') (value 30) (value-text '{value} %'))
  (fruit: select (label 'Fruit') (value pear)
    (o1: option (label 'Apple') (value apple))
    (o2: option (label 'Pear') (value pear)))
  (city: combobox (label 'City')
    (c1: option (label 'Berlin'))
    (c2: option (label 'Paris')))
  (p1: progress (label 'Upload') (value 40))
  (p2: progress (label 'Loading'))
  (bd: badge 3 (label 'unread'))
  (av: avatar 'Ada Lovelace'))`;
const { container, window } = createDom();
const m = mountControls(container, text, {});
console.log(
  m.diagnostics
    .map((d) => `${d.code}@${d.at?.element}:${d.at?.property ?? ''}`)
    .join('\n')
);
console.log(container.innerHTML.replace(/></g, '>\n<'));
// interaction
const box = m.handle.nodeFor('agree').querySelector('input');
box.click();
console.log(
  'agree checked ->',
  m.store.get('agree').properties.find((p) => p.name === 'checked')?.values
);
const sw = m.handle.nodeFor('wifi').querySelector('button');
sw.click();
console.log(
  'wifi ->',
  m.store.get('wifi').properties.find((p) => p.name === 'checked')?.values,
  sw.getAttribute('aria-checked')
);
const input = m.handle.nodeFor('name').querySelector('input');
input.focus();
input.value = 'Grace';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
input.dispatchEvent(new window.Event('change', { bubbles: true }));
console.log(
  'name ->',
  m.store.get('name').properties.find((p) => p.name === 'value')?.values
);
const doc = window.document;
const key = (t, k) => {
  t.dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: k,
      bubbles: true,
      cancelable: true,
    })
  );
  t.dispatchEvent(
    new window.KeyboardEvent('keyup', {
      key: k,
      bubbles: true,
      cancelable: true,
    })
  );
};
const prop = (id, n) =>
  m.store.get(id).properties.find((p) => p.name === n)?.values;
const r = m.handle.nodeFor('m').querySelector('button');
r.focus();
key(r, 'ArrowRight');
await new Promise((r) => setTimeout(r, 0));
console.log('size ->', prop('size', 'value'), doc.activeElement.id);
const th = m.handle.nodeFor('vol').querySelector('[data-part=thumb]');
th.focus();
key(th, 'ArrowRight');
key(th, 'End');
console.log('vol ->', prop('vol', 'value'), th.getAttribute('aria-valuetext'));
const q = m.handle.nodeFor('qty').querySelector('input');
q.focus();
key(q, 'ArrowUp');
console.log('qty ->', prop('qty', 'value'), q.value);
const sel = m.handle.nodeFor('fruit').querySelector('button');
sel.focus();
key(sel, 'ArrowDown');
console.log(
  'fruit open',
  sel.getAttribute('aria-expanded'),
  sel.getAttribute('aria-activedescendant')
);
key(doc.activeElement, 'ArrowUp');
key(doc.activeElement, 'Enter');
console.log('fruit ->', prop('fruit', 'value'), sel.textContent);
const cb = m.handle.nodeFor('city').querySelector('input');
cb.focus();
cb.value = 'Pa';
cb.dispatchEvent(new window.Event('input', { bubbles: true }));
console.log(
  'city',
  cb.getAttribute('aria-expanded'),
  [...m.handle.nodeFor('city').querySelectorAll('ui-option')].map(
    (o) => o.hidden
  )
);
key(cb, 'ArrowDown');
key(cb, 'Enter');
console.log('city ->', prop('city', 'value'), cb.value);
