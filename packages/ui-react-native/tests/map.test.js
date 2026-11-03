import { URL } from 'node:url';
import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@link-foundation/ui-core';
import { mapElement } from '../src/map.js';

const sample = readFileSync(
  new URL(
    '../../../docs/case-studies/issue-1/samples/document.lino',
    import.meta.url
  ),
  'utf8'
);
const node = (source) => parse(source).roots[0];
describe('native mapping', () => {
  for (const [kind, type] of Object.entries({
    document: 'ScrollView',
    stack: 'View',
    text: 'Text',
    button: 'Pressable',
    image: 'Image',
  })) {
    it(`maps ${kind} and preserves the ID`, () => {
      const mapped = mapElement(node(`item: ${kind}`));
      assert.equal(mapped.type, type);
      assert.equal(mapped.props.testID, 'item');
    });
  }
  it('warns once for an unknown kind', () => {
    const warnings = [];
    assert.equal(
      mapElement(node('item: chart'), {
        warn: (message) => warnings.push(message),
      }).type,
      'View'
    );
    assert.equal(warnings.length, 1);
  });
  it('matches the sample snapshot, including every testID', () => {
    assert.deepEqual(
      mapElement(node(sample), { tokens: { 'space.medium': '16px' } }),
      JSON.parse(
        readFileSync(
          new URL('./__snapshots__/document.native.json', import.meta.url),
          'utf8'
        )
      )
    );
  });
  it('maps text, layout, image alt and disabled accessibility', () => {
    assert.deepEqual(mapElement(node("label: text 'Hello'")).children, [
      'Hello',
    ]);
    assert.deepEqual(
      mapElement(node('row: stack (direction horizontal) (gap 8px)')).props
        .style,
      { flexDirection: 'row', gap: 8 }
    );
    const image = mapElement(
      node("pic: image 'https://example.org/a.png' (alt 'A picture')")
    );
    assert.deepEqual(image.props.source, { uri: 'https://example.org/a.png' });
    assert.equal(image.props.accessibilityLabel, 'A picture');
    const button = mapElement(node('ok: button (label OK) (disabled true)'));
    assert.equal(button.props.disabled, true);
    assert.deepEqual(button.props.accessibilityState, { disabled: true });
    assert.deepEqual(button.children[0].children, ['OK']);
  });
});
