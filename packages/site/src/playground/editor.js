/** Native editor and line numbers, separate from preview state. */
export function createEditor(document, sourcePane, previewPane) {
  const make = (tag, text, parent) => {
    const node = document.createElement(tag);
    if (text) {
      node.textContent = text;
    }
    parent?.appendChild(node);
    return node;
  };
  const label = make('label', 'Links Notation', sourcePane);
  label.htmlFor = 'lino-editor';
  const editorWrap = make('div', '', sourcePane);
  editorWrap.className = 'lino-editor';
  const numbers = make('pre', '', editorWrap);
  numbers.setAttribute('aria-hidden', 'true');
  const editor = make('textarea', '', editorWrap);
  editor.id = 'lino-editor';
  editor.spellcheck = false;
  editor.setAttribute('aria-describedby', 'playground-errors');
  const errorBox = make('p', '', sourcePane);
  errorBox.id = 'playground-errors';
  errorBox.setAttribute('role', 'status');
  const status = make('p', '', sourcePane);
  status.setAttribute('role', 'status');
  make('h2', 'Live preview', previewPane);
  const isolated = make('div', '', previewPane).attachShadow({ mode: 'open' });
  const stylesheet = make('link', '', isolated);
  stylesheet.rel = 'stylesheet';
  stylesheet.href = document.querySelector('link[rel=stylesheet]').href;
  make('style', 'ui-document { min-height: 0; padding: 1rem; }', isolated);
  const preview = make('div', '', isolated);
  preview.id = 'live-preview';
  return { editor, numbers, errorBox, status, preview };
}
