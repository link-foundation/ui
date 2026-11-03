import { mountDesigner } from '../src/index.js';
const documentText = await (await fetch('./document.lino')).text();
window.designer = mountDesigner({
  root: document.getElementById('app'),
  documentText,
  onAction(detail) {
    window.lastDesignerAction = detail.action;
  },
});
