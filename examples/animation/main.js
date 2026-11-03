// Usage of @link-foundation/ui-animation in a browser: render a document
// with ui-dom, load the animations of animations.lino and play the `intro`
// timeline on the rendered nodes (WAAPI for CSS tracks, the frame loop for
// the seeded `decipher` effect). "Reduce motion" updates the document's
// motion boundary, so the `(reduced-motion ...)` variants play; pressing OK
// sets the `pressed` state in the store, which fires `press-feedback`.
// Serve the repository with `node scripts/serve-static.mjs` and open
// http://127.0.0.1:4173/examples/animation/
import { mountDocument } from '@link-foundation/ui-dom';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import {
  createPlayer,
  loadAnimations,
  spring,
  springEasing,
  toCssLinear,
  tokenResolver,
  validateAnimations,
} from '@link-foundation/ui-animation';

const SAMPLES = new URL(
  '../../docs/case-studies/issue-1/samples/',
  import.meta.url
);
const read = async (url) => (await fetch(url)).text();

const [documentText, animationsText, styles, tokens] = await Promise.all([
  read(new URL('./document.lino', import.meta.url)),
  read(new URL('./animations.lino', import.meta.url)),
  read(new URL('styles.lino', SAMPLES)),
  read(new URL('tokens.lino', SAMPLES)),
]);

const app = document.getElementById('app');
const { store, handle } = mountDocument(app, documentText, {
  styles,
  tokens,
  setTitle: false,
});

const resolveToken = tokenResolver(
  resolveTokens(readTokens(tokens).sets, 'material3')
);
const model = loadAnimations(animationsText);
const player = createPlayer(handle, { animations: model, resolveToken });
player.bindTriggers(store);

// The safety rules of every animation (fill, flashes, reduced motion).
const problems = [
  ...model.diagnostics,
  ...validateAnimations(model, { resolveToken }),
];
document.getElementById('safety').textContent =
  problems.length === 0
    ? 'no diagnostics'
    : problems.map((d) => `${d.severity} ${d.code}`).join(', ');

// The spring of `bounce` as a CSS linear() easing.
const bounce = spring(model.animations.get('bounce').easing);
document.getElementById('spring').textContent = `${Math.round(
  bounce.settleTime
)} ms, ${toCssLinear(springEasing(bounce), 10)}`;

const status = document.getElementById('status');
const motion = document.getElementById('reduced');
const syncMotion = () => {
  const value = motion.checked ? 'reduced' : 'full';
  app.dataset.motion = value;
  store.setProp('animation-example', 'motion', [value]);
  handle.flush();
};
motion.addEventListener('change', syncMotion);
syncMotion();

let current = null;
/** Play an animation or a timeline; returns its control. */
function play(id, target) {
  current?.cancel();
  const control = player.play(id, target ? { target } : {});
  current = control;
  status.textContent = `${id} playing (${player.motion('sidebar')} motion)`;
  control.finished.then(
    () => {
      status.textContent = `${id} finished (${player.motion('sidebar')} motion)`;
    },
    () => {}
  );
  return control;
}
document.getElementById('play').addEventListener('click', () => play('intro'));

// The `pressed` state of OK lives in the store; `(on pressed)` plays
// press-feedback when it turns on.
const ok = handle.nodeFor('ok').querySelector('button');
const press = () => store.setProp('ok', 'pressed', ['true']);
const release = () => store.setProp('ok', 'pressed', ['false']);
ok.addEventListener('pointerdown', press);
ok.addEventListener('keydown', (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    press();
  }
});
for (const name of ['pointerup', 'pointerleave', 'keyup', 'blur']) {
  ok.addEventListener(name, release);
}

window.animationExample = { player, store, handle, play };
document.body.dataset.ready = 'true';
