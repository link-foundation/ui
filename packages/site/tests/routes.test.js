import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageHref } from '../src/routes.js';

test('language navigation preserves home and nested page routes', () => {
  assert.equal(languageHref('index', 'ru'), '../ru/');
  assert.equal(languageHref('themes', 'en'), '../../en/themes/');
});

test('document values cannot introduce URL delimiters into route segments', () => {
  const href = languageHref('about?x=#top', 'en/../../other');
  assert.equal(href, '../../en%2F..%2F..%2Fother/about%3Fx%3D%23top/');
  const url = new globalThis.URL(href, 'https://example.com/ui/en/about/');
  assert.equal(url.origin, 'https://example.com');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
});
