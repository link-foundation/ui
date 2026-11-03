/**
 * Engine contract. Adapters own editor state, history, selection and disposal.
 * @typedef {object} EditorEngine
 * @property {(document: {id: string, text: string, language: string}) => (void|Promise<void>)} setDocument
 * @property {(diagnostics: object[]) => void} setDiagnostics
 * @property {(readOnly: boolean) => void} setReadOnly
 * @property {(offset?: number) => void} focus
 * @property {() => void} destroy
 */

/** No engine code or optional Monaco dependency loads until selected. */
export async function createEditorEngine(name, parent, options = {}) {
  if (name === 'codemirror') {
    const { createCodeMirrorEngine } = await import('./engines/codemirror.js');
    return createCodeMirrorEngine(parent, options);
  }
  if (name === 'monaco') {
    const { createMonacoEngine } = await import('./engines/monaco.js');
    return createMonacoEngine(parent, options);
  }
  throw new TypeError(`Unknown editor engine: ${name}`);
}
