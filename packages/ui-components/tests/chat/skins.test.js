import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { URL } from 'node:url';
import { readTokens, resolveTokens, toCss } from '@link-foundation/ui-tokens';

// WCAG relative luminance, independently computed from generated CSS colors.
function luminance(hex) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
for (const skin of ['t3', 'telegram', 'whatsapp', 'signal']) {
  for (const mode of [null, 'dark']) {
    test(`${skin} ${mode ?? 'light'} tokens: selection and both bubble text contrasts >=4.5`, () => {
      const { sets, diagnostics } = readTokens(
        readFileSync(
          new URL(`../../src/chat/skins/${skin}.lino`, import.meta.url),
          'utf8'
        )
      );
      assert.deepEqual(diagnostics, []);
      const css = toCss(resolveTokens(sets, skin, { mode }));
      const values = new Map(
        [...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/g)].map((m) => [
          m[1],
          m[2],
        ])
      );
      for (const [a, b] of [
        ['selection-bg', 'selection-text'],
        ['bubble-in', 'bubble-in-text'],
        ['bubble-out', 'bubble-out-text'],
      ]) {
        const ls = [
          luminance(values.get(`chat-${a}`)),
          luminance(values.get(`chat-${b}`)),
        ].sort((a, b) => a - b);
        assert.ok((ls[1] + 0.05) / (ls[0] + 0.05) >= 4.5, `${a}/${b}`);
      }
    });
  }
}
test('every appearance style is a valid token set', () => {
  for (const name of ['cards', 'compact', 'bubbles']) {
    assert.deepEqual(
      readTokens(
        readFileSync(
          new URL(`../../src/chat/skins/${name}.lino`, import.meta.url),
          'utf8'
        )
      ).diagnostics,
      []
    );
  }
});
test('chat source imports remain provider neutral', () => {
  const dir = new URL('../../src/chat/', import.meta.url);
  for (const name of readdirSync(dir).filter((name) => name.endsWith('.js'))) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    for (const match of source.matchAll(
      /(?:from\s*|import\s*)['"]([^'"]+)['"]/g
    )) {
      assert.doesNotMatch(
        match[1],
        /telegram|formal-ai|meta-sovereign|openai|anthropic|whatsapp|signal/i
      );
    }
  }
});
