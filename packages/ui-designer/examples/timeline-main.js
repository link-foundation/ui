import { mountDesigner } from '../src/index.js';
const documentText = await (await fetch('./animation.lino')).text();
window.designer = mountDesigner({
  root: document.getElementById('app'),
  documentText,
  resolveToken: (path) => (path === 'motion.duration.short' ? 1000 : undefined),
});
