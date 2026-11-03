import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { applyProperty } from '../src/foreign/apply.js';

test('foreign writes text, attributes and individual styles without replacing children', () => {
  const { document } = new JSDOM('<h2>Hello</h2><div><b>Keep</b></div>').window;
  const title = document.querySelector('h2');
  applyProperty(title, 'text', 'Changed');
  applyProperty(title, 'attr title', 'Tip');
  applyProperty(title, 'style color', 'red');
  assert.equal(title.textContent, 'Changed');
  assert.equal(title.title, 'Tip');
  assert.equal(title.style.color, 'red');
  assert.throws(() =>
    applyProperty(document.querySelector('div'), 'text', 'Lost')
  );
});

test('foreign writes refuse executable attributes and obfuscated script URLs', () => {
  const node = new JSDOM('<a>Link</a>').window.document.querySelector('a');
  for (const [name, value] of [
    ['attr onclick', 'alert(1)'],
    ['attr ONLOAD', 'alert(1)'],
    ['attr href', 'java\nscript:alert(1)'],
    ['attr src', ' JAVASCRIPT:alert(1)'],
    ['attr srcdoc', '<script>alert(1)</script>'],
    ['attr style', 'color:red'],
    ['style color', 'url(javascript:alert(1))'],
  ]) {
    assert.throws(() => applyProperty(node, name, value), name);
  }
  assert.equal(node.outerHTML, '<a>Link</a>');
});
