import { it } from 'node:test';
import assert from 'node:assert/strict';
import { validClipPath } from '../src/clip-path.js';
import { typeDeclaration } from '../src/properties.js';
import { STATE_CSS } from '../src/conditions.js';
it('accepts bounded computed polygons and dotted borders', () => {
  for (const text of [
    'polygon(0% 0%, 100% 0%, 100% 100%)',
    'polygon(calc(100% - var(--corner, 12px)) 0px, 100% var(--corner), 0px 100%)',
    'inset(0px round 12px)',
  ]) {
    assert.equal(validClipPath(text), true, text);
  }
  assert.ok(typeDeclaration('border-style', ['dotted'], {}, []));
  assert.equal(STATE_CSS.active, STATE_CSS.pressed);
});
it('rejects injection, unknown functions, malformed terms, and excessive nesting', () => {
  for (const text of [
    'url(https://example.org)',
    'polygon(url(x) 0%, 100% 0%, 0% 100%)',
    'polygon(calc(1px + sin(2)) 0%, 100% 0%, 0% 100%)',
    'polygon(var(--x); color:red 0%, 100% 0%, 0% 100%)',
    'polygon(0% 0%)',
    'polygon(0% 0%, 1% 1%,)',
    `polygon(calc(${'calc('.repeat(30)}1px${')'.repeat(
      31
    )} 0%, 0% 0%, 100% 100%)`,
  ]) {
    assert.equal(validClipPath(text), false, text);
  }
});
