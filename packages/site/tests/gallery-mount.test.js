import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountGallery } from '../src/gallery/mount.js';

for (const source of [
  'javascript:alert(1)',
  'https://example.com/matrix.html',
  '//example.com/en/button-filled.html',
  '../../gallery/en/../playground.html',
  '../../gallery/en/button-filled.html',
]) {
  test(`gallery only loads its own static matrix: ${source}`, () => {
    const { window } = new JSDOM(
      '<div id="gallery"><details><iframe></iframe></details></div>'
    );
    try {
      const gallery = window.document.getElementById('gallery');
      const details = gallery.querySelector('details');
      const frame = gallery.querySelector('iframe');
      frame.setAttribute('data-src', source);
      mountGallery(gallery);
      assert.equal(frame.hasAttribute('src'), false);
      details.open = true;
      details.dispatchEvent(new window.Event('toggle', { bubbles: true }));
      assert.equal(
        frame.getAttribute('src'),
        source === '../../gallery/en/button-filled.html' ? source : null
      );
      details.open = false;
      details.dispatchEvent(new window.Event('toggle', { bubbles: true }));
      assert.equal(frame.hasAttribute('src'), false);
    } finally {
      window.close();
    }
  });
}
