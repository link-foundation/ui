export { validateLino, diagnosticOffset } from './validate-lino.js';
export { highlightLino } from './lino-highlight.js';
export { linoStructure } from './lino-structure.js';
export { createDocumentsModel } from './documents-model.js';
export { createEditorEngine } from './editor-engine.js';
export {
  defineCodeEditor,
  mountCodeEditor,
  registerEditor,
} from './code-editor.js';

import { defineCodeEditor, registerEditor } from './code-editor.js';
defineCodeEditor();
registerEditor();
