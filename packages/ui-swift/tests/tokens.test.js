/**
 * UiSwiftUI vendors Tokens.swift, the ui-tokens Swift output (F11, #19) for
 * the issue-1 token sample, as its default theme. This keeps the vendored
 * file equal to what ui-tokens writes today.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import { readTokens, resolveTokens, toSwift } from '@link-foundation/ui-tokens';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');
const SAMPLE = join(REPO, 'docs/case-studies/issue-1/samples/tokens.lino');
const VENDORED = join(here, '..', 'Sources/UiSwiftUI/Tokens.swift');

describe('ui-swift', () => {
  it('vendors Tokens.swift as ui-tokens writes it', () => {
    const { sets } = readTokens(readFileSync(SAMPLE, 'utf8'));
    const expected = toSwift(resolveTokens(sets, 'material3'));
    expect(readFileSync(VENDORED, 'utf8')).toBe(expected);
  });
});
