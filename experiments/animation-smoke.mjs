import { readFileSync } from 'node:fs';
import { loadAnimations } from '../packages/ui-animation/src/model.js';
import { sample } from '../packages/ui-animation/src/sample.js';
import { toWaapi } from '../packages/ui-animation/src/compile-waapi.js';
import { validateAnimations } from '../packages/ui-animation/src/validate.js';
import { flattenTimeline } from '../packages/ui-animation/src/timeline.js';
import { readTokens, resolveTokens } from '../packages/ui-tokens/src/index.js';

const text = readFileSync(
  'docs/case-studies/issue-1/samples/animation.lino',
  'utf8'
);
const m = loadAnimations(text);
console.log('diag', JSON.stringify(m.diagnostics, null, 1));
console.log([...m.animations.keys()], [...m.timelines.keys()], m.triggers);
const { sets } = readTokens(
  readFileSync('docs/case-studies/issue-1/samples/tokens.lino', 'utf8')
);
const tok = resolveTokens(sets, 'material3');
console.log(typeof tok, tok instanceof Map, tok?.tokens instanceof Map);
const map = tok instanceof Map ? tok : tok.tokens;
const resolveToken = (p) => map.get(p);
const pf = m.animations.get('press-feedback');
console.log(JSON.stringify(pf));
console.log(JSON.stringify(toWaapi(pf, { resolveToken })));
console.log(
  sample({ ...pf, easing: { type: 'linear' } }, 75, { resolveToken })
);
const step2 = `(panel-enter: animation (duration 300ms) (easing (cubic-bezier 0.2 0 0 1)) (fill backwards) (track opacity (key 0 0) (key 1 1)) (track translate (key 0 '0 8px') (key 1 '0 0')) (reduced-motion (duration 0ms)))
(bounce: animation (duration 600ms) (easing (spring (stiffness 300) (damping 20) (mass 1))) (track scale (key 0 0.9) (key 1 1)))
(title-reveal: animation (target title) (duration 900ms) (effect decipher (seed 42)))
(intro: timeline (at 0ms (play panel-enter (target sidebar))) (at 120ms (stagger 50ms (play bounce) (targets item-1 item-2 item-3))))`;
const m2 = loadAnimations(step2);
console.log('diag2', JSON.stringify(m2.diagnostics));
console.log(flattenTimeline(m2, 'intro'));
console.log(
  sample(m2.animations.get('title-reveal'), 450, { input: 'Hello world' })
);
console.log(sample(m2.animations.get('panel-enter'), 150));
console.log(sample(m2.animations.get('bounce'), 100));
console.log(validateAnimations(m2));
