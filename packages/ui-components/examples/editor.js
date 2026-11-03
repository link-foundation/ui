import { defineCodeEditor } from '../src/editor/index.js';

defineCodeEditor();
const editor = document.createElement('ui-code-editor');
editor.id = 'source';
editor.setAttribute('label', 'LiNo source');
const params = new window.URLSearchParams(window.location.search);

/** The optional desktop engine loads only after explicit selection. */
async function loadMonaco() {
  if (window.monaco) {
    return window.monaco;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/node_modules/monaco-editor/min/vs/loader.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  window.require.config({
    paths: { vs: '/node_modules/monaco-editor/min/vs' },
  });
  await new Promise((resolve, reject) =>
    window.require(['vs/editor/editor.main'], resolve, reject)
  );
  return window.monaco;
}

editor.editorOptions = {
  storage: window.localStorage,
  key: 'issue-46-editor-tabs',
  engineOptions: { loadMonaco },
};
if (params.get('engine') === 'monaco') {
  editor.setAttribute('engine', 'monaco');
}
// Configure the detached element before its model is first accessed.
const sources = await Promise.all(
  ['document', 'tokens'].map(async (name) => ({
    id: `${name}.lino`,
    title: `${name}.lino`,
    language: 'lino',
    text: await (
      await fetch(`/docs/case-studies/issue-1/samples/${name}.lino`)
    ).text(),
  }))
);
if (window.localStorage.getItem('issue-46-editor-tabs') === null) {
  for (const source of sources) {
    editor.openDocument(source);
  }
  editor.model.switch('document.lino');
}
document.querySelector('#editor-host').append(editor);
await editor.ready;
window.editor = editor;
document
  .querySelector('#external')
  .addEventListener('click', () =>
    editor.externalUpdate(
      editor.model.active.id,
      'app: document\n  title External\n'
    )
  );
document
  .querySelector('#error')
  .addEventListener('click', () =>
    editor.model.edit(
      editor.model.active.id,
      "(app: document\n  (title 'Links UI demo')\n"
    )
  );
document.querySelector('#engine').addEventListener('click', () => {
  window.location.search = '?engine=monaco';
});
document.querySelector('#saved').textContent = 'No save yet';
editor.addEventListener('ui-save', ({ detail }) => {
  document.querySelector('#saved').textContent =
    `Saved ${detail.id}: ${detail.text.length} characters`;
});
