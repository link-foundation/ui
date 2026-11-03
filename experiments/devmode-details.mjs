// Issue #54: formatting typed values and reading animations for the inspector tabs.
import { readFileSync } from 'node:fs';
import { parse, values, defaultVocabulary } from '@link-foundation/ui-core';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
const s = (n) => readFileSync(`docs/case-studies/issue-1/samples/${n}.lino`, 'utf8');
const t = resolveTokens(readTokens(s('tokens')).sets, 'material3');
for (const p of ['color.primary', 'space.medium', 'motion.duration.short', 'shape.corner.medium']) {
  const v = t.get(p); console.log(p, values.formatValue(v.value), values.colorCss?.(v.value));
}
console.log(values.formatValue({ type: 'token-ref', path: 'color.primary' }), values.formatValue({ type: 'number', value: 2 }));
const a = parse(s('animation'));
console.log(JSON.stringify(a.roots[0]), a.diagnostics.length, defaultVocabulary().kinds.get('animation'));
console.log(t.get('motion.easing.standard'), [...t.keys()].slice(0, 40));

// The inspector tab data of `ok`.
const { readStyles } = await import('@link-foundation/ui-style');
const d = await import('../packages/ui-devmode/src/details.js');
const doc = parse(s('document'));
const ok = doc.byId.get('ok');
const styles = d.matchingStyles(ok, [doc.byId.get('app'), doc.byId.get('body')], readStyles(s('styles')).rules);
console.log(JSON.stringify(styles));
const anims = d.animationsOf('ok', a.roots);
console.log(JSON.stringify(anims));
console.log(d.tokensUsed({ rows: [], styles, animations: anims }, t));
console.log(d.sourceOf(ok));
