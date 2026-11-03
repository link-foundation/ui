/**
 * Fixtures of the ui-animation tests: the sample animation of
 * `docs/case-studies/issue-1/samples` with its tokens, and the step-2
 * example (`fixtures/step-2.lino`).
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import { loadAnimations, tokenResolver } from '@link-foundation/ui-animation';

const read = (url) => readFileSync(new URL(url, import.meta.url), 'utf8');

export const SAMPLES = '../../../docs/case-studies/issue-1/samples/';
export const SAMPLE_TEXT = read(`${SAMPLES}animation.lino`);
export const STEP_2_TEXT = read('./fixtures/step-2.lino');

const { sets } = readTokens(read(`${SAMPLES}tokens.lino`));

/** Resolves the tokens of the sample `material3` theme. */
export const resolveToken = tokenResolver(resolveTokens(sets, 'material3'));

/** The animation `id` of Links Notation `text`. */
export const animationOf = (text, id) =>
  loadAnimations(text).animations.get(id);

/** Diagnostics of a severity. */
export const errorsOf = (diagnostics, severity = 'error') =>
  diagnostics.filter((d) => d.severity === severity);
