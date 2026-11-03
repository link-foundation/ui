// Evaluation order of a CommonJS dependency and an ES module setup import.
// `bun experiments/cjs-order/main.mjs` prints "cjs runs, G = undefined"
// before "setup runs": the CJS module (like Vue's Node build, which reads
// the global `document`) is evaluated before the body of the setup module
// imported ahead of it. Hence packages/ui-vue/tests/setup-dom.js installs
// the jsdom globals first and loads vue with a dynamic import afterwards.
import './setup.mjs';
import c from './c.cjs';
console.log('main', c.x);
